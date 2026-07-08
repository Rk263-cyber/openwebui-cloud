const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.zjdtpgletuwzixhbmvrx:Corntold123map!@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });
client.connect()
  .then(() => client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'chat'"))
  .then(res => console.log(res.rows))
  .finally(() => client.end());
