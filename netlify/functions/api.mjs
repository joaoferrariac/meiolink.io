import express from 'express';
import serverless from 'serverless-http';
import { neon } from '@neondatabase/serverless';
import { nanoid } from 'nanoid';
import cors from 'cors';
import 'dotenv/config';

// Inicialização preguiçosa do cliente SQL para capturar melhor erros de env
let sqlInstance = null;
function getSql(){
  if(!sqlInstance){
    const cs = process.env.NEON_DATABASE_URL;
    if(!cs){
      console.error('NEON_DATABASE_URL não definido nas variáveis de ambiente');
      throw new Error('Configuração de banco ausente (NEON_DATABASE_URL)');
    }
    try {
      sqlInstance = neon(cs);
    } catch(e){
      console.error('Falha ao inicializar cliente Neon', e);
      throw e;
    }
  }
  return sqlInstance;
}

// Garante migração básica
async function ensureTables(){
  const sql = getSql();
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
// Normaliza prefixo /api em ambientes onde redirect mantém /api
app.use((req, _res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.substring(4); // remove /api
  } else if (req.url === '/api' || req.url === '/api/') {
    req.url = '/';
  }
  next();
});

// Encapsula inicialização lazy
let readyPromise = null;
function ready(){
  if(!readyPromise){
    readyPromise = ensureTables().catch(e => {
      // Permite nova tentativa em próxima chamada se falhar
      readyPromise = null;
      throw e;
    });
  }
  return readyPromise;
}

// Aceita tanto /shorten quanto /api/shorten (via middleware acima)
app.post(['/shorten','/api/shorten'], async (req, res) => {
  const started = Date.now();
  try {
    await ready();
    const { url } = req.body;
    if(!url) return res.status(400).json({ error: 'URL obrigatória' });
    const code = nanoid(6);
    const sql = getSql();
    await sql`INSERT INTO links (code, original_url) VALUES (${code}, ${url})`;
    const host = process.env.BASE_URL || `${req.headers['x-forwarded-proto']||'https'}://${req.headers['x-forwarded-host']||req.headers.host}`;
    const shortUrl = `${host}/${code}`;
    res.json({ shortUrl, code });
    console.log('SHORTEN ok', { code, ms: Date.now()-started });
  } catch (e){
    console.error('Erro /shorten', { msg: e.message, stack: e.stack });
    res.status(500).json({ error: 'Erro ao encurtar', detail: e.message });
  }
});

app.get(['/stats/:code','/api/stats/:code'], async (req, res) => {
  try {
    await ready();
    const { code } = req.params;
    const sql = getSql();
    const rows = await sql`SELECT code, original_url as "originalUrl", clicks, created_at as "createdAt" FROM links WHERE code = ${code}`;
    if(rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch(e){
    console.error('Erro /stats', { msg: e.message, stack: e.stack });
    res.status(500).json({ error: 'Erro', detail: e.message });
  }
});

app.get(['/list','/api/list'], async (req, res) => {
  try {
    await ready();
    const limit = parseInt(req.query.limit) || 50;
    const sql = getSql();
    const rows = await sql`SELECT code, original_url as "originalUrl", clicks, created_at as "createdAt" FROM links ORDER BY created_at DESC LIMIT ${limit}`;
    res.json(rows);
  } catch(e){
    console.error('Erro /list', { msg: e.message, stack: e.stack });
    res.status(500).json({ error: 'Erro', detail: e.message });
  }
});

// Redirecionamento + incremento de clique
app.get('/:code', async (req, res) => {
  try {
    await ready();
    const { code } = req.params;
    const sql = getSql();
    const rows = await sql`UPDATE links SET clicks = clicks + 1 WHERE code = ${code} RETURNING original_url`;
    if(rows.length === 0) return res.status(404).send('Link não encontrado');
    res.redirect(rows[0].original_url);
  } catch(e){
    console.error('Erro redirect', { msg: e.message, stack: e.stack });
    res.status(500).send('Erro interno');
  }
});

// Health check (diagnóstico)
app.get(['/health','/api/health'], async (req, res) => {
  const status = { ok: true };
  status.env = { hasNeon: !!process.env.NEON_DATABASE_URL, baseUrl: !!process.env.BASE_URL };
  try {
    await ready();
    const sql = getSql();
    const r = await sql`SELECT 1 as ok`;
    status.db = { reachable: true, result: r[0] };
  } catch(e){
    status.db = { reachable: false, error: e.message };
    status.ok = false;
  }
  res.json(status);
});

export const handler = serverless(app);
