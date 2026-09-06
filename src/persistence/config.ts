/**
 * This function returns the value of an environment variable if it is present, otherwise throws an error
 * @param name The name of the environment variable
 * @returns The value of the environment variable
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Export the DB configs for the persistence layer
export const dbConfig = {
  connectionString: requireEnv('PRIMARY_DB_CONNECTION_STRING'),
};
