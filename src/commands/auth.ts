import { Command } from 'commander';
import { clearCredentials } from '../lib/auth.js';
import { getUserInfo, loginWithDeviceFlow } from '../lib/auth0.js';
import { requireAuth } from '../lib/requireAuth.js';

export const authCommand = new Command('auth')
  .description('Manage authentication');

// Login flow, saves access and refresh tokens in the keychain.
authCommand
  .command('login')
  .description('Log in or create an account')
  .action(async () => {
    try {
      await loginWithDeviceFlow();
      console.log('Logged in successfully.');
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Login failed.');
      process.exit(1);
    }
  });

// Logout flow, clears out the tokens from the keychain.
authCommand
  .command('logout')
  .description('Log out and clear stored credentials')
  .action(async () => {
    await clearCredentials();
    console.log('Logged out.');
  });

// Checks to see which user is authenticated.
authCommand
  .command('whoami')
  .description('Show the currently logged-in user')
  .action(async () => {
    try {
      const token = await requireAuth();
      const user = await getUserInfo(token);
      console.log(user.email ?? user.name ?? 'Logged in.');
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Not logged in.');
      process.exit(1);
    }
  });
