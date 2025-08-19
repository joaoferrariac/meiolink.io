# meiolink

Encurtador de URLs com contagem de cliques.

## Endpoints

POST /api/shorten
Body JSON: { "url": "https://exemplo.com" }
Resposta: { "shortUrl": "http://localhost:3000/abc123", "code": "abc123" }

GET /:code -> Redireciona e incrementa contagem
GET /api/stats/:code -> { originalUrl, code, clicks, createdAt }
GET /api/list -> Lista todos

## Rodar
npm install
npm run dev

## Variáveis de Ambiente

Crie um arquivo `.env` (para uso local) baseado em `.env.example`:

```
NEON_DATABASE_URL=postgresql://usuario:senha@host/db?sslmode=require
BASE_URL=http://localhost:3000
```

No deploy (Netlify):
1. Acesse Site settings > Build & deploy > Environment > Environment variables.
2. Adicione `NEON_DATABASE_URL` com a connection string completa do Neon (começa com `postgresql://`).
3. (Opcional) Adicione `BASE_URL` com o domínio final (ex: `https://meiolink.io`).
4. Salve e force um novo deploy (Trigger deploy > Clear cache and deploy site) para garantir que a função receba as variáveis.

Sem `NEON_DATABASE_URL` a API retornará erro: `Configuração de banco ausente (NEON_DATABASE_URL)`.

## Health Check

Endpoint: `/api/health` retorna JSON com status e se o banco está acessível.

## Deploy Local x Produção

- Local (`server.js`) usa somente o frontend (JSON antigo não é mais usado em produção).
- Produção usa função serverless em `netlify/functions/api.mjs` com PostgreSQL (Neon).

## Segurança

Rotacione a senha da connection string se ela tiver sido exposta publicamente e atualize a variável no painel da Netlify.
