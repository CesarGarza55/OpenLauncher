import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import process from 'process';
import { safeStorage } from 'electron';

// OpenLauncher provides a default Microsoft client ID for convenience, but developers can override it with their own by setting the `VITE_MICROSOFT_CLIENT_ID` or `MICROSOFT_CLIENT_ID` environment variable.
// If you are building your own launcher or application, it is recommended to register your own Microsoft application and use its client ID for authentication.
// Please refer to https://github.com/CesarGarza55/OpenLauncher#build-from-source to learn how to register your own Microsoft application and obtain a client ID.
export const DEFAULT_MICROSOFT_CLIENT_ID = '3f59fbe7-2c4b-4343-9a61-c03104ddaedf';
export const MICROSOFT_CLIENT_ID = process.env.VITE_MICROSOFT_CLIENT_ID
  || process.env.MICROSOFT_CLIENT_ID
  || DEFAULT_MICROSOFT_CLIENT_ID;

const DEFAULT_REDIRECT_URL = 'http://localhost:8080/callback';
const LOGIN_SUCCESS_REDIRECT_URL = 'https://openlauncher.codevbox.com/login-success';
const LOGIN_FAILED_REDIRECT_URL = 'https://openlauncher.codevbox.com/login-failed';

// In-memory cache for active Minecraft sessions to prevent redundant network calls
// Shape: Map<profileKey, { accountInfo, expires_at: number }>
const sessionCache = new Map();

// In-flight refresh promises map to deduplicate concurrent requests for the same profileKey (Mutex)
const inflightRefreshes = new Map();

// Global singleton for the callback server
let callbackServer = null;

function authStorePath(storageDir) {
  return path.join(storageDir, 'auth-store.json');
}

function authSecureStorePath(storageDir) {
  return path.join(storageDir, 'auth-secure.json');
}

function authAccountName(profileKey) {
  return `profile:${String(profileKey || 'default')}`;
}

function isSecureStorageAvailable() {
  try {
    return Boolean(safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable());
  } catch {
    return false;
  }
}

async function readSecureStore(storageDir) {
  try {
    const raw = await fs.readFile(authSecureStorePath(storageDir), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeSecureStore(storageDir, store) {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(authSecureStorePath(storageDir), JSON.stringify(store, null, 2), 'utf8');
}

async function getSecureRefreshToken(profileKey, storageDir) {
  if (!isSecureStorageAvailable() || !storageDir) return null;
  try {
    const secureStore = await readSecureStore(storageDir);
    const encryptedBase64 = secureStore[authAccountName(profileKey)];
    if (!encryptedBase64) return null;
    const decrypted = safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'));
    return decrypted || null;
  } catch {
    return null;
  }
}

async function setSecureRefreshToken(profileKey, token, storageDir) {
  if (!isSecureStorageAvailable() || !storageDir) return false;
  try {
    const secureStore = await readSecureStore(storageDir);
    const encrypted = safeStorage.encryptString(String(token || '')).toString('base64');
    secureStore[authAccountName(profileKey)] = encrypted;
    await writeSecureStore(storageDir, secureStore);
    return true;
  } catch {
    return false;
  }
}

async function deleteSecureRefreshToken(profileKey, storageDir) {
  if (!storageDir) return false;
  try {
    const secureStore = await readSecureStore(storageDir);
    const key = authAccountName(profileKey);
    if (key in secureStore) {
      delete secureStore[key];
      await writeSecureStore(storageDir, secureStore);
    }
    return true;
  } catch {
    return false;
  }
}

async function readAuthStore(storageDir) {
  try {
    const raw = await fs.readFile(authStorePath(storageDir), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { profiles: {}, legacy: null };
  }
}

async function writeAuthStore(storageDir, store) {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(authStorePath(storageDir), JSON.stringify(store, null, 2), 'utf8');
}

export async function hasStoredRefreshToken(profileKey, storageDir) {
  if (!storageDir) return false;
  const secureToken = await getSecureRefreshToken(profileKey, storageDir);
  if (secureToken) return true;
  const store = await readAuthStore(storageDir);
  return Boolean(store.profiles?.[profileKey]?.refresh_token);
}

export async function loadRefreshToken(profileKey, storageDir) {
  const secureToken = await getSecureRefreshToken(profileKey, storageDir);
  if (secureToken) return secureToken;

  const store = await readAuthStore(storageDir);
  const legacyToken = store.profiles?.[profileKey]?.refresh_token ?? null;

  if (legacyToken) {
    const migrated = await setSecureRefreshToken(profileKey, legacyToken, storageDir);
    if (migrated) {
      if (store.profiles?.[profileKey]) {
        delete store.profiles[profileKey].refresh_token;
        if (Object.keys(store.profiles[profileKey]).length === 0) {
          delete store.profiles[profileKey];
        }
      }
      await writeAuthStore(storageDir, store);
    }
  }

  return legacyToken;
}

export async function saveRefreshToken(profileKey, token, storageDir, name = '') {
  const isSecure = await setSecureRefreshToken(profileKey, token, storageDir);
  const store = await readAuthStore(storageDir);
  store.profiles ??= {};
  store.profiles[profileKey] ??= {};
  if (name) store.profiles[profileKey].name = name;
  if (!isSecure) {
    store.profiles[profileKey].refresh_token = token;
  } else if (store.profiles[profileKey].refresh_token) {
    delete store.profiles[profileKey].refresh_token;
  }
  await writeAuthStore(storageDir, store);
}

export async function deleteRefreshToken(profileKey, storageDir) {
  const key = String(profileKey || 'default');
  sessionCache.delete(key);
  inflightRefreshes.delete(key);

  await deleteSecureRefreshToken(key, storageDir);

  const store = await readAuthStore(storageDir);
  if (store.profiles?.[key]) {
    delete store.profiles[key];
    await writeAuthStore(storageDir, store);
  }
}

export function isSessionValid(session) {
  if (!session || !session.access_token || session.access_token === '0') return false;
  if (!session.expires_at || typeof session.expires_at !== 'number') return false;
  // Consider session valid if more than 5 minutes remain before Minecraft access token expires
  return Date.now() < (session.expires_at - 5 * 60 * 1000);
}

// ── PKCE Utilities ─────────────────────────────────────────────────────────
function base64url(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

// ── Direct Minecraft / Xbox Live Authentication Flow ─────────────────────────
function parseXboxError(status, errorJson) {
  const xerr = errorJson?.XErr;
  if (xerr === 2148916233) {
    return 'The Microsoft account does not have an Xbox Live profile. Please create one at xbox.com.';
  }
  if (xerr === 2148916235) {
    return 'Xbox Live is not available in your country/region.';
  }
  if (xerr === 2148916236 || xerr === 2148916237) {
    return 'Xbox Live adult verification is required.';
  }
  if (xerr === 2148916238) {
    return 'Child account: This account must be added to a Microsoft Family by an adult.';
  }
  return `Xbox Live authentication failed with code ${xerr || status}.`;
}

async function postJson(url, data, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let parsedJson = null;
    let errorDetail = '';
    try {
      parsedJson = await res.json();
    } catch {
      errorDetail = await res.text().catch(() => '');
    }

    if (parsedJson?.XErr) {
      const xboxMsg = parseXboxError(res.status, parsedJson);
      const error = new Error(`Request to ${url} failed: ${xboxMsg}`);
      error.status = res.status;
      error.xerr = parsedJson.XErr;
      throw error;
    }

    const detailMsg = errorDetail || (parsedJson ? JSON.stringify(parsedJson) : '');
    const error = new Error(`Request to ${url} failed with status ${res.status}: ${detailMsg}`);
    error.status = res.status;
    throw error;
  }

  return await res.json();
}

export async function buildMinecraftAccountInfoFromAccessToken(msAccessToken, msRefreshToken) {
  // 1. Xbox Live User Authentication
  const xblData = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${msAccessToken}`,
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  }, { 'x-xbl-contract-version': '1' });

  const xblToken = xblData.Token;
  const xblUhs = xblData?.DisplayClaims?.xui?.[0]?.uhs;
  if (!xblToken || !xblUhs) throw new Error('Xbox Live authentication failed');

  // 2. XSTS Token Authentication
  const xstsData = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: {
      SandboxId: 'RETAIL',
      UserTokens: [xblToken],
    },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT',
  }, { 'x-xbl-contract-version': '1' });

  const xstsToken = xstsData?.Token;
  const xstsUhs = xstsData?.DisplayClaims?.xui?.[0]?.uhs || xblUhs;
  if (!xstsToken) throw new Error('XSTS exchange failed');

  // 3. Minecraft Services Authentication
  const identityToken = `XBL3.0 x=${xstsUhs};${xstsToken}`;
  const mcLoginData = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
    identityToken,
  }, { 'User-Agent': 'OpenLauncher' });

  const mcAccessToken = mcLoginData?.access_token;
  if (!mcAccessToken) throw new Error('Minecraft login failed');

  const expiresInSec = Number(mcLoginData?.expires_in) || 86400; // standard 24 hours
  const expiresAt = Date.now() + (expiresInSec * 1000);

  // 4. Minecraft Profile Details
  const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });

  if (!profileRes.ok) {
    if (profileRes.status === 404) {
      throw new Error('This Microsoft account does not own Minecraft Java Edition.');
    }
    throw new Error(`Failed to fetch Minecraft profile: ${profileRes.status}`);
  }

  const profile = await profileRes.json();

  return {
    access_token: mcAccessToken,
    expires_at: expiresAt,
    id: profile.id,
    uuid: profile.id,
    name: profile.name,
    refresh_token: msRefreshToken,
    userType: 'msa',
  };
}

export async function refreshMicrosoftSession({
  profileKey,
  storageDir,
  clientId = MICROSOFT_CLIENT_ID,
  force = false,
}) {
  const key = String(profileKey || 'default');

  // Fast path: if valid cached session exists and refresh is not forced, return cached session
  if (!force && sessionCache.has(key)) {
    const cached = sessionCache.get(key);
    if (isSessionValid(cached)) {
      return cached;
    }
  }

  // Deduplicate concurrent refreshes for the same profileKey (Mutex)
  if (inflightRefreshes.has(key)) {
    return inflightRefreshes.get(key);
  }

  const refreshPromise = (async () => {
    try {
      const refreshToken = await loadRefreshToken(key, storageDir);
      if (!refreshToken) {
        const error = new Error('No refresh token available');
        error.noToken = true;
        throw error;
      }

      const params = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const tokenRes = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!tokenRes.ok) {
        const errorBody = await tokenRes.text().catch(() => '');
        let isInvalidGrant = false;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.error === 'invalid_grant' || (parsed.error_description && (
            parsed.error_description.includes('AADSTS70008') ||
            parsed.error_description.includes('AADSTS70000') ||
            parsed.error_description.includes('AADSTS50173')
          ))) {
            isInvalidGrant = true;
          }
        } catch {
          if (errorBody.includes('invalid_grant')) {
            isInvalidGrant = true;
          }
        }
        const err = new Error(`Token refresh failed (HTTP ${tokenRes.status}): ${errorBody}`);
        err.status = tokenRes.status;
        err.isInvalidGrant = isInvalidGrant;
        throw err;
      }

      const tokenData = await tokenRes.json();
      const accountInfo = await buildMinecraftAccountInfoFromAccessToken(
        tokenData.access_token,
        tokenData.refresh_token || refreshToken,
      );

      if (accountInfo?.refresh_token) {
        await saveRefreshToken(key, accountInfo.refresh_token, storageDir, accountInfo.name || '');
      }

      sessionCache.set(key, accountInfo);
      return accountInfo;
    } finally {
      inflightRefreshes.delete(key);
    }
  })();

  inflightRefreshes.set(key, refreshPromise);
  return refreshPromise;
}

async function waitForCallback({ port, timeoutMs, abortSignal }) {
  return new Promise((resolve, reject) => {
    let server = null;
    let timer = null;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (server) {
        try {
          server.close();
        } catch {
          // Ignore server close error on cleanup
        }
        server = null;
      }
      if (callbackServer === server) {
        callbackServer = null;
      }
    };

    const onResolve = (data) => {
      cleanup();
      resolve(data);
    };

    const onReject = (err) => {
      cleanup();
      reject(err);
    };

    server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url, `http://localhost:${port}`);

      if (requestUrl.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const code = requestUrl.searchParams.get('code');
      const state = requestUrl.searchParams.get('state');
      const error = requestUrl.searchParams.get('error');

      if (error) {
        res.writeHead(302, { Location: LOGIN_FAILED_REDIRECT_URL });
        res.end();
        onReject(new Error(error));
        return;
      }

      res.writeHead(302, { Location: LOGIN_SUCCESS_REDIRECT_URL });
      res.end();
      onResolve({ code, state });
    });

    server.on('error', (err) => {
      onReject(new Error(`Local authentication server error on port ${port}: ${err.message}`));
    });

    if (timeoutMs) {
      timer = setTimeout(() => {
        onReject(new Error('Login timeout'));
      }, timeoutMs);
    }

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        onReject(new Error('Login cancelled by user'));
      }, { once: true });
    }

    server.listen(port, '127.0.0.1');
    callbackServer = server;
  });
}

export async function loginMicrosoftInteractive({
  profileKey,
  storageDir,
  clientId = MICROSOFT_CLIENT_ID,
  openExternal,
  redirectUrl = DEFAULT_REDIRECT_URL,
  callbackPort = 8080,
  timeoutMs = 300000,
  abortSignal,
} = {}) {
  const key = String(profileKey || 'default');
  const state = crypto.randomUUID();
  const codeVerifier = base64url(crypto.randomBytes(64));
  const codeChallenge = base64url(sha256(codeVerifier));

  const scope = encodeURIComponent('offline_access openid profile XboxLive.signin');
  const authUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=${clientId}`
    + `&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}`
    + `&response_mode=query&scope=${scope}&state=${state}`
    + `&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&prompt=select_account`;

  const callbackPromise = waitForCallback({ port: callbackPort, timeoutMs, abortSignal });

  if (typeof openExternal === 'function') {
    await openExternal(authUrl);
  }

  const callback = await callbackPromise;
  if (!callback?.code || callback.state !== state) {
    throw new Error('Invalid authentication state received from callback.');
  }

  // Direct token exchange with Microsoft using PKCE code_verifier
  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code: callback.code,
    redirect_uri: redirectUrl,
    code_verifier: codeVerifier,
  });

  const tokenRes = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text().catch(() => '');
    throw new Error(`Token exchange failed with status ${tokenRes.status}: ${errorBody}`);
  }

  const tokenData = await tokenRes.json();
  const accountInfo = await buildMinecraftAccountInfoFromAccessToken(
    tokenData.access_token,
    tokenData.refresh_token,
  );

  if (accountInfo?.refresh_token) {
    await saveRefreshToken(key, accountInfo.refresh_token, storageDir, accountInfo.name || '');
  }

  sessionCache.set(key, accountInfo);
  return accountInfo;
}

export async function getMicrosoftAuthState({
  profileKey,
  storageDir,
  clientId = MICROSOFT_CLIENT_ID,
  forceRefresh = false,
} = {}) {
  const key = String(profileKey || 'default');
  const hasToken = await hasStoredRefreshToken(key, storageDir);

  if (!hasToken) {
    sessionCache.delete(key);
    return {
      loggedIn: false,
      name: '',
      profileKey: key,
      hasStoredToken: false,
    };
  }

  // Fast path: if we have a valid session in cache and refresh is not forced, return it immediately
  if (!forceRefresh && sessionCache.has(key)) {
    const cached = sessionCache.get(key);
    if (isSessionValid(cached)) {
      return {
        loggedIn: true,
        name: cached.name || '',
        profileKey: key,
        hasStoredToken: true,
        ...cached,
      };
    }
  }

  try {
    const accountInfo = await refreshMicrosoftSession({
      profileKey: key,
      storageDir,
      clientId,
      force: forceRefresh,
    });

    return {
      loggedIn: true,
      name: accountInfo.name || '',
      profileKey: key,
      hasStoredToken: true,
      ...accountInfo,
    };
  } catch (error) {
    const errorMsg = error?.message || 'Not authenticated';

    // ONLY permanently delete the stored refresh token if Microsoft explicitly rejected the refresh token as invalid/revoked/expired
    if (error?.isInvalidGrant) {
      sessionCache.delete(key);
      await deleteRefreshToken(key, storageDir);
      return {
        loggedIn: false,
        name: '',
        profileKey: key,
        error: errorMsg,
        hasStoredToken: false,
      };
    }

    // For transient/network/Xbox service errors, DO NOT delete the refresh token!
    // Retrieve stored profile name from disk if available to maintain offline state
    const store = await readAuthStore(storageDir);
    const storedName = store.profiles?.[key]?.name || '';
    const cachedSession = sessionCache.get(key);

    return {
      loggedIn: Boolean(cachedSession?.access_token),
      name: cachedSession?.name || storedName,
      profileKey: key,
      error: errorMsg,
      hasStoredToken: true,
      isOffline: true,
      ...(cachedSession || {}),
    };
  }
}

export async function logoutMicrosoft({ profileKey, storageDir } = {}) {
  const key = String(profileKey || 'default');
  await deleteRefreshToken(key, storageDir);
  return { loggedIn: false, name: '', profileKey: key, hasStoredToken: false };
}