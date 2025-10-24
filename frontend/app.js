// Landing page JavaScript - handles only landing page functionality
// Dashboard functionality is now in dashboard.js

document.addEventListener('DOMContentLoaded', () => {
  console.log('Landing page loaded');
  // Initialize news functionality
  initNews();
});

// Global Threat Updates functionality
async function fetchNews() {
  const base = localStorage.getItem('API_BASE') || 'http://localhost:3000';
  try {
    const r = await fetch(base + '/api/news');
    if (!r.ok) throw new Error('API error: ' + r.status);
    return await r.json();
  } catch (e) {
    console.warn('API fetch failed, trying demo data:', e);
    // fallback to bundled demo JSON
    try {
      const r2 = await fetch('./backend/demo/news.sample.json');
      return await r2.json();
    } catch (e2) {
      console.error('Demo data also failed:', e2);
      return [];
    }
  }
}

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  const d = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (d < 60) return d + 's ago';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
}

let NEWS = [];
const grid = document.getElementById('threatGrid');
const searchEl = document.getElementById('thSearch');
const srcEl = document.getElementById('thSource');

function renderNews() {
  if (!grid) return;
  
  const q = (searchEl?.value || '').toLowerCase();
  const src = srcEl?.value || '';
  const items = NEWS.filter(x => {
    const hit = (x.title + ' ' + (x.summary || '')).toLowerCase().includes(q);
    const sOk = !src || x.source === src;
    return hit && sOk;
  });
  
  grid.innerHTML = items.slice(0, 12).map(x => `
    <article class="th-card">
      <div class="meta">
        <span>${x.source}</span>
        <span>•</span>
        <span>${timeAgo(x.published)}</span>
      </div>
      <h3 style="margin:0;font-size:16px;">${x.title}</h3>
      <p style="opacity:.9;margin:0;">${x.summary || ''}</p>
      <div class="badges-container">
        ${(x.tags || []).slice(0, 3).map(t => `<span class="badge">${t}</span>`).join('')}
      </div>
      <div><a href="${x.link}" target="_blank" rel="noopener">Read →</a></div>
    </article>
  `).join('');
}

async function initNews() {
  try {
    NEWS = await fetchNews();
    // Populate sources
    if (srcEl) {
      const sources = Array.from(new Set(NEWS.map(i => i.source))).sort();
      srcEl.innerHTML = '<option value="">All sources</option>' + sources.map(s => `<option>${s}</option>`).join('');
    }
    renderNews();
  } catch (e) {
    console.error('Failed to initialize news:', e);
    if (grid) {
      grid.innerHTML = '<p style="color: #ff7c01; text-align: center; padding: 2rem;">Failed to load threat updates. Please try again later.</p>';
    }
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('thRefresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', initNews);
  }
  
  if (searchEl) {
    searchEl.addEventListener('input', renderNews);
  }
  
  if (srcEl) {
    srcEl.addEventListener('change', renderNews);
  }
  
  // Auto-refresh every 15 minutes
  setInterval(initNews, 15 * 60 * 1000);
});