const express = require('express');
const { Pool } = require('pg');
const _ = require('lodash');

const app = express();
const PORT = process.env.PORT || 3000;

// VULNERABLE (on purpose): secret hardcoded directly in source.
// A real secrets scanner (Gitleaks) should flag this immediately.
const STRIPE_API_KEY = 'sk_live_51H8x2KZvKYlo2CnFAKEEXAMPLEKEYDONOTUSE0001';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'lab',
  password: process.env.DB_PASSWORD || 'lab',
  database: process.env.DB_NAME || 'labdb',
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'devsecops-lab-app' });
});

// VULNERABLE (on purpose): SQL injection via string concatenation (CWE-89).
// A SAST tool (Semgrep) should flag the untrusted `term` being concatenated
// straight into the query string.
app.get('/search', async (req, res) => {
  const term = req.query.term || '';
  const query = "SELECT id, name FROM products WHERE name = '" + term + "'";
  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'query failed', detail: err.message });
  }
});

app.get('/config', (req, res) => {
  res.json({ billingProvider: 'stripe', keyConfigured: Boolean(STRIPE_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`devsecops-lab-app listening on port ${PORT}`);
  console.log('merged defaults:', _.merge({}, { a: 1 }, { b: 2 }));
});
