import { getValidToken } from './auth.js';

// Checks if valid auth token is present and handles the flow if the token is null
export async function requireAuth(): Promise<string> {
  const token = await getValidToken();
  if (!token) {
    console.error('Not logged in. Run: `codegoat auth login`');
    process.exit(1);
  }

  return token;
}
