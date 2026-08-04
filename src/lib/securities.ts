import type { AssetClass } from './types'

export interface Security {
  name: string
  ticker: string
  assetClass: AssetClass
}

// ── Thai Mutual Funds ─────────────────────────────────────────────────────────
const THAI_FUNDS: Security[] = [
  { name: 'Kasikorn Cash Management', ticker: 'K-CASH', assetClass: 'fund' },
  { name: 'Kasikorn Master Pool', ticker: 'K-MP', assetClass: 'fund' },
  { name: 'Kasikorn SET Index', ticker: 'K-SET', assetClass: 'fund' },
  { name: 'Kasikorn Global Bond', ticker: 'K-GB', assetClass: 'fund' },
  { name: 'Kasikorn China A-Share', ticker: 'K-CHINA-A', assetClass: 'fund' },
  { name: 'Kasikorn US500', ticker: 'K-US500', assetClass: 'fund' },
  { name: 'Kasikorn Global Equity', ticker: 'K-GHEALTH', assetClass: 'fund' },
  { name: 'SCB SET Index', ticker: 'SCBSET', assetClass: 'fund' },
  { name: 'SCB Dollar Bond', ticker: 'SCBDB', assetClass: 'fund' },
  { name: 'SCB US Equity', ticker: 'SCBDNAQ', assetClass: 'fund' },
  { name: 'SCB Blockchain and Digital Assets', ticker: 'SCBblockchain', assetClass: 'fund' },
  { name: 'SCB Thai Equity', ticker: 'SCBTEQ', assetClass: 'fund' },
  { name: 'Bangkok Bank SET', ticker: 'BBLSET', assetClass: 'fund' },
  { name: 'Bangkok Bank Cash', ticker: 'BBLCASH', assetClass: 'fund' },
  { name: 'Krungthai SET Index', ticker: 'KTSET50', assetClass: 'fund' },
  { name: 'Krungthai China', ticker: 'KTCHINA', assetClass: 'fund' },
  { name: 'Krungthai Fixed Income', ticker: 'KTFIX', assetClass: 'fund' },
  { name: 'One ULT Equity', ticker: 'ONE-ULT-EQ', assetClass: 'fund' },
  { name: 'One S&P500', ticker: 'ONE-SP500', assetClass: 'fund' },
  { name: 'TMB S&P500', ticker: 'TMBSP500', assetClass: 'fund' },
  { name: 'TMB Global Income', ticker: 'TMBGINCOME', assetClass: 'fund' },
  { name: 'Phatra Global Bond', ticker: 'PHATRA-GB', assetClass: 'fund' },
  { name: 'Phatra US Equity', ticker: 'PHATRA-US', assetClass: 'fund' },
  { name: 'MFC SET Index', ticker: 'MFC-SET', assetClass: 'fund' },
  { name: 'MFC Bond', ticker: 'MFC-BOND', assetClass: 'fund' },
  { name: 'Tisco SET50', ticker: 'TISCOSH', assetClass: 'fund' },
  { name: 'Tisco Fixed Income', ticker: 'TISCOFP', assetClass: 'fund' },
  { name: 'UOB Smart China India', ticker: 'UOBSCI', assetClass: 'fund' },
  { name: 'Finansa Money Market', ticker: 'FMM', assetClass: 'fund' },
  { name: 'BBLAM Healthcare', ticker: 'BBLAHCARE', assetClass: 'fund' },
]

// ── US Stocks ─────────────────────────────────────────────────────────────────
const US_STOCKS: Security[] = [
  { name: 'Apple', ticker: 'AAPL', assetClass: 'stock' },
  { name: 'Microsoft', ticker: 'MSFT', assetClass: 'stock' },
  { name: 'NVIDIA', ticker: 'NVDA', assetClass: 'stock' },
  { name: 'Alphabet (Google)', ticker: 'GOOGL', assetClass: 'stock' },
  { name: 'Amazon', ticker: 'AMZN', assetClass: 'stock' },
  { name: 'Meta Platforms', ticker: 'META', assetClass: 'stock' },
  { name: 'Tesla', ticker: 'TSLA', assetClass: 'stock' },
  { name: 'Berkshire Hathaway', ticker: 'BRK.B', assetClass: 'stock' },
  { name: 'Broadcom', ticker: 'AVGO', assetClass: 'stock' },
  { name: 'JPMorgan Chase', ticker: 'JPM', assetClass: 'stock' },
  { name: 'Visa', ticker: 'V', assetClass: 'stock' },
  { name: 'ExxonMobil', ticker: 'XOM', assetClass: 'stock' },
  { name: 'UnitedHealth Group', ticker: 'UNH', assetClass: 'stock' },
  { name: 'Johnson & Johnson', ticker: 'JNJ', assetClass: 'stock' },
  { name: 'Walmart', ticker: 'WMT', assetClass: 'stock' },
  { name: 'Mastercard', ticker: 'MA', assetClass: 'stock' },
  { name: 'Procter & Gamble', ticker: 'PG', assetClass: 'stock' },
  { name: 'Home Depot', ticker: 'HD', assetClass: 'stock' },
  { name: 'Netflix', ticker: 'NFLX', assetClass: 'stock' },
  { name: 'AMD', ticker: 'AMD', assetClass: 'stock' },
  { name: 'Salesforce', ticker: 'CRM', assetClass: 'stock' },
  { name: 'Adobe', ticker: 'ADBE', assetClass: 'stock' },
  { name: 'Costco', ticker: 'COST', assetClass: 'stock' },
  { name: 'Disney', ticker: 'DIS', assetClass: 'stock' },
  { name: 'PayPal', ticker: 'PYPL', assetClass: 'stock' },
  { name: 'Intel', ticker: 'INTC', assetClass: 'stock' },
  { name: 'Coca-Cola', ticker: 'KO', assetClass: 'stock' },
  { name: 'PepsiCo', ticker: 'PEP', assetClass: 'stock' },
  { name: 'Pfizer', ticker: 'PFE', assetClass: 'stock' },
  { name: 'Bank of America', ticker: 'BAC', assetClass: 'stock' },
  { name: 'Goldman Sachs', ticker: 'GS', assetClass: 'stock' },
  { name: 'Palantir', ticker: 'PLTR', assetClass: 'stock' },
  { name: 'Uber', ticker: 'UBER', assetClass: 'stock' },
  { name: 'Airbnb', ticker: 'ABNB', assetClass: 'stock' },
  { name: 'Spotify', ticker: 'SPOT', assetClass: 'stock' },
  { name: 'Shopify', ticker: 'SHOP', assetClass: 'stock' },
  { name: 'Snowflake', ticker: 'SNOW', assetClass: 'stock' },
  { name: 'Cloudflare', ticker: 'NET', assetClass: 'stock' },
  { name: 'Datadog', ticker: 'DDOG', assetClass: 'stock' },
  { name: 'CrowdStrike', ticker: 'CRWD', assetClass: 'stock' },
  // ETFs
  { name: 'S&P 500 ETF (SPY)', ticker: 'SPY', assetClass: 'stock' },
  { name: 'S&P 500 ETF (VOO)', ticker: 'VOO', assetClass: 'stock' },
  { name: 'Nasdaq 100 ETF (QQQ)', ticker: 'QQQ', assetClass: 'stock' },
  { name: 'Total Market ETF (VTI)', ticker: 'VTI', assetClass: 'stock' },
  { name: 'International ETF (VXUS)', ticker: 'VXUS', assetClass: 'stock' },
  { name: 'Emerging Markets ETF (VWO)', ticker: 'VWO', assetClass: 'stock' },
  { name: 'Gold ETF (GLD)', ticker: 'GLD', assetClass: 'stock' },
  { name: 'Bitcoin ETF (IBIT)', ticker: 'IBIT', assetClass: 'stock' },
  { name: 'iShares 0-3 Month Treasury Bond ETF (SGOV)', ticker: 'SGOV', assetClass: 'stock' },
]

// ── Gold ─────────────────────────────────────────────────────────────────────
const GOLD_SECURITIES: Security[] = [
  { name: 'Gold Bar (สมาคมค้าทองคำ)', ticker: 'XAU-TH', assetClass: 'gold' },
  { name: 'Gold 96.5% (บาททอง)', ticker: 'BAHT-GOLD', assetClass: 'gold' },
  { name: 'Gold Futures (TFEX)', ticker: 'GF', assetClass: 'gold' },
  { name: 'SPDR Gold Shares ETF', ticker: 'GLD', assetClass: 'gold' },
  { name: 'iShares Gold Trust', ticker: 'IAU', assetClass: 'gold' },
  { name: 'Gold 99.99% (gram)', ticker: 'XAU', assetClass: 'gold' },
]

export const ALL_SECURITIES: Security[] = [...THAI_FUNDS, ...US_STOCKS, ...GOLD_SECURITIES]

export function searchSecurities(query: string, assetClass: AssetClass): Security[] {
  if (!query || query.trim().length < 1) return []
  const q = query.toLowerCase()
  return ALL_SECURITIES.filter(
    (s) =>
      s.assetClass === assetClass &&
      (s.name.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q)),
  ).slice(0, 6)
}
