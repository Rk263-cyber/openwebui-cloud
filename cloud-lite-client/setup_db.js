const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.zjdtpgletuwzixhbmvrx:Corntold123map!@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });

const fallbackModels = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "qwen/qwen3-coder:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
  "nvidia/nemotron-3-super-120b-a12b:free"
];

async function run() {
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        id VARCHAR PRIMARY KEY,
        models_list JSON NOT NULL
      )
    `);
    
    const exists = await client.query(`SELECT id FROM app_config WHERE id = 'default'`);
    if (exists.rows.length === 0) {
      await client.query(`
        INSERT INTO app_config (id, models_list) VALUES ($1, $2)
      `, ['default', JSON.stringify(fallbackModels)]);
    } else {
      await client.query(`
        UPDATE app_config SET models_list = $1 WHERE id = 'default'
      `, [JSON.stringify(fallbackModels)]);
    }
    console.log("DB setup complete.");
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await client.end();
  }
}
run();
