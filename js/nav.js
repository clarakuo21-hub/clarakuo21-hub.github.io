/**
 * Shared navigation component for all pages.
 * Auto-injects nav bar and handles stock search navigation.
 */
(function () {
  const pages = [
    { href: 'index.html', label: '首頁' },
    { href: 'chart.html', label: 'K線技術分析' },
    { href: 'financials.html', label: '財報' },
    { href: 'valuation.html', label: '估值走勢' },
    { href: 'screener.html', label: '選股' },
    { href: 'heatmap.html', label: '熱力圖' },
  ];

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  function getStockFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('stock') || '';
  }

  function navigateToStock(stockNo, page) {
    if (!stockNo || !/^\d{4,6}$/.test(stockNo)) return;
    const target = page || currentPage;
    window.location.href = `${target}?stock=${stockNo}`;
  }

  // Build nav HTML
  const nav = document.createElement('nav');
  nav.className = 'nav-bar';
  nav.innerHTML = `
    <a class="nav-brand" href="index.html">📊 台股分析</a>
    <div class="nav-links">
      ${pages.map(p => `<a href="${p.href}${getStockFromURL() ? '?stock=' + getStockFromURL() : ''}" class="${currentPage === p.href ? 'active' : ''}">${p.label}</a>`).join('')}
    </div>
    <div class="nav-search">
      <input type="text" id="navStockInput" placeholder="股票代號" maxlength="6" value="${getStockFromURL()}" />
      <button id="navSearchBtn">查詢</button>
    </div>
  `;

  // Insert at top of body
  document.body.insertBefore(nav, document.body.firstChild);

  // Event handlers
  const input = document.getElementById('navStockInput');
  const btn = document.getElementById('navSearchBtn');

  btn.addEventListener('click', () => {
    const stockNo = input.value.trim();
    if (currentPage === 'index.html') {
      navigateToStock(stockNo, 'chart.html');
    } else {
      navigateToStock(stockNo);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });

  // Expose utility
  window.NavUtil = {
    getStock: getStockFromURL,
    navigate: navigateToStock,
  };
})();
