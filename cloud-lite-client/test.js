const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.zjdtpgletuwzixhbmvrx:Corntold123map!@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });

async function run() {
  await client.connect();
  try {
    const CHAT_ID = 'cloud-lite-chat-1';
    const USER_ID = '00000000-0000-0000-0000-000000000000'; 
    const TITLE = 'Cloud Lite Chat';
    const updatedMessages = [{ role: 'user', content: 'test' }];
    
    await client.query(`
      INSERT INTO chat (id, user_id, title, chat, meta, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [CHAT_ID, USER_ID, TITLE, JSON.stringify({ messages: updatedMessages }), '{}', Date.now(), Date.now()]);
    console.log("Success insert");
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    await client.end();
  }
}
run();
