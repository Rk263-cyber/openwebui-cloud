const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.zjdtpgletuwzixhbmvrx:Corntold123map!@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });
client.connect()
  .then(() => client.query("SELECT * FROM auth LIMIT 1"))
  .then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    return client.query("SELECT * FROM \"user\" LIMIT 1");
  })
  .then(res => {
    console.log("Users:", JSON.stringify(res.rows, null, 2));
  })
  .catch(console.error)
  .finally(() => client.end());
