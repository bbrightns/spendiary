import type { InvestAssetClass } from './types'
import { THAI_STOCKS, THAI_DRS, US_STOCKS } from './securities'

const THAI_TICKER_SET = new Set([
  ...THAI_STOCKS.map((s) => s.ticker.toUpperCase()),
  ...THAI_DRS.map((s) => s.ticker.toUpperCase()),
  'PTT', 'CPALL', 'BDMS', 'DELTA', 'AOT', 'ADVANC', 'GULF', 'SCB', 'KBANK', 'BBL',
  'TRUE', 'KTB', 'SCC', 'CPAXT', 'CPN', 'CRC', 'MINT', 'INTUCH', 'BH', 'TOP',
  'BANPU', 'PTTEP', 'PTTGC', 'IVL', 'BJC', 'HMPRO', 'GLOBAL', 'DOHOME', 'MEGA', 'COM7',
  'BTS', 'BEM', 'BA', 'AAV', 'PSL', 'TTA', 'HANA', 'KCE', 'CCET', 'BCH', 'CHG', 'PR9',
  'TTB', 'TISCO', 'KKP', 'BAY', 'MTC', 'SAWAD', 'TIDLOR', 'BAM', 'JMT', 'KTC', 'SCGP',
  'GPSC', 'BGRIM', 'EA', 'EGCO', 'RATCH', 'CENTEL', 'ERW', 'LH', 'SPALI', 'AP', 'SIRI',
  'QH', 'ORI', 'WHA', 'AMATA', 'CPF', 'CBG', 'OSP', 'ICHI', 'SAPPE', 'TU', 'BTG', 'ITC',
  'AAI', 'TFG', 'STEC', 'CK', 'UNIQ', 'ITD', 'STA', 'STGT', 'PLANB', 'VGI', 'TLI', 'SISB',
  'MOSHI', 'AU', 'M', 'SNNP', 'TKN', 'WARRIX', 'COCOCO', 'MASTER', 'PRTR', 'OR', 'IRPC',
])

const US_TICKER_SET = new Set([
  ...US_STOCKS.map((s) => s.ticker.toUpperCase()),
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'BRK.B', 'BRK.A',
  'AVGO', 'JPM', 'V', 'XOM', 'UNH', 'JNJ', 'WMT', 'MA', 'PG', 'HD', 'NFLX', 'AMD',
  'CRM', 'ADBE', 'COST', 'DIS', 'PYPL', 'INTC', 'KO', 'PEP', 'PFE', 'BAC', 'GS', 'PLTR',
  'UBER', 'ABNB', 'SPOT', 'SHOP', 'SNOW', 'NET', 'DDOG', 'CRWD', 'COIN', 'ARM', 'MSTR',
  'LLY', 'NVO', 'ASML', 'TSM', 'BABA', 'JD', 'PDD', 'BIDU', 'NIO',
  'SPY', 'VOO', 'IVV', 'QQQ', 'QQQM', 'VTI', 'SCHD', 'VT', 'VXUS', 'VWO', 'VEA',
  'IEMG', 'BND', 'AGG', 'TLT', 'IEF', 'SHY', 'SGOV', 'BIL', 'GLD', 'IAU', 'SLV',
  'IBIT', 'FBTC', 'ARKK', 'SMH', 'SOXX', 'XLE', 'XLF', 'XLK', 'XLV', 'XLI', 'XLU',
  'XLP', 'XLY', 'XLRE', 'XLC', 'VNQ', 'JEPI', 'JEPQ', 'DGRO', 'VYM', 'VIG', 'IWM', 'IJR',
])

export function inferAssetClass(
  ticker: string,
  name: string,
  rawClass?: string,
  currency?: string,
): InvestAssetClass {
  const normClass = (rawClass ?? '').toLowerCase().trim()
  const cleanCurr = (currency ?? '').toUpperCase().trim()
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.(BK|SET|TB)$/i, '')
  const combined = `${ticker} ${name}`.trim()
  const upperCombined = combined.toUpperCase()

  // 1. Explicit Crypto
  if (normClass === 'crypto' || /\b(BTC|ETH|SOL|DOGE|ADA|XRP|BNB|USDT|USDC|CRYPTO|BITCOIN)\b/i.test(upperCombined)) {
    return 'crypto'
  }

  // 2. Explicit Gold
  if (normClass === 'gold' || /\b(GOLD|XAU|ทอง|ทองคำ|BAHT-GOLD)\b/i.test(upperCombined)) {
    return 'gold'
  }

  // 3. Explicit Thai classification keywords in rawClass
  if (
    normClass === 'fund' ||
    /\b(thai\s*stock|thai\s*fund|thai\s*mutual\s*fund|thai\s*dr|th\s*stock|th\s*fund|th\s*dr|drx?|set|mai|thai)\b/i.test(normClass)
  ) {
    return 'fund'
  }

  // 4. Explicit US classification keywords in rawClass
  if (/\b(us\s*stock|us\s*etf|us\s*equity|nyse|nasdaq)\b/i.test(normClass)) {
    return 'stock'
  }

  // 5. Thai Language Characters in ticker or name -> Thai Asset (fund)
  if (/[\u0E00-\u0E7F]/.test(combined)) {
    return 'fund'
  }

  // 6. Thai DR / DRx patterns (e.g. AAPL80X, E1VFVN3001, NDX01, BABA80)
  if (
    /(80X|19X)$/i.test(cleanTicker) ||
    /^(E1VFVN3001|FUEVFVND01|DIAMOND01)$/i.test(cleanTicker) ||
    /^[A-Z0-9]{2,}(01|19|23|41|80)$/i.test(cleanTicker)
  ) {
    return 'fund'
  }

  // 7. Thai Mutual Fund naming patterns / AMCs
  if (
    /(-A|-SSF|-RMF|-D|-X|\bFUND\b|\bกองทุน\b|\bบลจ\b)/i.test(upperCombined) ||
    /^(K|SCB|B|BBL|KT|ONE|TMB|T|PHATRA|KKP|MFC|TISCO|UOB|PRINCIPAL|DAOL|KF)-/i.test(cleanTicker)
  ) {
    return 'fund'
  }

  // 8. Recognized Thai stock tickers or Thai market suffix
  if (THAI_TICKER_SET.has(cleanTicker) || /\.(BK|SET|TB)$/i.test(ticker.trim())) {
    return 'fund'
  }

  // 9. Recognized US stock / ETF tickers
  if (US_TICKER_SET.has(cleanTicker)) {
    return 'stock'
  }

  // 10. Currency-based classification
  // In Spendiary, Thai assets (stocks, funds, DRs) are in THB ('fund').
  // US assets (stocks, ETFs) are in USD ('stock').
  if (cleanCurr === 'THB') {
    return 'fund'
  }
  if (cleanCurr === 'USD') {
    return 'stock'
  }

  // 11. If rawClass was 'stock' but wasn't caught by any Thai checks above
  if (normClass === 'stock') {
    return 'stock'
  }

  // 12. Default fallback: Latin tickers (e.g. 1-5 chars) default to stock, otherwise fund
  if (/^[A-Z]{1,5}$/.test(cleanTicker)) {
    return 'stock'
  }

  return 'fund'
}
