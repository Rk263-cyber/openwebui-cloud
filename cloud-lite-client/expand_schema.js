const { Client } = require('pg');
require('dotenv').config();

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await pgClient.connect();
  console.log("Connected to Supabase Postgres.");

  try {
    // 1. Alter 'chat' table
    await pgClient.query(`
      ALTER TABLE chat 
      ADD COLUMN IF NOT EXISTS share_id TEXT,
      ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS folder_id TEXT;
    `);
    console.log("Successfully altered 'chat' table.");

    // 2. Alter 'cloud_message' table
    await pgClient.query(`
      ALTER TABLE cloud_message 
      ADD COLUMN IF NOT EXISTS parent_id TEXT,
      ADD COLUMN IF NOT EXISTS files JSONB,
      ADD COLUMN IF NOT EXISTS sources JSONB,
      ADD COLUMN IF NOT EXISTS embeds JSONB,
      ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS status_history JSONB,
      ADD COLUMN IF NOT EXISTS error JSONB,
      ADD COLUMN IF NOT EXISTS usage JSONB,
      ADD COLUMN IF NOT EXISTS context_summary TEXT;
    `);
    console.log("Successfully altered 'cloud_message' table.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pgClient.end();
  }
}

run();
