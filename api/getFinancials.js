/**
 * /api/getFinancials — 財報視覺化 API
 * Params: ?stock=2330&type=income|balance|cashflow|revenue
 * FinMind datasets:
 *   TaiwanStockFinancialStatements (income)
 *   TaiwanStockBalanceSheet (balance)
 *   TaiwanStockCashFlowsStatement (cashflow)
 *   TaiwanStockMonthRevenue (revenue)
 */

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiQ2xhcmEiLCJlbWFpbCI6ImNhbmR5ODg4MjFAZ21haWwuY29tIiwidG9rZW5fdmVyc2lvbiI6MH0.GWaHJvAh2dbJXqAOMv2KQTYtyAku7bHqUUPSUUWUQso';

// In-memory cache
const cache = {};
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

module.exports = async (req, res) => {
  const stock = (req.query.stock || '').trim();
  const type = (req.query.type || 'income').trim();

  if (!stock || !/^\d{4,6}$/.test(stock)) {
    return res.status(400).json({ error: '請提供有效股票代號' });
  }

  const validTypes = ['income', 'balance', 'cashflow', 'revenue'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type 需為: ${validTypes.join(', ')}` });
  }

  const cacheKey = `${stock}_${type}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return res.status(200).json({ ...cache[cacheKey].data, cached: true });
  }

  try {
    let result;
    switch (type) {
      case 'income':
        result = await fetchIncome(stock);
        break;
      case 'balance':
        result = await fetchBalance(stock);
        break;
      case 'cashflow':
        result = await fetchCashflow(stock);
        break;
      case 'revenue':
        result = await fetchRevenue(stock);
        break;
    }
    result.stockNo = stock;
    result.type = type;
    cache[cacheKey] = { data: result, ts: Date.now() };
    return res.status(200).json({ ...result, cached: false });
  } catch (err) {
    console.error('getFinancials error:', err);
    return res.status(500).json({ error: '資料取得失敗: ' + err.message });
  }
};

async function fetchFromFinMind(dataset, stockId, startDate) {
  const url = `${FINMIND_BASE}?dataset=${dataset}&data_id=${stockId}&start_date=${startDate}&token=${TOKEN}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FinMind ${dataset} HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.status !== 200 && json.msg !== 'success') {
    throw new Error(json.msg || 'FinMind error');
  }
  return json.data || [];
}

// ===== Income Statement (損益表) =====
async function fetchIncome(stock) {
  const startDate = getYearsAgo(5);
  const raw = await fetchFromFinMind('TaiwanStockFinancialStatements', stock, startDate);

  // Group by quarter
  const quarters = {};
  for (const row of raw) {
    const qKey = row.date; // e.g. "2023-Q3" or date format
    if (!quarters[qKey]) quarters[qKey] = {};
    quarters[qKey][row.type] = row.value;
  }

  // Extract key metrics per quarter
  const dates = [];
  const revenue = [];
  const operatingIncome = [];
  const netIncome = [];
  const eps = [];
  const grossMargin = [];
  const operatingMargin = [];
  const netMargin = [];

  const sortedKeys = Object.keys(quarters).sort();
  for (const qKey of sortedKeys) {
    const q = quarters[qKey];
    dates.push(qKey);

    const rev = q['Revenue'] || q['營業收入合計'] || q['營業收入'] || 0;
    const opInc = q['OperatingIncome'] || q['營業利益（損失）'] || q['營業利益'] || 0;
    const netInc = q['NetIncome'] || q['本期淨利（淨損）'] || q['淨利'] || 0;
    const epsVal = q['EPS'] || q['基本每股盈餘（元）'] || 0;
    const grossProfit = q['GrossProfit'] || q['營業毛利（毛損）'] || q['營業毛利'] || 0;

    revenue.push(round(rev));
    operatingIncome.push(round(opInc));
    netIncome.push(round(netInc));
    eps.push(round(epsVal));
    grossMargin.push(rev ? round((grossProfit / rev) * 100) : null);
    operatingMargin.push(rev ? round((opInc / rev) * 100) : null);
    netMargin.push(rev ? round((netInc / rev) * 100) : null);
  }

  return { dates, revenue, operatingIncome, netIncome, eps, grossMargin, operatingMargin, netMargin };
}

// ===== Balance Sheet (資產負債表) =====
async function fetchBalance(stock) {
  const startDate = getYearsAgo(5);
  const raw = await fetchFromFinMind('TaiwanStockBalanceSheet', stock, startDate);

  const quarters = {};
  for (const row of raw) {
    const qKey = row.date;
    if (!quarters[qKey]) quarters[qKey] = {};
    quarters[qKey][row.type] = row.value;
  }

  const dates = [];
  const totalAssets = [];
  const totalLiabilities = [];
  const equity = [];
  const currentAssets = [];
  const currentLiabilities = [];
  const debtRatio = [];

  const sortedKeys = Object.keys(quarters).sort();
  for (const qKey of sortedKeys) {
    const q = quarters[qKey];
    dates.push(qKey);

    const assets = q['Assets'] || q['資產總計'] || q['資產總額'] || 0;
    const liab = q['Liabilities'] || q['負債總計'] || q['負債總額'] || 0;
    const eq = q['Equity'] || q['權益總計'] || q['權益總額'] || assets - liab;
    const curAssets = q['CurrentAssets'] || q['流動資產合計'] || q['流動資產'] || 0;
    const curLiab = q['CurrentLiabilities'] || q['流動負債合計'] || q['流動負債'] || 0;

    totalAssets.push(round(assets));
    totalLiabilities.push(round(liab));
    equity.push(round(eq));
    currentAssets.push(round(curAssets));
    currentLiabilities.push(round(curLiab));
    debtRatio.push(assets ? round((liab / assets) * 100) : null);
  }

  return { dates, totalAssets, totalLiabilities, equity, currentAssets, currentLiabilities, debtRatio };
}

// ===== Cash Flow (現金流量表) =====
async function fetchCashflow(stock) {
  const startDate = getYearsAgo(5);
  const raw = await fetchFromFinMind('TaiwanStockCashFlowsStatement', stock, startDate);

  const quarters = {};
  for (const row of raw) {
    const qKey = row.date;
    if (!quarters[qKey]) quarters[qKey] = {};
    quarters[qKey][row.type] = row.value;
  }

  const dates = [];
  const operating = [];
  const investing = [];
  const financing = [];
  const freeCashFlow = [];

  const sortedKeys = Object.keys(quarters).sort();
  for (const qKey of sortedKeys) {
    const q = quarters[qKey];
    dates.push(qKey);

    const op = q['OperatingCashFlow'] || q['營業活動之淨現金流入（流出）'] || q['營業活動之淨現金流入'] || 0;
    const inv = q['InvestingCashFlow'] || q['投資活動之淨現金流入（流出）'] || q['投資活動之淨現金流入'] || 0;
    const fin = q['FinancingCashFlow'] || q['籌資活動之淨現金流入（流出）'] || q['籌資活動之淨現金流入'] || 0;

    operating.push(round(op));
    investing.push(round(inv));
    financing.push(round(fin));
    freeCashFlow.push(round(op + inv));
  }

  return { dates, operating, investing, financing, freeCashFlow };
}

// ===== Monthly Revenue (月營收) =====
async function fetchRevenue(stock) {
  const startDate = getYearsAgo(3);
  const raw = await fetchFromFinMind('TaiwanStockMonthRevenue', stock, startDate);

  const dates = [];
  const monthlyRevenue = [];
  const momGrowth = [];
  const yoyGrowth = [];

  // Sort by date
  const sorted = raw.sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const rev = row.revenue || 0;
    dates.push(row.date.substring(0, 7)); // YYYY-MM
    monthlyRevenue.push(round(rev / 1e4)); // 轉換為萬元 → 以千萬顯示更好, 用億
    // MoM
    if (i > 0 && sorted[i - 1].revenue) {
      momGrowth.push(round(((rev - sorted[i - 1].revenue) / sorted[i - 1].revenue) * 100));
    } else {
      momGrowth.push(null);
    }
    // YoY
    const yoyIdx = sorted.findIndex(r => r.date.substring(0, 7) === getYoYDate(row.date));
    if (yoyIdx >= 0 && sorted[yoyIdx].revenue) {
      yoyGrowth.push(round(((rev - sorted[yoyIdx].revenue) / sorted[yoyIdx].revenue) * 100));
    } else {
      yoyGrowth.push(null);
    }
  }

  return { dates, monthlyRevenue, momGrowth, yoyGrowth, unit: '萬元' };
}

// ===== Helpers =====
function getYearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().split('T')[0];
}

function getYoYDate(dateStr) {
  // "2024-03-01" → "2023-03"
  const [y, m] = dateStr.split('-');
  return `${parseInt(y) - 1}-${m}`;
}

function round(v) {
  if (v === null || v === undefined || isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}