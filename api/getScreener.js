/**
 * /api/getScreener - Stock Screener API
 * Params: ?pe_min=5&pe_max=20&pb_min=0.5&pb_max=3&yield_min=3&roe_min=10&page=1&limit=30
 * Uses FinMind TaiwanStockPER (PE/PB/Yield data)
 */

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiQ2xhcmEiLCJlbWFpbCI6ImNhbmR5ODg4MjFAZ21haWwuY29tIiwidG9rZW5fdmVyc2lvbiI6MH0.GWaHJvAh2dbJXqAOMv2KQTYtyAku7bHqUUPSUUWUQso';

// Cache for the full market data (refreshed every 8h)
let marketCache = { data: null, ts: 0 };
const CACHE_TTL = 8 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  const params = {
    pe_min: parseFloat(req.query.pe_min) || 0,
    pe_max: parseFloat(req.query.pe_max) || 9999,
    pb_min: parseFloat(req.query.pb_min) || 0,
    pb_max: parseFloat(req.query.pb_max) || 9999,
    yield_min: parseFloat(req.query.yield_min) || 0,
    yield_max: parseFloat(req.query.yield_max) || 9999,
    page: parseInt(req.query.page) || 1,
    limit: Math.min(parseInt(req.query.limit) || 30, 100),
  };

  try {
    const allStocks = await getMarketData();
    // Apply filters
    let filtered = allStocks.filter(s => {
      if (s.pe === null || s.pe <= 0) return false;
      if (s.pe < params.pe_min || s.pe > params.pe_max) return false;
      if (s.pb < params.pb_min || s.pb > params.pb_max) return false;
      if (s.yield < params.yield_min || s.yield > params.yield_max) return false;
      return true;
    });

    // Sort by dividend yield descending (default)
    filtered.sort((a, b) => b.yield - a.yield);

    const total = filtered.length;
    const start = (params.page - 1) * params.limit;
    const paged = filtered.slice(start, start + params.limit);

    return res.status(200).json({
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
      stocks: paged,
      cached: Date.now() - marketCache.ts < 60000,
    });
  } catch (err) {
    console.error('getScreener error:', err);
    return res.status(500).json({ error: 'Screener failed: ' + err.message });
  }
};

async function getMarketData() {
  if (marketCache.data && Date.now() - marketCache.ts < CACHE_TTL) {
    return marketCache.data;
  }

  // Get the latest trading day's PE/PB/Yield for all stocks
  const today = new Date().toISOString().split('T')[0];
  const startDate = getRecentDate(7); // Last 7 days to ensure we get latest trading day

  const url = `${FINMIND_BASE}?dataset=TaiwanStockPER&start_date=${startDate}&token=${TOKEN}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FinMind HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json.data || json.data.length === 0) throw new Error('No market data returned');

  // Get latest date's data
  const dates = [...new Set(json.data.map(r => r.date))].sort();
  const latestDate = dates[dates.length - 1];
  const latestData = json.data.filter(r => r.date === latestDate);

  // Transform to our format
  const stocks = latestData.map(row => ({
    id: row.stock_id,
    name: row.stock_name || row.stock_id,
    pe: round(row.PER),
    pb: round(row.PBR),
    yield: round(row.dividend_yield),
    close: row.close_price || null,
    date: latestDate,
  })).filter(s => s.id && s.pe !== null);

  marketCache = { data: stocks, ts: Date.now() };
  return stocks;
}

function getRecentDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split('T')[0];
}

function round(v) {
  if (v === null || v === undefined || isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}