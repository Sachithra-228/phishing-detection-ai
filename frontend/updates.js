// Updates page JavaScript - handles Global Threat Updates functionality
document.addEventListener('DOMContentLoaded', () => {
  console.log('Updates page loaded');
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
  
  if (items.length === 0) {
    grid.innerHTML = '<div style="text-align: center; padding: 3rem; color: #a0aec0;"><div style="font-size: 3rem; margin-bottom: 1rem;">📭</div><h3>No threats found</h3><p>Try adjusting your search or filter criteria</p></div>';
    return;
  }
  
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
      grid.innerHTML = '<div style="text-align: center; padding: 3rem; color: #ff7c01;"><div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div><h3>Failed to load threat updates</h3><p>Please try again later or check your connection</p></div>';
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
