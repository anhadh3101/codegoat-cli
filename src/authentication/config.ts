import path from 'node:path';
import dotenv from 'dotenv';

// Resolve configuration from CodeGoat's installation directory instead of
// process.cwd(), so the CLI behaves consistently from any workspace.
dotenv.config({
  path: path.resolve(import.meta.dirname, '../../.env'),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const auth0Config = {
  domain: requireEnv('AUTH0_DOMAIN'),
  clientId: requireEnv('AUTH0_CLIENT_ID'),
  audience: process.env.AUTH0_AUDIENCE,
};
