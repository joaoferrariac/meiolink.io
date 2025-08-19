import express from 'express';
import serverless from 'serverless-http';
import { neon } from '@neondatabase/serverless';
import { nanoid } from 'nanoid';
import cors from 'cors';

// Obtém URL de conexão Neon do env: NEON_DATABASE_URL
const sql = neon(process.env.NEON_DATABASE_URL);

// Garante migração básica
async function ensureTables(){
  await sql`CREATE TABLE IF NOT EXISTS links (
    id serial primary key,
    code varchar(16) UNIQUE NOT NULL,
    original_url text NOT NULL,
    clicks integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  );`;
}

const app = express();
app.use(cors());
app.use(express.json());

// Encapsula inicialização lazy
let readyPromise = null;
function ready(){
  if(!readyPromise){
    readyPromise = ensureTables();
  }
  return readyPromise;
}

app.post('/api/shorten', async (req, res) => {
  try {
    await ready();
    const { url } = req.body;
    if(!url) return res.status(400).json({ error: 'URL obrigatória' });
    const code = nanoid(6);
    await sql`INSERT INTO links (code, original_url) VALUES (${code}, ${url})`;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const shortUrl = `${proto}://${host}/${code}`;
    res.json({ shortUrl, code });
  } catch (e){
    console.error(e);
    res.status(500).json({ error: 'Erro ao encurtar' });
  }
});

app.get('/api/stats/:code', async (req, res) => {
  try {
    await ready();
    const { code } = req.params;
    const rows = await sql`SELECT code, original_url as "originalUrl", clicks, created_at as "createdAt" FROM links WHERE code = ${code}`;
    if(rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e){
    res.status(500).json({ error: 'Erro' });
  }
});

app.get('/api/list', async (req, res) => {
  try {
    await ready();
    const limit = parseInt(req.query.limit) || 50;
    const rows = await sql`SELECT code, original_url as "originalUrl", clicks, created_at as "createdAt" FROM links ORDER BY created_at DESC LIMIT ${limit}`;
    res.json(rows);
  } catch(e){
    res.status(500).json({ error: 'Erro' });
  }
});

// Redirecionamento + incremento de clique
app.get('/:code', async (req, res) => {
  try {
    await ready();
    const { code } = req.params;
    const rows = await sql`UPDATE links SET clicks = clicks + 1 WHERE code = ${code} RETURNING original_url`;
    if(rows.length === 0) return res.status(404).send('Link não encontrado');
    res.redirect(rows[0].original_url);
  } catch(e){
    res.status(500).send('Erro interno');
  }
});

export const handler = serverless(app);
