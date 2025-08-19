import express from 'express';
import { nanoid } from 'nanoid';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const DATA_FILE = path.join(__dirname, 'links.json');
function loadData(){
  try {
    const raw = fs.readFileSync(DATA_FILE,'utf-8');
    return JSON.parse(raw);
  } catch { return []; }
}
function saveData(data){
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
let links = loadData();

app.use(cors());
app.use(express.json());
// Servir frontend estático moderno
app.use(express.static(path.join(__dirname, 'public')));

// Estrutura: { code, originalUrl, clicks, createdAt }

// Endpoint para encurtar URL
app.post('/api/shorten', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });
  const code = nanoid(6);
  const now = new Date().toISOString();
  links.push({ code, originalUrl: url, clicks: 0, createdAt: now });
  saveData(links);
  const shortUrl = `${req.protocol}://${req.get('host')}/${code}`;
  res.json({ shortUrl, code });
});

// Redirecionamento e contagem de cliques
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const link = links.find(l => l.code === code);
  if (!link) return res.status(404).send('Link não encontrado');
  link.clicks += 1;
  saveData(links);
  res.redirect(link.originalUrl);
});

// Estatísticas de um link
app.get('/api/stats/:code', (req, res) => {
  const { code } = req.params;
  const link = links.find(l => l.code === code);
  if (!link) return res.status(404).json({ error: 'Link não encontrado' });
  res.json(link);
});

// Lista todos (paginado simples)
app.get('/api/list', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const sorted = [...links].sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted.slice(offset, offset + limit));
});

// Rota raiz entrega o index.html construído
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor ouvindo na porta', PORT));
