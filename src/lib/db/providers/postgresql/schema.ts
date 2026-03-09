import { PoolClient } from 'pg';

export async function initializeSchema(client: PoolClient): Promise<void> {
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  } catch (error) {
    console.warn('[PostgreSQLProvider] Failed to ensure pgcrypto extension', error);
  }
}
