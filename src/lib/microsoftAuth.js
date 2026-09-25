import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
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
  await deleteSecureRefreshToken(profileKey, storageDir);

  const store = await readAuthStore(storageDir);
  if (store.profiles?.[profileKey]) {
    delete store.profiles[profileKey];
    await writeAuthStore(storageDir, store);
  }
}

// ── PKCE Utilities ─────────────────────────────────────────────────────────
function base64url(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

// ── Direct Minecraft / Xbox Live Authentication Flow ─────────────────────────
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
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text().catch(() => '');
    }
    const error = new Error(`Request to ${url} failed with status ${res.status}: ${errorDetail}`);
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

  // 4. Minecraft Profile Details
  const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });

  if (!profileRes.ok) {
    throw new Error(`Failed to fetch Minecraft profile: ${profileRes.status}`);
  }

  const profile = await profileRes.json();

  return {
    access_token: mcAccessToken,
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
}) {
  const refreshToken = await loadRefreshToken(profileKey, storageDir);
  if (!refreshToken) {
    throw new Error('No refresh token available');
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
    const err = new Error(`Token refresh failed (HTTP ${tokenRes.status}): ${errorBody}`);
    err.status = tokenRes.status;
    throw err;
  }

  const tokenData = await tokenRes.json();
  const accountInfo = await buildMinecraftAccountInfoFromAccessToken(
    tokenData.access_token,
    tokenData.refresh_token || refreshToken,
  );

  if (accountInfo?.refresh_token) {
    await saveRefreshToken(profileKey, accountInfo.refresh_token, storageDir, accountInfo.name || '');
  }

  return accountInfo;
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
        try { server.close(); } catch { }
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
    await saveRefreshToken(profileKey, accountInfo.refresh_token, storageDir, accountInfo.name || '');
  }

  return accountInfo;
}

export async function getMicrosoftAuthState({
  profileKey,
  storageDir,
  clientId = MICROSOFT_CLIENT_ID,
} = {}) {
  const store = await readAuthStore(storageDir);
  const hasStoredToken = !!store.profiles?.[profileKey]?.refresh_token;

  try {
    const accountInfo = await refreshMicrosoftSession({
      profileKey,
      storageDir,
      clientId,
    });

    return {
      loggedIn: true,
      name: accountInfo.name || '',
      profileKey,
      ...accountInfo,
    };
  } catch (error) {
    const errorMsg = error?.message || 'Not authenticated';

    if (errorMsg.includes('401') || errorMsg.includes('invalid_grant') || errorMsg.includes('400')) {
      await deleteRefreshToken(profileKey, storageDir);
      return {
        loggedIn: false,
        name: '',
        profileKey,
        error: errorMsg,
        hasStoredToken: false,
      };
    }

    return {
      loggedIn: false,
      name: '',
      profileKey,
      error: errorMsg,
      hasStoredToken,
    };
  }
}

export async function logoutMicrosoft({ profileKey, storageDir } = {}) {
  await deleteRefreshToken(profileKey, storageDir);
  return { loggedIn: false, name: '', profileKey };
}