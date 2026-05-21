/**
 * /api/getHeatmap - Industry Heatmap API
 * Returns market-cap-weighted treemap data grouped by industry
 * Uses FinMind TaiwanStockInfo + TaiwanStockPER for latest prices
 */

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiQ2xhcmEiLCJlbWFpbCI6ImNhbmR5ODg4MjFAZ21haWwuY29tIiwidG9rZW5fdmVyc2lvbiI6MH0.GWaHJvAh2dbJXqAOMv2KQTYtyAku7bHqUUPSUUWUQso';

let heatmapCache = { data: null, ts: 0 };
const CACHE_TTL = 4 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  try {
    if (heatmapCache.data && Date.now() - heatmapCache.ts < CACHE_TTL) {
      return res.status(200).json({ ...heatmapCache.data, cached: true });
    }

    // Fetch stock info (industry classification) and latest prices
    const [infoData, priceData] = await Promise.all([
      fetchFinMind('TaiwanStockInfo'),
      fetchLatestPrices(),
    ]);

    // Build stock map with industry
    const stockMap = {};
    for (const row of infoData) {
      if (row.type !== 'twse' && row.type !== 'tpex') continue;
      stockMap[row.stock_id] = {
        id: row.stock_id,
        name: row.stock_name || row.stock_id,
        industry: row.industry_category || 'Other',
      };
    }

    // Merge price data
    for (const row of priceData) {
      if (stockMap[row.stock_id]) {
        stockMap[row.stock_id].close = row.close_price;
        stockMap[row.stock_id].change = row.change || 0;
        stockMap[row.stock_id].changePct = row.change_pct || 0;
        stockMap[row.stock_id].marketCap = row.market_cap || 0;
      }
    }

    // Group by industry
    const industries = {};
    for (const stock of Object.values(stockMap)) {
      if (!stock.close || !stock.industry) continue;
      if (!industries[stock.industry]) {
        industries[stock.industry] = { name: stock.industry, stocks: [], totalCap: 0 };
      }
      industries[stock.industry].stocks.push(stock);
      industries[stock.industry].totalCap += stock.marketCap || 1;
    }

    // Build treemap structure
    const treemapData = Object.values(industries)
      .filter(ind => ind.stocks.length > 0)
      .sort((a, b) => b.totalCap - a.totalCap)
      .slice(0, 30) // Top 30 industries
      .map(ind => ({
        name: ind.name,
        value: ind.totalCap,
        children: ind.stocks
          .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
          .slice(0, 20) // Top 20 stocks per industry
          .map(s => ({
            name: `${s.id}\n${s.name}`,
            value: s.marketCap || 1,
            changePct: s.changePct || 0,
            id: s.id,
            close: s.close,
          })),
      }));

    const result = { treemapData, date: new Date().toISOString().split('T')[0] };
    heatmapCache = { data: result, ts: Date.now() };
    return res.status(200).json({ ...result, cached: false });
  } catch (err) {
    console.error('getHeatmap error:', err);
    return res.status(500).json({ error: 'Heatmap failed: ' + err.message });
  }
};

async function fetchFinMind(dataset) {
  const url = `${FINMIND_BASE}?dataset=${dataset}&token=${TOKEN}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FinMind ${dataset} HTTP ${resp.status}`);
  const json = await resp.json();
  return json.data || [];
}

async function fetchLatestPrices() {
  const startDate = getRecentDate(7);
  const url = `${FINMIND_BASE}?dataset=TaiwanStockPER&start_date=${startDate}&token=${TOKEN}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FinMind prices HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json.data || json.data.length === 0) return [];

  // Get latest date only
  const dates = [...new Set(json.data.map(r => r.date))].sort();
  const latestDate = dates[dates.length - 1];
  const prevDate = dates.length > 1 ? dates[dates.length - 2] : null;

  const latest = json.data.filter(r => r.date === latestDate);
  const prev = prevDate ? json.data.filter(r => r.date === prevDate) : [];
  const prevMap = {};
  for (const r of prev) prevMap[r.stock_id] = r;

  return latest.map(r => {
    const p = prevMap[r.stock_id];
    const change = p ? r.close_price - p.close_price : 0;
    const changePct = p && p.close_price ? ((change / p.close_price) * 100) : 0;
    return {
      stock_id: r.stock_id,
      close_price: r.close_price,
      change: Math.round(change * 100) / 100,
      change_pct: Math.round(changePct * 100) / 100,
      market_cap: r.close_price * 1000, // Approximation without shares outstanding
    };
  });
}

function getRecentDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split('T')[0];
}