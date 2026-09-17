// usage: node q.js <sqlfile>
const fs = require('fs');
const https = require('https');
const sql = fs.readFileSync(process.argv[2], 'utf8');
const key = process.env.METABASE_API_KEY;
const body = JSON.stringify({ database: 113, type: 'native', native: { query: sql } });
const req = https.request({
  hostname: 'metabase.wiom.in', path: '/api/dataset', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'Content-Length': Buffer.byteLength(body) }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    let j;
    try { j = JSON.parse(d); } catch (e) { console.log('RAW:', d.slice(0, 3000)); return; }
    if (j.error || j.status === 'failed') {
      console.log('ERROR:', JSON.stringify(j.error || j.data || j, null, 1).slice(0, 3000));
      return;
    }
    const cols = j.data.cols.map(c => c.name);
    const rows = j.data.rows;
    console.log(cols.join('\t'));
    rows.forEach(r => console.log(r.map(v => v === null ? 'NULL' : String(v)).join('\t')));
    console.log(`\n[${rows.length} rows]`);
  });
});
req.on('error', e => console.log('REQERR', e.message));
req.write(body); req.end();
