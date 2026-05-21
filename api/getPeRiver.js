const { RestClient } = require('@fugle/marketdata');

const client = new RestClient({ apiKey: 'MTc0YzgwZmQtY2MzZS00YjllLWEwNzEtYmIyNjMwMjJhY2NkIDc3ZGU2YzlkLTA1NWUtNDY4OS04NDdhLTY4NzMyM2UxZmJlMg==' });
const stock = client.stock;

// In-memory cache for warm serverless instances
const cache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// PE Band multipliers
const PE_BANDS = [5.1, 9.8, 14.5, 19.2, 23.8, 28.5];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const stockNo = req.query.stock;
  if (!stockNo || !/^\d{4,6}$/.test(stockNo)) {
    return res.status(400).json({ error: '請提供有效的股票代號 (stock=XXXX)' });
  }

  const cacheKey = `pe_river_${stockNo}`;
  const cached = getCached(cacheKey);
  if (cached) return res.status(200).json({ ...cached, cached: true });

  try {
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setMonth(fromDate.getMonth() - 18);
    const fromStr = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const toStr = now.toISOString().split('T')[0];

    // Fetch monthly candles from Fugle (single API call for all 18 months)
    const candles = await stock.historical.candles({
      symbol: stockNo,
      from: fromStr,
      to: toStr,
      timeframe: 'M',
    });

    if (!candles || !candles.data || candles.data.length === 0) {
      return res.status(404).json({ error: '無法取得股價資料，請確認股票代號' });
    }

    // Sort by date ascending
    const sortedCandles = candles.data.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Get current PE ratio from intraday quote
    let currentPE = null;
    let latestEPS = null;
    try {
      const quote = await stock.intraday.quote({ symbol: stockNo });
      if (quote && quote.priceEarningRatio) {
        currentPE = quote.priceEarningRatio;
      }
    } catch (e) {
      // quote might not be available for some stocks
    }

    // If we have PE from quote, calculate implied EPS
    const lastCandle = sortedCandles[sortedCandles.length - 1];
    if (currentPE && lastCandle) {
      latestEPS = Math.round((lastCandle.close / currentPE) * 100) / 100;
    }

    // If no PE from quote, try historical stats
    if (!latestEPS) {
      try {
        const stats = await stock.historical.stats({ symbol: stockNo });
        if (stats && stats.priceEarningRatio) {
          currentPE = stats.priceEarningRatio;
          latestEPS = Math.round((lastCandle.close / currentPE) * 100) / 100;
        }
      } catch (e) {}
    }

    if (!latestEPS) {
      return res.status(404).json({ error: '無法取得本益比資料（該股票可能無本益比數據）' });
    }

    // Build monthly data with forward-filled EPS
    // For simplicity, use the latest implied EPS for all PE band calculations
    // (PE from TWSE/Fugle already reflects TTM earnings)
    const dates = sortedCandles.map((c) => {
      const d = new Date(c.date);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const klineData = sortedCandles.map((c) => [c.open, c.close, c.low, c.high]);

    // Use latestEPS uniformly for river bands (TTM EPS doesn't change dramatically month-to-month)
    const epsTimeline = sortedCandles.map(() => latestEPS);

    // Build PE river bands
    const peRiverBands = PE_BANDS.map((pe) => ({
      peRatio: pe,
      label: `${pe}倍`,
      values: epsTimeline.map((eps) => Math.round(eps * pe * 100) / 100),
    }));

    const riverData = {
      stockNo,
      latestEPS,
      currentPE: currentPE ? Math.round(currentPE * 100) / 100 : null,
      peBands: PE_BANDS,
      dates,
      klineData,
      peRiverBands,
      lastPrice: {
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      },
      epsTimeline,
      generatedAt: new Date().toISOString(),
    };

    setCache(cacheKey, riverData);
    return res.status(200).json(riverData);
  } catch (err) {
    console.error('getPeRiver error:', err);
    return res.status(500).json({ error: '伺服器錯誤', detail: err.message });
  }
};