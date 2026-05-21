/**
 * PE River Chart API - 使用 FinMind API
 *
 * 資料來源:
 * 1. TaiwanStockPrice - 每日收盤價 (聚合為月K)
 * 2. TaiwanStockFinancialStatements - 季報 EPS
 *
 * 關鍵邏輯: 考慮財報公佈時間差 (publication lag)
 * - Q1 (1-3月) 報表: 最遲 5/15 公佈
 * - Q2 (4-6月) 報表: 最遲 8/14 公佈
 * - Q3 (7-9月) 報表: 最遲 11/14 公佈
 * - Q4 (10-12月) 報表: 最遲隔年 3/31 公佈
 */

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiQ2xhcmEiLCJlbWFpbCI6ImNhbmR5ODg4MjFAZ21haWwuY29tIiwidG9rZW5fdmVyc2lvbiI6MH0.GWaHJvAh2dbJXqAOMv2KQTYtyAku7bHqUUPSUUWUQso';

// In-memory cache
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

// FinMind API helper
async function finmindFetch(dataset, params) {
  const url = new URL(FINMIND_BASE);
  url.searchParams.set('dataset', dataset);
  url.searchParams.set('token', FINMIND_TOKEN);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.status !== 200 || !json.data) {
    throw new Error(json.msg || `FinMind API error for ${dataset}`);
  }
  return json.data;
}

/**
 * 判斷某一天可以使用哪些已公佈的季報
 * 回傳: 最近一季已公佈報表的 quarter key (e.g., "2025-Q3")
 *
 * 公佈截止日規則:
 * - Q4(Y) → Y+1 年 3/31
 * - Q1(Y) → Y 年 5/15
 * - Q2(Y) → Y 年 8/14
 * - Q3(Y) → Y 年 11/14
 */
function getLatestAvailableQuarter(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  // Check from most recent to oldest
  // Q3 of current year: available after Nov 14
  if (month > 11 || (month === 11 && day >= 14)) {
    return { year, quarter: 3 };
  }
  // Q2 of current year: available after Aug 14
  if (month > 8 || (month === 8 && day >= 14)) {
    return { year, quarter: 2 };
  }
  // Q1 of current year: available after May 15
  if (month > 5 || (month === 5 && day >= 15)) {
    return { year, quarter: 1 };
  }
  // Q4 of previous year: available after Mar 31
  if (month > 3 || (month === 3 && day >= 31)) {
    return { year: year - 1, quarter: 4 };
  }
  // Before Mar 31: only Q3 of previous year is latest
  return { year: year - 1, quarter: 3 };
}

/**
 * 根據「已公佈的最新一季」往回取4季計算 TTM EPS
 * @param {Object} latestQ - { year, quarter }
 * @param {Map} epsMap - Map<"YYYY-QN", number>
 * @returns {number|null}
 */
function calculateTTM(latestQ, epsMap) {
  const quarters = [];
  let y = latestQ.year;
  let q = latestQ.quarter;

  for (let i = 0; i < 4; i++) {
    quarters.push(`${y}-Q${q}`);
    q--;
    if (q === 0) { q = 4; y--; }
  }

  let sum = 0;
  let count = 0;
  for (const key of quarters) {
    const eps = epsMap.get(key);
    if (eps !== undefined) {
      sum += eps;
      count++;
    }
  }

  // Need at least 4 quarters for valid TTM
  return count === 4 ? Math.round(sum * 100) / 100 : null;
}

/**
 * 將 FinMind 財報日期轉為 quarter key
 * FinMind date format: "2025-03-31" (Q1), "2025-06-30" (Q2), etc.
 */
function dateToQuarterKey(dateStr) {
  const month = parseInt(dateStr.split('-')[1]);
  const year = parseInt(dateStr.split('-')[0]);
  let quarter;
  if (month <= 3) quarter = 1;
  else if (month <= 6) quarter = 2;
  else if (month <= 9) quarter = 3;
  else quarter = 4;
  return `${year}-Q${quarter}`;
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
    const endDate = now.toISOString().split('T')[0];

    // 價格抓 2 年
    const priceStart = new Date(now);
    priceStart.setFullYear(priceStart.getFullYear() - 2);
    const priceStartStr = priceStart.toISOString().split('T')[0];

    // 財報抓 3 年（需要往前多抓以確保能算出完整 TTM）
    const epsStart = new Date(now);
    epsStart.setFullYear(epsStart.getFullYear() - 3);
    const epsStartStr = epsStart.toISOString().split('T')[0];

    // Parallel fetch: 股價 + 財報
    const [priceData, financialData] = await Promise.all([
      finmindFetch('TaiwanStockPrice', {
        data_id: stockNo,
        start_date: priceStartStr,
        end_date: endDate,
      }),
      finmindFetch('TaiwanStockFinancialStatements', {
        data_id: stockNo,
        start_date: epsStartStr,
        end_date: endDate,
      }),
    ]);

    if (!priceData || priceData.length === 0) {
      return res.status(404).json({ error: '無法取得股價資料，請確認股票代號' });
    }

    // --- 解析季報 EPS ---
    // FinMind 財報中 type 包含 "EPS" 的項目
    const epsEntries = financialData.filter(
      (row) => row.type === 'EPS' || row.origin_name === '基本每股盈餘（元）'
    );

    const epsMap = new Map();
    for (const entry of epsEntries) {
      const key = dateToQuarterKey(entry.date);
      epsMap.set(key, entry.value);
    }

    if (epsMap.size === 0) {
      return res.status(404).json({ error: '無法取得 EPS 資料，可能該股票無相關財報' });
    }

    // --- 聚合每日股價為月 K 線 ---
    const monthlyMap = new Map(); // "YYYY/MM" -> { open, high, low, close, dates[] }
    for (const row of priceData) {
      const d = new Date(row.date);
      const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { open: row.open, high: row.max, low: row.min, close: row.close, lastDate: row.date });
      } else {
        const m = monthlyMap.get(key);
        if (row.max > m.high) m.high = row.max;
        if (row.min < m.low) m.low = row.min;
        m.close = row.close;
        m.lastDate = row.date;
      }
    }

    // Sort months chronologically
    const sortedMonths = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // --- 計算每月對應的 TTM EPS（考慮公佈時間差）---
    const dates = [];
    const klineData = [];
    const epsTimeline = [];

    for (const [monthKey, monthData] of sortedMonths) {
      // 使用該月最後交易日來判斷當時可用的最新季報
      const latestQ = getLatestAvailableQuarter(monthData.lastDate);
      const ttmEPS = calculateTTM(latestQ, epsMap);

      if (ttmEPS !== null && ttmEPS > 0) {
        dates.push(monthKey);
        klineData.push([monthData.open, monthData.close, monthData.low, monthData.high]);
        epsTimeline.push(ttmEPS);
      }
    }

    if (dates.length === 0) {
      return res.status(404).json({ error: '無法計算有效的 TTM EPS，可能財報資料不足' });
    }

    const latestEPS = epsTimeline[epsTimeline.length - 1];
    const lastClose = klineData[klineData.length - 1][1]; // close
    const currentPE = Math.round((lastClose / latestEPS) * 100) / 100;

    // --- Build PE river bands ---
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
      dates,
      klineData,
      peRiverBands,
      lastPrice: {
        open: klineData[klineData.length - 1][0],
        close: lastClose,
        low: klineData[klineData.length - 1][2],
        high: klineData[klineData.length - 1][3],
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