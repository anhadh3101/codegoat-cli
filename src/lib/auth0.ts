import { exec } from 'child_process';
import { auth0Config } from './config.js';
import { getCredentials, saveCredentials } from './auth.js';

const SCOPE = 'openid profile email offline_access';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

export interface UserInfo {
  email?: string;
  name?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openBrowser(url: string): void {
  const openCmd =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';

  exec(`${openCmd} "${url}"`);
}

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({
    client_id: auth0Config.clientId,
    scope: SCOPE,
  });

  if (auth0Config.audience) {
    body.set('audience', auth0Config.audience);
  }

  const res = await fetch(`https://${auth0Config.domain}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Failed to request device code: ${res.status}`);
  }

  return res.json() as Promise<DeviceCodeResponse>;
}

async function pollForTokens(
  deviceCode: string,
  interval: number,
  expiresIn: number
): Promise<TokenResponse> {
  const deadline = Date.now() + expiresIn * 1000;
  let pollInterval = interval * 1000;

  while (Date.now() < deadline) {
    await sleep(pollInterval);

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode,
      client_id: auth0Config.clientId,
    });

    const res = await fetch(`https://${auth0Config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await res.json()) as TokenResponse & TokenErrorResponse;

    if (res.ok) {
      return data;
    }

    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      pollInterval += 5000;
      continue;
    }
    if (data.error === 'expired_token') {
      throw new Error('Login timed out. Run: codegoat auth login');
    }
    if (data.error === 'access_denied') {
      throw new Error('Login was denied.');
    }

    throw new Error(`Token request failed: ${data.error}`);
  }

  throw new Error('Login timed out. Run: codegoat auth login');
}

export async function loginWithDeviceFlow(): Promise<void> {
  const device = await requestDeviceCode();

  console.log(`\nOpen: ${device.verification_uri_complete}`);
  console.log(`Or enter code: ${device.user_code}\n`);
  console.log('Waiting for authorization...');

  openBrowser(device.verification_uri_complete);

  const tokens = await pollForTokens(
    device.device_code,
    device.interval,
    device.expires_in
  );

  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh token received. Enable the Refresh Token grant type and offline_access scope in Auth0.'
    );
  }

  await saveCredentials({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });
}

export async function refreshAccessToken(): Promise<string> {
  const credentials = await getCredentials();
  if (!credentials?.refreshToken) {
    throw new Error('No refresh token. Run: codegoat auth login');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: auth0Config.clientId,
    refresh_token: credentials.refreshToken,
  });

  const res = await fetch(`https://${auth0Config.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error('Session expired. Run: codegoat auth login');
  }

  const tokens = (await res.json()) as TokenResponse;

  await saveCredentials({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? credentials.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });

  return tokens.access_token;
}

export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch(`https://${auth0Config.domain}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch user info.');
  }

  return res.json() as Promise<UserInfo>;
}
