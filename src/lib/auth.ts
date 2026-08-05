import keytar from 'keytar';
import { refreshAccessToken } from './auth0';

const SERVICE = 'codegoat-cli';
const ACCOUNT = 'default';

export interface StoredCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Save the credentials in the OS keychain.
export async function saveCredentials(credentials: StoredCredentials): Promise<void> {
  await keytar.setPassword(SERVICE, ACCOUNT, JSON.stringify(credentials));
}

// Fetch the credentials from the keychain.
export async function getCredentials(): Promise<StoredCredentials | null> {
  const raw = await keytar.getPassword(SERVICE, ACCOUNT);
  
  // If no credentials exist, return null.
  if (!raw) return null;
  return JSON.parse(raw) as StoredCredentials;
}

// Clear the credentials on logout.
export async function clearCredentials(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}

// Get the valid token, otherwise refresh if expired.
export async function getValidToken(): Promise<string | null> {
  const credentials = await getCredentials();

  // Return null if no credentials are found.
  if (!credentials) return null;

  // Return the credentials if it is valid.
  if (Date.now() < credentials.expiresAt) {
    return credentials.accessToken;
  }

  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
}
