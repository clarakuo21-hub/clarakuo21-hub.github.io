/**
 * Shared navigation component for all pages.
 * Auto-injects nav bar and handles stock search navigation.
 */
(function () {
  const pages = [
    { href: 'index.html', label: '首頁' },
    { href: 'chart.html', label: 'K線分析' },
    { href: 'financials.html', label: '財報' },
    { href: 'valuation.html', label: '估值走勢' },
    { href: 'screener.html', label: '選股' },
    { href: 'heatmap.html', label: '熱力圖' },
  ];

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const stock = new URLSearchParams(window.location.search).get('stock') || '';

  const nav = document.createElement('nav');
  nav.className = 'nav-bar';
  nav.innerHTML = `
    <div class="nav-brand">台股分析</div>
    <div class="nav-links">
      ${pages.map(p => {
        const href = stock ? `${p.href}?stock=${stock}` : p.href;
        const cls = p.href === currentPage ? 'active' : '';
        return `<a href="${href}" class="${cls}">${p.label}</a>`;
      }).join('')}
    </div>
    <div class="nav-search">
      <input type="text" id="navStockInput" placeholder="代號" value="${stock}" maxlength="6" />
      <button id="navSearchBtn">查詢</button>
    </div>
  `;
  document.body.prepend(nav);

  // Search handler
  const input = document.getElementById('navStockInput');
  const btn = document.getElementById('navSearchBtn');
  btn.addEventListener('click', () => {
    const val = input.value.trim();
    if (val && /^\d{4,6}$/.test(val)) {
      const base = currentPage || 'chart.html';
      window.location.href = `${base}?stock=${val}`;
    }
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });

  // Expose utility
  window.NavUtil = {
    getStock: () => new URLSearchParams(window.location.search).get('stock') || '',
    navigate: (page, stockId) => {
      window.location.href = stockId ? `${page}?stock=${stockId}` : page;
    }
  };
})();