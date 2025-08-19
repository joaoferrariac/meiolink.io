const form = document.getElementById('formShortener');
const input = document.getElementById('inputUrl');
const result = document.getElementById('result');
const shortLink = document.getElementById('shortLink');
const copyBtn = document.getElementById('copyBtn');
const clickCount = document.getElementById('clickCount');
const inlineStats = document.getElementById('inlineStats');
const listEl = document.getElementById('linksList');
const refreshBtn = document.getElementById('refreshBtn');
const toggleTheme = document.getElementById('toggleTheme');

// Detecta se backend está atrás de /api (Netlify redirect) testando window.location pathname
const API_PREFIX = '/api';
const API = {
  shorten: `${API_PREFIX}/shorten`,
  stats: code => `${API_PREFIX}/stats/${code}`,
  list: `${API_PREFIX}/list`
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = input.value.trim();
  if(!url) return;
  const btn = form.querySelector('button.primary');
  btn.disabled = true; btn.textContent = 'Gerando...';
  try {
    const r = await fetch(API.shorten, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ url }) });
  let j;
  try { j = await r.json(); } catch { j = {}; }
  if(!r.ok) throw new Error(j.detail || j.error || ('Erro ('+r.status+')'));
    showResult(j.shortUrl, j.code);
    input.value='';
  } catch(err){
    showError(err.message);
  } finally { btn.disabled=false; btn.textContent='Encurtar'; }
});

document.getElementById('clearBtn').addEventListener('click', ()=> {
  result.hidden = true;
});

function showResult(url, code){
  result.hidden = false;
  shortLink.href = url;
  shortLink.textContent = url;
  clickCount.textContent = '0 cliques';
  inlineStats.hidden = false;
  // Atualiza cliques em intervalos curtos após criação
  startLiveStats(code);
  fetchList();
}

function showError(msg){
  result.hidden = false;
  shortLink.removeAttribute('href');
  shortLink.textContent = msg;
  inlineStats.hidden = true;
  console.error('Erro frontend:', msg);
}

copyBtn.addEventListener('click', async () => {
  if(!shortLink.href) return;
  try { await navigator.clipboard.writeText(shortLink.href); copyBtn.textContent='✔'; setTimeout(()=>copyBtn.textContent='📋',1200);}catch{}
});

async function fetchStats(code){
  const r = await fetch(API.stats(code));
  if(!r.ok) return null;
  return r.json();
}

function startLiveStats(code){
  let attempts=0;
  const interval = setInterval(async () => {
    attempts++;
    const data = await fetchStats(code);
    if(data){
      clickCount.textContent = data.clicks + (data.clicks === 1 ? ' clique':' cliques');
      if(attempts>120) clearInterval(interval); // para depois de ~2min
    } else {
      clearInterval(interval);
    }
  }, 1000);
}

async function fetchList(){
  try {
    const r = await fetch(API.list);
    if(!r.ok) return;
    const arr = await r.json();
    renderList(arr);
  } catch {}
}

function renderList(items){
  listEl.innerHTML='';
  const tpl = document.getElementById('itemTemplate');
  items.forEach(it => {
    const li = tpl.content.firstElementChild.cloneNode(true);
    const shortA = li.querySelector('.short');
    shortA.href = window.location.origin + '/' + it.code;
    shortA.textContent = window.location.origin + '/' + it.code;
    li.querySelector('.clicks').textContent = it.clicks + ' clq';
    li.querySelector('.orig').textContent = it.originalUrl;
    li.querySelector('.when').textContent = new Date(it.createdAt).toLocaleString();
    listEl.appendChild(li);
  });
}

refreshBtn.addEventListener('click', fetchList);

// Tema
const root = document.documentElement;
function setTheme(mode){ root.setAttribute('data-theme', mode); localStorage.setItem('theme', mode);} 
const saved = localStorage.getItem('theme'); if(saved) setTheme(saved);

toggleTheme.addEventListener('click', () => {
  const current = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  setTheme(current);
});

// Inicial
fetchList();
