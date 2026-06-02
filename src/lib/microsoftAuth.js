import fs from 'fs/promises';
import { readFileSync } from 'fs';
import http from 'http';
import path from 'path';

const DEFAULT_AUTH_API_BASE = process.env.OPENLAUNCHER_AUTH_API ?? 'https://openlauncher.api.codevbox.com';
const DEFAULT_REDIRECT_URL = 'http://localhost:8080/callback';
const LOGIN_SUCCESS_REDIRECT_URL = 'https://openlauncher.codevbox.com/login-success';
const LOGIN_FAILED_REDIRECT_URL = 'https://openlauncher.codevbox.com/login-failed';
const DEV_BUILD_ID = '20260601_010619';
const DEV_BUILD_SIGNATURE = '8e024ebcb9e2c011141c09228260c9fd81932717af80003ca446ca6df2e49c9a';
const AUTH_KEYCHAIN_SERVICE = 'OpenLauncher';
const DEFAULT_BUILD_SECRET_FILE = process.env.OPENLAUNCHER_BUILD_SECRET_FILE
  ?? path.resolve(process.cwd(), 'data', 'build_secret.py');

let keytarModulePromise = null;

// Global singleton for the callback server
let callbackServer = null;
let callbackResolver = null;
let callbackRejecter = null;

function authStorePath(storageDir) {
  return path.join(storageDir, 'auth-store.json');
}

function authAccountName(profileKey) {
  return `profile:${String(profileKey || 'default')}`;
}

async function loadKeytar() {
  if (!keytarModulePromise) {
    keytarModulePromise = import('keytar')
      .then(mod => mod?.default || mod)
      .catch(() => null);
  }
  return keytarModulePromise;
}

async function getSecureRefreshToken(profileKey) {
  const keytar = await loadKeytar();
  if (!keytar) return null;
  try {
    return await keytar.getPassword(AUTH_KEYCHAIN_SERVICE, authAccountName(profileKey));
  } catch {
    return null;
  }
}

async function setSecureRefreshToken(profileKey, token) {
  const keytar = await loadKeytar();
  if (!keytar) return false;
  try {
    await keytar.setPassword(AUTH_KEYCHAIN_SERVICE, authAccountName(profileKey), String(token || ''));
    return true;
  } catch {
    return false;
  }
}

async function deleteSecureRefreshToken(profileKey) {
  const keytar = await loadKeytar();
  if (!keytar) return false;
  try {
    await keytar.deletePassword(AUTH_KEYCHAIN_SERVICE, authAccountName(profileKey));
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

export function getAuthHeaders() {
  const directBuildId = process.env.OPENLAUNCHER_BUILD_ID ?? '';
  const directBuildSignature = process.env.OPENLAUNCHER_BUILD_SIGNATURE ?? '';
  if (directBuildId && directBuildSignature) {
    return {
      'x-launcher-id': directBuildId,
      'x-launcher-sign': directBuildSignature,
    };
  }

  try {
    const text = readFileSync(DEFAULT_BUILD_SECRET_FILE, 'utf8');
    let buildId = '';
    let buildSignature = '';

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith('BUILD_ID') && line.includes('=')) {
        buildId = line.split('=', 1)[1].trim().replace(/^['"]|['"]$/g, '');
      } else if (line.startsWith('BUILD_SIGNATURE') && line.includes('=')) {
        buildSignature = line.split('=', 1)[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }

    if (buildId && buildSignature) {
      return {
        'x-launcher-id': buildId,
        'x-launcher-sign': buildSignature,
      };
    }
  } catch {
    return {
      'x-launcher-id': DEV_BUILD_ID,
      'x-launcher-sign': DEV_BUILD_SIGNATURE,
    };
  }

  return {
    'x-launcher-id': DEV_BUILD_ID,
    'x-launcher-sign': DEV_BUILD_SIGNATURE,
  };
}

async function requestJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let body = null;
      try {
        body = await response.json();
      } catch {
        try {
          body = await response.text();
        } catch {
          body = null;
        }
      }

      let details = '';

      if (body && typeof body === 'object') {
        if (body.upstream_status) {
          details = `${body.error} (Minecraft/Microsoft respondió ${body.upstream_status})`;
        } else {
          details = body.error || body.message || JSON.stringify(body);
        }
      } else {
        details = String(body || '').trim();
      }
      const suffix = details ? `: ${details}` : '';
      let error;
      switch (response.status) {
        case 400:
          error = new Error(`[ERROR ${response.status}] Bad request${suffix}`);
          break;
        case 401:
          error = new Error(`[ERROR ${response.status}] Unauthorized${suffix}`);
          break;
        case 403:
          error = new Error(`[ERROR ${response.status}] Forbidden${suffix}`);
          break;
        case 404:
          error = new Error(`[ERROR ${response.status}] Not found${suffix}`);
          break;
        case 500:
          error = new Error(`[ERROR ${response.status}] Internal server error${suffix}`);
          break;
        case 503:
          error = new Error(`[ERROR ${response.status}] Service unavailable${suffix}`);
          break;
        default:
          error = new Error(`[ERROR ${response.status}] Request failed${suffix}`);
          break;
      }
      error.status = response.status;
      error.details = body;
      throw error;
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function getStatusFromError(error) {
  const match = String(error?.message || '').match(/status\s+(\d{3})/i);
  return match ? Number(match[1]) : null;
}

async function requestJsonWithFallback(authApiBase, primaryPath, fallbackPath, options = {}, timeoutMs = 15000) {
  const baseUrl = String(authApiBase || '').replace(/\/+$/, '');
  const candidates = [primaryPath, fallbackPath].filter(Boolean);
  let lastError = null;

  for (const candidatePath of candidates) {
    try {
      const data = await requestJson(`${baseUrl}${candidatePath}`, options, timeoutMs);
      return { data, path: candidatePath };
    } catch (error) {
      lastError = error;
      const status = getStatusFromError(error);
      if (![401, 403, 500].includes(status)) {
        throw error;
      }
    }
  }

  throw lastError;
}

export async function loadRefreshToken(profileKey, storageDir) {
  const secureToken = await getSecureRefreshToken(profileKey);
  if (secureToken) return secureToken;

  const store = await readAuthStore(storageDir);
  const legacyToken = store.profiles?.[profileKey]?.refresh_token ?? null;

  // Migrate legacy JSON token to secure keychain when available.
  if (legacyToken) {
    const migrated = await setSecureRefreshToken(profileKey, legacyToken);
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

export async function saveRefreshToken(profileKey, token, storageDir) {
  const savedSecurely = await setSecureRefreshToken(profileKey, token);
  if (savedSecurely) {
    // Best-effort cleanup of legacy plaintext token.
    const store = await readAuthStore(storageDir);
    if (store.profiles?.[profileKey]?.refresh_token) {
      delete store.profiles[profileKey].refresh_token;
      if (Object.keys(store.profiles[profileKey]).length === 0) {
        delete store.profiles[profileKey];
      }
      await writeAuthStore(storageDir, store);
    }
    return;
  }

  const store = await readAuthStore(storageDir);
  store.profiles ??= {};
  store.profiles[profileKey] ??= {};
  store.profiles[profileKey].refresh_token = token;
  await writeAuthStore(storageDir, store);
}

export async function deleteRefreshToken(profileKey, storageDir) {
  await deleteSecureRefreshToken(profileKey);

  const store = await readAuthStore(storageDir);
  if (store.profiles?.[profileKey]) {
    delete store.profiles[profileKey].refresh_token;
    if (Object.keys(store.profiles[profileKey]).length === 0) {
      delete store.profiles[profileKey];
    }
    await writeAuthStore(storageDir, store);
  }
}

export async function refreshMicrosoftSession({
  profileKey,
  storageDir,
  authApiBase = DEFAULT_AUTH_API_BASE,
  authHeaders = getAuthHeaders(),
} = {}) {
  const refreshToken = await loadRefreshToken(profileKey, storageDir);
  if (!refreshToken) {
    throw new Error(`No refresh token stored for profile '${profileKey}'.`);
  }

  const { data: accountInfo } = await requestJsonWithFallback(
    authApiBase,
    '/refresh',
    '/refresh-local',
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );

  if (accountInfo?.refresh_token) {
    await saveRefreshToken(profileKey, accountInfo.refresh_token, storageDir);
  }

  return accountInfo;
}

async function forceClosePort(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.on('error', () => {
      // Port is in use, try to close it
      resolve();
    });
    server.on('listening', () => {
      // Port is available, close the test server
      server.close(() => resolve());
    });
    server.listen(port, '127.0.0.1');
  });
}

async function waitForPortAvailable(port, maxWaitMs = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    try {
      await new Promise((resolve, reject) => {
        const testServer = http.createServer();
        testServer.once('error', () => {
          testServer.close();
          resolve(false);
        });
        testServer.once('listening', () => {
          testServer.close();
          resolve(true);
        });
        testServer.listen(port, '127.0.0.1');
      });
      return true;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return false;
}

async function waitForCallback({ port, timeoutMs, abortSignal }) {
  return new Promise((resolve, reject) => {
    // Clean up any previous pending requests
    if (callbackResolver) {
      callbackResolver = null;
    }
    if (callbackRejecter) {
      callbackRejecter = null;
    }
    
    // If server already exists, just update the resolver/rejecter
    if (callbackServer) {
      callbackResolver = resolve;
      callbackRejecter = reject;
      
      if (abortSignal) {
        const handleAbort = () => {
          if (callbackRejecter) {
            callbackRejecter(new Error('Login cancelled by user'));
            callbackResolver = null;
            callbackRejecter = null;
          }
        };
        abortSignal.addEventListener('abort', handleAbort, { once: true });
      }
      return;
    }

    // Create new server
    callbackServer = http.createServer((req, res) => {
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
        if (callbackRejecter) {
          callbackRejecter(new Error(error));
          callbackResolver = null;
          callbackRejecter = null;
        }
        return;
      }

      res.writeHead(302, { Location: LOGIN_SUCCESS_REDIRECT_URL });
      res.end();
      if (callbackResolver) {
        callbackResolver({ code, state });
        callbackResolver = null;
        callbackRejecter = null;
      }
    });

    callbackResolver = resolve;
    callbackRejecter = reject;

    const timer = setTimeout(() => {
      if (callbackRejecter) {
        callbackRejecter(new Error('Login timeout'));
        callbackResolver = null;
        callbackRejecter = null;
      }
    }, timeoutMs);

    if (abortSignal) {
      const handleAbort = () => {
        if (callbackRejecter) {
          callbackRejecter(new Error('Login cancelled by user'));
          callbackResolver = null;
          callbackRejecter = null;
        }
        clearTimeout(timer);
      };
      abortSignal.addEventListener('abort', handleAbort, { once: true });
    }

    callbackServer.listen(port, '127.0.0.1', () => {
      // Server started successfully
    });
  });
}

export async function loginMicrosoftInteractive({
  profileKey,
  storageDir,
  authApiBase = DEFAULT_AUTH_API_BASE,
  authHeaders = getAuthHeaders(),
  openExternal,
  redirectUrl = DEFAULT_REDIRECT_URL,
  callbackPort = 8080,
  timeoutMs = 300000,
  abortSignal,
} = {}) {
  const startResponse = await requestJsonWithFallback(
    authApiBase,
    `/start?launcher_redirect_uri=${encodeURIComponent(redirectUrl)}`,
    `/start-local?launcher_redirect_uri=${encodeURIComponent(redirectUrl)}`,
    {
      method: 'GET',
      headers: authHeaders,
    },
  );

  const loginUrl = startResponse?.data?.url;
  const state = startResponse?.data?.state;
  const useLocalEndpoints = String(startResponse?.path || '').includes('-local');

  if (!loginUrl || !state) {
    throw new Error('Authentication service returned an invalid login payload.');
  }

  const callbackPromise = waitForCallback({ port: callbackPort, timeoutMs, abortSignal });
  if (typeof openExternal === 'function') {
    await openExternal(loginUrl);
  }

  const callback = await callbackPromise;
  if (!callback?.code || callback.state !== state) {
    throw new Error('Invalid authentication state received from callback.');
  }

  const { data: accountInfo } = await requestJsonWithFallback(
    authApiBase,
    useLocalEndpoints ? '/complete-local' : '/complete',
    useLocalEndpoints ? '/complete' : '/complete-local',
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: callback.code,
        state: callback.state,
      }),
    },
  );

  if (accountInfo?.refresh_token) {
    await saveRefreshToken(profileKey, accountInfo.refresh_token, storageDir);
  }

  return accountInfo;
}

export async function getMicrosoftAuthState({
  profileKey,
  storageDir,
  authApiBase = DEFAULT_AUTH_API_BASE,
  authHeaders = getAuthHeaders(),
  openExternal,
} = {}) {
  const store = await readAuthStore(storageDir);
  const hasStoredToken = !!store.profiles?.[profileKey]?.refresh_token;

  try {
    const accountInfo = await refreshMicrosoftSession({
      profileKey,
      storageDir,
      authApiBase,
      authHeaders,
    });

    return {
      loggedIn: true,
      name: accountInfo.name || '',
      profileKey,
      ...accountInfo,
    };
  } catch (error) {
    const errorMsg = error?.message || 'Not authenticated';

    // Only remove the token when the error is definitive (401 = unauthorized)
    // Network or transient errors should NOT delete the stored token
    if (errorMsg.includes('401') || errorMsg.includes('invalid_grant')) {
      await deleteRefreshToken(profileKey, storageDir);
      return {
        loggedIn: false,
        name: '',
        profileKey,
        error: errorMsg,
        hasStoredToken: false,
      };
    }

    // Para otros errores (red, timeout, etc.), mantener el token
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