const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.zjdtpgletuwzixhbmvrx:Corntold123map!@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });
client.connect()
  .then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
  .then(res => {
    console.log("Tables:", res.rows.map(r => r.table_name));
    return Promise.all(res.rows.map(r => 
      client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${r.table_name}'`)
        .then(cRes => console.log(`\nTable ${r.table_name}:`, cRes.rows))
    ));
  })
  .finally(() => client.end());
