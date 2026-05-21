/**
 * Stock Chart API - K-line + Technical Indicators
 * 
 * Data source: FinMind TaiwanStockPrice (Free tier, daily OHLCV)
 * Backend calculates: MA(5,10,20,60), MACD(12,26,9), RSI(14), Bollinger(20,2)
 * 
 * Query params:
 *   stock - stock symbol (e.g. 2330)
 *   months - how many months of data (default 6, max 24)
 */

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiQ2xhcmEiLCJlbWFpbCI6ImNhbmR5ODg4MjFAZ21haWwuY29tIiwidG9rZW5fdmVyc2lvbiI6MH0.GWaHJvAh2dbJXqAOMv2KQTYtyAku7bHqUUPSUUWUQso';

// In-memory cache
const cache = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours for intraday relevance

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) { cache.set(key, { data, timestamp: Date.now() }); }

// --- Technical Indicator Calculations ---

function calcMA(closes, period) {
  const result = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result.push(Math.round((sum / period) * 100) / 100);
  }
  return result;
}

function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const dif = emaFast.map((v, i) => Math.round((v - emaSlow[i]) * 100) / 100);
  const dea = calcEMA(dif, signal).map(v => Math.round(v * 100) / 100);
  const histogram = dif.map((v, i) => Math.round((v - dea[i]) * 2 * 100) / 100);
  return { dif, dea, histogram };
}

function calcRSI(closes, period = 14) {
  const rsi = [];
  let avgGain = 0, avgLoss = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { rsi.push(null); continue; }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(Math.round((100 - 100 / (1 + rs)) * 100) / 100);
      } else {
        rsi.push(null);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(Math.round((100 - 100 / (1 + rs)) * 100) / 100);
    }
  }
  return rsi;
}

function calcBollinger(closes, period = 20, mult = 2) {
  const upper = [], middle = [], lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(null); middle.push(null); lower.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const avg = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) sqSum += (closes[j] - avg) ** 2;
    const std = Math.sqrt(sqSum / period);
    middle.push(Math.round(avg * 100) / 100);
    upper.push(Math.round((avg + mult * std) * 100) / 100);
    lower.push(Math.round((avg - mult * std) * 100) / 100);
  }
  return { upper, middle, lower };
}

// Aggregate daily into weekly/monthly OHLCV
function aggregateToWeekly(dailyData) {
  const weeks = [];
  let current = null;
  for (const row of dailyData) {
    const d = new Date(row.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!current || current.key !== weekKey) {
      if (current) weeks.push(current);
      current = { key: weekKey, date: row.date, open: row.open, high: row.max, low: row.min, close: row.close, volume: row.Trading_Volume };
    } else {
      if (row.max > current.high) current.high = row.max;
      if (row.min < current.low) current.low = row.min;
      current.close = row.close;
      current.volume += row.Trading_Volume;
      current.date = row.date;
    }
  }
  if (current) weeks.push(current);
  return weeks;
}

function aggregateToMonthly(dailyData) {
  const months = [];
  let current = null;
  for (const row of dailyData) {
    const monthKey = row.date.substring(0, 7);
    if (!current || current.key !== monthKey) {
      if (current) months.push(current);
      current = { key: monthKey, date: row.date, open: row.open, high: row.max, low: row.min, close: row.close, volume: row.Trading_Volume };
    } else {
      if (row.max > current.high) current.high = row.max;
      if (row.min < current.low) current.low = row.min;
      current.close = row.close;
      current.volume += row.Trading_Volume;
      current.date = row.date;
    }
  }
  if (current) months.push(current);
  return months;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stockNo = req.query.stock;
  const period = req.query.period || 'D'; // D=daily, W=weekly, M=monthly
  const months = Math.min(parseInt(req.query.months) || 6, 24);

  if (!stockNo || !/^\d{4,6}$/.test(stockNo)) {
    return res.status(400).json({ error: '請提供有效的股票代號 (stock=XXXX)' });
  }

  const cacheKey = `chart_${stockNo}_${period}_${months}`;
  const cached = getCached(cacheKey);
  if (cached) return res.status(200).json({ ...cached, cached: true });

  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);
    // Fetch extra data for indicator warm-up (60 days for MA60)
    const fetchStart = new Date(startDate);
    fetchStart.setDate(fetchStart.getDate() - 90);

    const url = new URL(FINMIND_BASE);
    url.searchParams.set('dataset', 'TaiwanStockPrice');
    url.searchParams.set('data_id', stockNo);
    url.searchParams.set('start_date', fetchStart.toISOString().split('T')[0]);
    url.searchParams.set('end_date', now.toISOString().split('T')[0]);
    url.searchParams.set('token', FINMIND_TOKEN);

    const apiRes = await fetch(url.toString());
    const json = await apiRes.json();

    if (json.status !== 200 || !json.data || json.data.length === 0) {
      return res.status(404).json({ error: '無法取得股價資料，請確認股票代號' });
    }

    // Aggregate based on period
    let chartData;
    if (period === 'W') {
      chartData = aggregateToWeekly(json.data);
    } else if (period === 'M') {
      chartData = aggregateToMonthly(json.data);
    } else {
      chartData = json.data.map(r => ({
        date: r.date, open: r.open, high: r.max, low: r.min, close: r.close, volume: r.Trading_Volume
      }));
    }

    // Extract arrays
    const dates = chartData.map(d => d.date);
    const opens = chartData.map(d => d.open);
    const highs = chartData.map(d => d.high);
    const lows = chartData.map(d => d.low);
    const closes = chartData.map(d => d.close);
    const volumes = chartData.map(d => d.volume);

    // Calculate indicators on full dataset
    const ma5 = calcMA(closes, 5);
    const ma10 = calcMA(closes, 10);
    const ma20 = calcMA(closes, 20);
    const ma60 = calcMA(closes, 60);
    const macd = calcMACD(closes);
    const rsi = calcRSI(closes);
    const bollinger = calcBollinger(closes);

    // Trim warm-up period: only return data from startDate onward
    const startStr = startDate.toISOString().split('T')[0];
    let trimIdx = 0;
    if (period === 'D') {
      trimIdx = dates.findIndex(d => d >= startStr);
    }
    if (trimIdx < 0) trimIdx = 0;

    const slice = (arr) => arr.slice(trimIdx);

    const result = {
      stockNo,
      period,
      dates: slice(dates),
      ohlc: slice(dates).map((_, i) => [opens[trimIdx + i], closes[trimIdx + i], lows[trimIdx + i], highs[trimIdx + i]]),
      volume: slice(volumes),
      ma5: slice(ma5),
      ma10: slice(ma10),
      ma20: slice(ma20),
      ma60: slice(ma60),
      macd: {
        dif: slice(macd.dif),
        dea: slice(macd.dea),
        histogram: slice(macd.histogram),
      },
      rsi: slice(rsi),
      bollinger: {
        upper: slice(bollinger.upper),
        middle: slice(bollinger.middle),
        lower: slice(bollinger.lower),
      },
      generatedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return res.status(200).json(result);
  } catch (err) {
    console.error('getStockChart error:', err);
    return res.status(500).json({ error: '伺服器錯誤', detail: err.message });
  }
};
