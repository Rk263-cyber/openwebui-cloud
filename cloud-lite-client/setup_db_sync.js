const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.zjdtpgletuwzixhbmvrx:Corntold123map!@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });

async function run() {
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cloud_message (
        id VARCHAR PRIMARY KEY,
        conversation_id VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        role VARCHAR NOT NULL,
        content TEXT NOT NULL,
        model VARCHAR,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        device VARCHAR,
        source VARCHAR
      )
    `);
    
    // Create index for fast fetching by conversation
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cloud_msg_conv ON cloud_message(conversation_id)
    `);

    // Create index for sync by updated_at
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cloud_msg_updated ON cloud_message(updated_at)
    `);

    console.log("DB sync setup complete.");
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await client.end();
  }
}
run();
