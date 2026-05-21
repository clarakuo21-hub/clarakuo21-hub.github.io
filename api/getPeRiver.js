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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// PE Band multipliers
const PE_BANDS = [5.1, 9.8, 14.5, 19.2, 23.8, 28.5];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

// Fetch monthly OHLC + PE from TWSE in one pass per month
async function fetchMonthData(stockNo, year, month) {
  const dateStr = `${year}${String(month).padStart(2, '0')}01`;

  // Fetch stock prices
  const priceUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${stockNo}`;
  const priceRes = await fetch(priceUrl, { headers: HEADERS });
  const priceJson = await priceRes.json();

  if (priceJson.stat !== 'OK' || !priceJson.data || priceJson.data.length === 0) {
    return null;
  }

  // Parse daily prices
  const dailyPrices = priceJson.data.map((row) => ({
    open: parseFloat(row[3].replace(/,/g, '')),
    high: parseFloat(row[4].replace(/,/g, '')),
    low: parseFloat(row[5].replace(/,/g, '')),
    close: parseFloat(row[6].replace(/,/g, '')),
  })).filter((d) => !isNaN(d.close));

  if (dailyPrices.length === 0) return null;

  const ohlc = {
    open: dailyPrices[0].open,
    high: Math.max(...dailyPrices.map((d) => d.high)),
    low: Math.min(...dailyPrices.map((d) => d.low)),
    close: dailyPrices[dailyPrices.length - 1].close,
  };

  await delay(150);

  // Fetch PE ratio from BWIBBU_d
  const peUrl = `https://www.twse.com.tw/exchangeReport/BWIBBU_d?response=json&date=${dateStr}&stockNo=${stockNo}`;
  const peRes = await fetch(peUrl, { headers: HEADERS });
  const peJson = await peRes.json();

  let monthlyPE = null;
  if (peJson.stat === 'OK' && peJson.data && peJson.data.length > 0) {
    // BWIBBU_d: [日期, 殖利率(%), 股利年度, 本益比, 股價淨值比, 財報年/季]
    for (let i = peJson.data.length - 1; i >= 0; i--) {
      const peValue = parseFloat(peJson.data[i][3]);
      if (!isNaN(peValue) && peValue > 0) {
        monthlyPE = peValue;
        break;
      }
    }
  }

  const impliedEPS = monthlyPE ? Math.round((ohlc.close / monthlyPE) * 100) / 100 : null;

  return { date: `${year}/${String(month).padStart(2, '0')}`, ohlc, pe: monthlyPE, impliedEPS };
}

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
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Build list of last 18 months
    const monthsToFetch = [];
    let y = currentYear, m = currentMonth;
    for (let i = 0; i < 18; i++) {
      monthsToFetch.unshift({ year: y, month: m });
      m--;
      if (m === 0) { m = 12; y--; }
    }

    const results = [];
    for (const { year, month } of monthsToFetch) {
      await delay(200);
      const data = await fetchMonthData(stockNo, year, month);
      if (data) results.push(data);
    }

    if (results.length === 0) {
      return res.status(404).json({ error: '無法取得股價資料，請確認股票代號' });
    }

    // Forward-fill EPS for months without PE data
    const epsTimeline = [];
    let lastKnownEPS = null;
    for (const r of results) {
      if (r.impliedEPS) lastKnownEPS = r.impliedEPS;
      epsTimeline.push(lastKnownEPS);
    }
    // Back-fill if first months have no EPS
    const firstKnown = epsTimeline.find((e) => e !== null);
    for (let i = 0; i < epsTimeline.length; i++) {
      if (epsTimeline[i] === null) epsTimeline[i] = firstKnown || 0;
    }

    const latestEPS = epsTimeline[epsTimeline.length - 1];
    const lastResult = results[results.length - 1];
    const currentPE = lastResult.pe ? Math.round(lastResult.pe * 100) / 100 : null;

    // Build PE river bands
    const peRiverBands = PE_BANDS.map((pe) => ({
      peRatio: pe,
      label: `${pe}倍`,
      values: epsTimeline.map((eps) => Math.round(eps * pe * 100) / 100),
    }));

    const riverData = {
      stockNo,
      latestEPS,
      currentPE,
      peBands: PE_BANDS,
      dates: results.map((r) => r.date),
      klineData: results.map((r) => [r.ohlc.open, r.ohlc.close, r.ohlc.low, r.ohlc.high]),
      peRiverBands,
      lastPrice: lastResult.ohlc,
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