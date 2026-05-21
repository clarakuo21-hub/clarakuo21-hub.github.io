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

// Delay helper to avoid TWSE rate limiting
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// PE Band multipliers
const PE_BANDS = [5.1, 9.8, 14.5, 19.2, 23.8, 28.5];

// Fetch monthly stock prices from TWSE - returns OHLC data
async function fetchMonthlyPrices(stockNo, year, month) {
  const dateStr = `${year}${String(month).padStart(2, '0')}01`;
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${stockNo}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  const json = await res.json();
  if (json.stat !== 'OK' || !json.data) return [];
  // Each row: [日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數]
  return json.data.map((row) => ({
    date: row[0], // 民國年/月/日
    open: parseFloat(row[3].replace(/,/g, '')),
    high: parseFloat(row[4].replace(/,/g, '')),
    low: parseFloat(row[5].replace(/,/g, '')),
    close: parseFloat(row[6].replace(/,/g, '')),
  }));
}

// Aggregate daily OHLC into monthly OHLC (one candlestick per month)
function aggregateMonthlyOHLC(dailyData) {
  if (dailyData.length === 0) return null;
  return {
    open: dailyData[0].open,
    high: Math.max(...dailyData.map((d) => d.high)),
    low: Math.min(...dailyData.map((d) => d.low)),
    close: dailyData[dailyData.length - 1].close,
  };
}

// Fetch EPS from MOPS (公開資訊觀測站) - quarterly financial data
async function fetchQuarterlyEPS(stockNo, year, season) {
  // year: 民國年, season: 1-4
  const url = `https://mops.twse.com.tw/mops/web/ajax_t163sb04`;
  const body = `encodeURIComponent=1&step=1&firstin=1&off=1&co_id=${stockNo}&year=${year}&season=${String(season).padStart(2, '0')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body,
  });
  const html = await res.text();
  // Parse EPS from HTML table - look for "基本每股盈餘"
  const epsMatch = html.match(/基本每股盈餘[^<]*<[^>]*>[^<]*<[^>]*>([^<]+)/);
  if (epsMatch) {
    const eps = parseFloat(epsMatch[1].replace(/,/g, ''));
    return isNaN(eps) ? null : eps;
  }
  return null;
}

// Calculate trailing 4-quarter EPS for each point in time
function computeTrailingEPS(quarterlyData) {
  // quarterlyData: [{year, season, eps}, ...]
  const result = [];
  for (let i = 3; i < quarterlyData.length; i++) {
    const trailing = quarterlyData.slice(i - 3, i + 1);
    const totalEPS = trailing.reduce((sum, q) => sum + (q.eps || 0), 0);
    result.push({
      year: quarterlyData[i].year,
      season: quarterlyData[i].season,
      trailingEPS: Math.round(totalEPS * 100) / 100,
    });
  }
  return result;
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const stockNo = req.query.stock;
  if (!stockNo || !/^\d{4,6}$/.test(stockNo)) {
    return res.status(400).json({ error: '請提供有效的股票代號 (stock=XXXX)' });
  }

  // Check cache
  const cacheKey = `pe_river_${stockNo}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.status(200).json({ ...cached, cached: true });
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const rocYear = currentYear - 1911; // 民國年

    // Fetch quarterly EPS for last 3 years (12+ quarters for trailing calc)
    const quarterlyData = [];
    for (let y = rocYear - 3; y <= rocYear; y++) {
      const maxSeason = y === rocYear ? Math.min(Math.floor((currentMonth - 1) / 3), 4) : 4;
      for (let s = 1; s <= maxSeason; s++) {
        await delay(350); // Avoid rate limiting
        const eps = await fetchQuarterlyEPS(stockNo, y, s);
        quarterlyData.push({ year: y, season: s, eps: eps || 0 });
      }
    }

    // Compute trailing 4-quarter EPS
    const trailingEPSData = computeTrailingEPS(quarterlyData);
    if (trailingEPSData.length === 0) {
      return res.status(404).json({ error: '無法取得足夠的 EPS 資料' });
    }

    // Fetch monthly stock prices (OHLC) for last 3 years
    const priceData = [];
    for (let y = currentYear - 2; y <= currentYear; y++) {
      const maxMonth = y === currentYear ? currentMonth : 12;
      for (let m = 1; m <= maxMonth; m++) {
        await delay(350);
        const dailyPrices = await fetchMonthlyPrices(stockNo, y, m);
        if (dailyPrices.length > 0) {
          const ohlc = aggregateMonthlyOHLC(dailyPrices);
          priceData.push({
            date: `${y}/${String(m).padStart(2, '0')}`,
            open: ohlc.open,
            high: ohlc.high,
            low: ohlc.low,
            close: ohlc.close,
          });
        }
      }
    }

    // Helper: find trailing EPS for a given date
    function getEPSForDate(dateStr) {
      const parts = dateStr.split('/');
      const priceYear = parseInt(parts[0]);
      const priceMonth = parseInt(parts[1]);
      const rocPriceYear = priceYear - 1911;
      const priceSeason = Math.ceil(priceMonth / 3);
      let matchedEPS = trailingEPSData[trailingEPSData.length - 1].trailingEPS;
      for (let i = trailingEPSData.length - 1; i >= 0; i--) {
        const d = trailingEPSData[i];
        if (d.year < rocPriceYear || (d.year === rocPriceYear && d.season <= priceSeason)) {
          matchedEPS = d.trailingEPS;
          break;
        }
      }
      return matchedEPS;
    }

    const latestEPS = trailingEPSData[trailingEPSData.length - 1]?.trailingEPS || 0;
    const lastPrice = priceData.length > 0 ? priceData[priceData.length - 1] : null;
    const currentPE = lastPrice ? Math.round((lastPrice.close / latestEPS) * 100) / 100 : null;

    // Build PE river bands data
    const peRiverBands = PE_BANDS.map((pe) => ({
      peRatio: pe,
      label: `${pe}倍`,
      values: priceData.map((p) => {
        const eps = getEPSForDate(p.date);
        return Math.round(eps * pe * 100) / 100;
      }),
    }));

    // Build response
    const riverData = {
      stockNo,
      latestEPS,
      currentPE,
      peBands: PE_BANDS,
      trailingEPSHistory: trailingEPSData,
      dates: priceData.map((p) => p.date),
      klineData: priceData.map((p) => [p.open, p.close, p.low, p.high]), // ECharts candlestick format
      peRiverBands,
      lastPrice: lastPrice ? { open: lastPrice.open, high: lastPrice.high, low: lastPrice.low, close: lastPrice.close } : null,
      generatedAt: new Date().toISOString(),
    };

    // Store in cache
    setCache(cacheKey, riverData);

    return res.status(200).json(riverData);
  } catch (err) {
    console.error('getPeRiver error:', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試', detail: err.message });
  }
};
