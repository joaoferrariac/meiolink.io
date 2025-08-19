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
