import type { SpendiaryData } from './types'
import { GRAMS_PER_BAHT_GOLD, SATS_PER_BTC, goldThbPerBahtToXauUsd, portfolioSummary } from './calc'

function fmtNum(n: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

function fmtMoney(n: number, currency: 'THB' | 'USD' = 'THB', decimals = 2): string {
  const symbol = currency === 'USD' ? '$' : '฿'
  return `${symbol}${fmtNum(n, decimals)}`
}

function fmtSignMoney(n: number, currency: 'THB' | 'USD' = 'THB', decimals = 2): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  const symbol = currency === 'USD' ? '$' : '฿'
  return `${sign}${symbol}${fmtNum(Math.abs(n), decimals)}`
}

function fmtPct(n: number, decimals = 2): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(decimals)}%`
}

export function generatePortfolioMarkdown(
  data: SpendiaryData,
  usdThb?: number | null,
  goldThbPerGram?: number | null,
): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const rate = usdThb && usdThb > 0 ? usdThb : 35
  const holdings = data.holdings ?? []
  const cashAccounts = data.cashAccounts ?? []
  const summary = portfolioSummary(holdings)
  const totalCashThb = cashAccounts.reduce((sum, a) => {
    const isUsd = a.currency === 'USD'
    return sum + (isUsd ? a.balance * rate : a.balance)
  }, 0)
  const totalNetWorth = summary.value + totalCashThb

  const lines: string[] = []

  // Title
  lines.push(`# 📊 Spendiary - สรุปพอร์ตการลงทุน (Portfolio Snapshot)`)
  lines.push(`> 📅 **วันที่**: ${dateStr} เวลา ${timeStr}`)
  const rateInfo: string[] = []
  if (usdThb) rateInfo.push(`อัตราแลกเปลี่ยน USD/THB: **${usdThb.toFixed(2)} บาท**`)
  if (goldThbPerGram) {
    const goldPricePerBaht = Math.round(goldThbPerGram * GRAMS_PER_BAHT_GOLD)
    rateInfo.push(`ราคาทองคำแท่ง: **฿${goldPricePerBaht.toLocaleString()} / บาททองคำ** (฿${fmtNum(goldThbPerGram, 2)}/g)`)
  }
  if (rateInfo.length > 0) {
    lines.push(`> 💱 ${rateInfo.join(' | ')}`)
  }
  lines.push('')

  // Overview Summary
  lines.push(`## 📌 ภาพรวมพอร์ต (Portfolio Overview)`)
  lines.push(`- **มูลค่าพอร์ตการลงทุนรวม (Market Value)**: **${fmtMoney(summary.value, 'THB')}**`)
  lines.push(`- **ต้นทุนเงินลงทุนรวม (Total Cost)**: **${fmtMoney(summary.cost, 'THB')}**`)
  lines.push(`- **กำไร/ขาดทุนรวม (All-time PnL)**: **${fmtSignMoney(summary.pnl, 'THB')} (${fmtPct(summary.pnlPct)})**`)
  if (cashAccounts.length > 0) {
    lines.push(`- **เงินสดคงเหลือรวม (Liquid Cash)**: **${fmtMoney(totalCashThb, 'THB')}**`)
    lines.push(`- **มูลค่าทรัพย์สินสุทธิ (Net Worth)**: **${fmtMoney(totalNetWorth, 'THB')}**`)
  }
  lines.push(`- **จำนวนรายการถือครอง (Holdings Count)**: **${holdings.length} รายการ**`)
  lines.push('')

  // Summary Table
  if (holdings.length > 0) {
    lines.push(`## 📋 ตารางสรุปรายการถือครอง (Holdings Summary)`)
    lines.push(`| สินทรัพย์ (Asset) | ประเภท | จำนวนที่ถือ (Quantity) | ต้นทุนเฉลี่ย (Avg Cost) | ราคาปัจจุบัน (Price) | ต้นทุนรวม (Cost) | มูลค่าปัจจุบัน (Value) | กำไร/ขาดทุน (PnL) |`)
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`)

    for (const h of holdings) {
      const isStock = h.assetClass === 'stock'
      const isCrypto = h.assetClass === 'crypto'
      const isGold = h.assetClass === 'gold'

      const marketValue = h.units * h.price
      const costBasis = h.totalThbInvested ?? (h.units * h.avgCost)
      const pnl = marketValue - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0

      let typeLabel = 'กองทุนรวม'
      let qtyStr = `${fmtNum(h.units, 4)} units`
      let avgCostStr = `${fmtMoney(h.avgCost, 'THB', 4)}/unit`
      let priceStr = `${fmtMoney(h.price, 'THB', 4)}/unit`
      let totalCostStr = fmtMoney(costBasis, 'THB')
      let marketValStr = fmtMoney(marketValue, 'THB')

      if (isStock) {
        typeLabel = 'หุ้นสหรัฐ (US Stock)'
        qtyStr = `${fmtNum(h.units, 4)} shares`
        const avgUsd = h.avgCostUsd ?? (rate > 0 ? h.avgCost / rate : 0)
        const priceUsd = rate > 0 ? h.price / rate : 0
        avgCostStr = `${fmtMoney(avgUsd, 'USD', 2)} (${fmtMoney(h.avgCost, 'THB', 2)})`
        priceStr = `${fmtMoney(priceUsd, 'USD', 2)} (${fmtMoney(h.price, 'THB', 2)})`
        const totalCostUsd = h.totalUsdInvested ?? (avgUsd * h.units)
        totalCostStr = `${fmtMoney(totalCostUsd, 'USD', 2)}<br/>(${fmtMoney(costBasis, 'THB', 2)})`
        const marketValUsd = rate > 0 ? marketValue / rate : 0
        marketValStr = `${fmtMoney(marketValUsd, 'USD', 2)}<br/>(${fmtMoney(marketValue, 'THB', 2)})`
      } else if (isCrypto) {
        typeLabel = 'บิตคอยน์ (BTC)'
        const sats = Math.round(h.units * SATS_PER_BTC)
        qtyStr = `${sats.toLocaleString()} sats<br/>(${fmtNum(h.units, 8)} BTC)`
        const avgCostPerBtc = h.units > 0 ? costBasis / h.units : h.avgCost
        const avgCostPerBtcUsd = rate > 0 ? avgCostPerBtc / rate : 0
        const priceUsd = rate > 0 ? h.price / rate : 0
        avgCostStr = `${fmtMoney(avgCostPerBtcUsd, 'USD', 0)}/BTC<br/>(${fmtMoney(avgCostPerBtc, 'THB', 0)})`
        priceStr = `${fmtMoney(priceUsd, 'USD', 0)}/BTC<br/>(${fmtMoney(h.price, 'THB', 0)})`
      } else if (isGold) {
        typeLabel = 'ทองคำ (Gold)'
        const bahtGold = h.units / GRAMS_PER_BAHT_GOLD
        qtyStr = `${fmtNum(bahtGold, 4)} บาททอง<br/>(${fmtNum(h.units, 4)} g)`
        const avgCostPerBaht = (h.units > 0 ? costBasis / h.units : h.avgCost) * GRAMS_PER_BAHT_GOLD
        const avgCostXauUsd = goldThbPerBahtToXauUsd(avgCostPerBaht, rate)
        const pricePerBaht = h.price * GRAMS_PER_BAHT_GOLD
        const priceXauUsd = goldThbPerBahtToXauUsd(pricePerBaht, rate)
        avgCostStr = `${fmtMoney(avgCostPerBaht, 'THB', 0)}/บาททอง<br/>($${fmtMoney(avgCostXauUsd, 'USD', 0)}/oz)`
        priceStr = `${fmtMoney(pricePerBaht, 'THB', 0)}/บาททอง<br/>($${fmtMoney(priceXauUsd, 'USD', 0)}/oz)`
      }

      const pnlStr = `${fmtSignMoney(pnl, 'THB', 2)}<br/>(${fmtPct(pnlPct, 2)})`
      lines.push(`| **${h.name}** (${h.ticker}) | ${typeLabel} | ${qtyStr} | ${avgCostStr} | ${priceStr} | ${totalCostStr} | ${marketValStr} | ${pnlStr} |`)
    }
    lines.push('')
  }

  // Detailed Section by Asset Class
  const stocks = holdings.filter((h) => h.assetClass === 'stock')
  const cryptos = holdings.filter((h) => h.assetClass === 'crypto')
  const golds = holdings.filter((h) => h.assetClass === 'gold')
  const funds = holdings.filter((h) => h.assetClass === 'fund')

  // 1. US Stocks
  if (stocks.length > 0) {
    lines.push(`## 📈 หุ้นต่างประเทศ / หุ้นสหรัฐ (US Stocks)`)
    for (const h of stocks) {
      const marketValue = h.units * h.price
      const costBasis = h.totalThbInvested ?? (h.units * h.avgCost)
      const pnl = marketValue - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
      const avgCostUsd = h.avgCostUsd ?? (rate > 0 ? h.avgCost / rate : 0)
      const priceUsd = rate > 0 ? h.price / rate : 0
      const totalCostUsd = h.totalUsdInvested ?? (avgCostUsd * h.units)
      const marketValUsd = rate > 0 ? marketValue / rate : 0
      const pnlUsd = marketValUsd - totalCostUsd

      lines.push(`### 🔹 ${h.name} (\`${h.ticker}\`)`)
      lines.push(`- **จำนวนที่ถือครอง**: **${fmtNum(h.units, 4)} หุ้น** (Shares)`)
      lines.push(`- **ต้นทุนเฉลี่ย (Avg Cost)**: **${fmtMoney(avgCostUsd, 'USD', 2)} / หุ้น** (≈ ${fmtMoney(h.avgCost, 'THB', 2)})`)
      lines.push(`- **ราคาปัจจุบัน (Price)**: **${fmtMoney(priceUsd, 'USD', 2)} / หุ้น** (≈ ${fmtMoney(h.price, 'THB', 2)})`)
      lines.push(`- **ต้นทุนรวม (Total Cost)**: **${fmtMoney(totalCostUsd, 'USD', 2)}** (≈ ${fmtMoney(costBasis, 'THB', 2)})`)
      lines.push(`- **มูลค่าปัจจุบัน (Market Value)**: **${fmtMoney(marketValUsd, 'USD', 2)}** (≈ ${fmtMoney(marketValue, 'THB', 2)})`)
      lines.push(`- **กำไร/ขาดทุน (PnL)**: **${fmtSignMoney(pnlUsd, 'USD', 2)}** (≈ ${fmtSignMoney(pnl, 'THB', 2)}) | **${fmtPct(pnlPct, 2)}**`)
      lines.push('')
    }
  }

  // 2. Bitcoin / Crypto
  if (cryptos.length > 0) {
    lines.push(`## 🪙 บิตคอยน์ & คริปโต (Bitcoin & Crypto)`)
    for (const h of cryptos) {
      const sats = Math.round(h.units * SATS_PER_BTC)
      const marketValue = h.units * h.price
      const costBasis = h.totalThbInvested ?? (h.units * h.avgCost)
      const pnl = marketValue - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
      const avgCostPerBtc = h.units > 0 ? costBasis / h.units : h.avgCost
      const avgCostPerBtcUsd = rate > 0 ? avgCostPerBtc / rate : 0
      const priceUsd = rate > 0 ? h.price / rate : 0

      lines.push(`### 🔹 ${h.name} (\`${h.ticker}\`)`)
      lines.push(`- **จำนวนที่ถือครอง**: **${sats.toLocaleString()} sats** (${fmtNum(h.units, 8)} BTC)`)
      lines.push(`- **ต้นทุนเฉลี่ย (Avg Cost)**: **${fmtMoney(avgCostPerBtcUsd, 'USD', 0)} / BTC** (≈ ${fmtMoney(avgCostPerBtc, 'THB', 0)})`)
      lines.push(`- **ราคาปัจจุบัน (Price)**: **${fmtMoney(priceUsd, 'USD', 0)} / BTC** (≈ ${fmtMoney(h.price, 'THB', 0)})`)
      lines.push(`- **ต้นทุนรวม (Total Cost)**: **${fmtMoney(costBasis, 'THB', 2)}**`)
      lines.push(`- **มูลค่าปัจจุบัน (Market Value)**: **${fmtMoney(marketValue, 'THB', 2)}**`)
      lines.push(`- **กำไร/ขาดทุน (PnL)**: **${fmtSignMoney(pnl, 'THB', 2)} (${fmtPct(pnlPct, 2)})**`)

      if (h.btcLocations && h.btcLocations.length > 0) {
        lines.push(`- **แหล่งจัดเก็บ / ซื้อ (Storage Locations)**:`)
        for (const loc of h.btcLocations) {
          const locCostPerBtc = loc.satoshi > 0 ? (loc.thbSpent / loc.satoshi) * SATS_PER_BTC : 0
          const locCostPerBtcUsd = rate > 0 ? locCostPerBtc / rate : 0
          lines.push(`  - 📍 **${loc.name}**: ${loc.satoshi.toLocaleString()} sats (${(loc.satoshi / SATS_PER_BTC).toFixed(8)} BTC) | ทุน: ${fmtMoney(loc.thbSpent, 'THB', 2)} | ทุนเฉลี่ย: ${fmtMoney(locCostPerBtcUsd, 'USD', 0)}/BTC (≈ ${fmtMoney(locCostPerBtc, 'THB', 0)})`)
        }
      }
      lines.push('')
    }
  }

  // 3. Gold
  if (golds.length > 0) {
    lines.push(`## 👑 ทองคำ (Gold)`)
    for (const h of golds) {
      const bahtGold = h.units / GRAMS_PER_BAHT_GOLD
      const marketValue = h.units * h.price
      const costBasis = h.totalThbInvested ?? (h.units * h.avgCost)
      const pnl = marketValue - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
      const avgCostPerBaht = (h.units > 0 ? costBasis / h.units : h.avgCost) * GRAMS_PER_BAHT_GOLD
      const avgCostXauUsd = goldThbPerBahtToXauUsd(avgCostPerBaht, rate)
      const pricePerBaht = h.price * GRAMS_PER_BAHT_GOLD
      const priceXauUsd = goldThbPerBahtToXauUsd(pricePerBaht, rate)

      lines.push(`### 🔹 ${h.name} (\`${h.ticker}\`)`)
      lines.push(`- **จำนวนที่ถือครอง**: **${fmtNum(bahtGold, 4)} บาททองคำ** (${fmtNum(h.units, 4)} กรัม / g)`)
      lines.push(`- **ต้นทุนเฉลี่ย (Avg Cost)**: **${fmtMoney(avgCostPerBaht, 'THB', 0)} / บาททองคำ** ($${fmtMoney(avgCostXauUsd, 'USD', 0)} / oz XAUUSD | ${fmtMoney(h.avgCost, 'THB', 2)} / g)`)
      lines.push(`- **ราคาปัจจุบัน (Price)**: **${fmtMoney(pricePerBaht, 'THB', 0)} / บาททองคำ** ($${fmtMoney(priceXauUsd, 'USD', 0)} / oz XAUUSD | ${fmtMoney(h.price, 'THB', 2)} / g)`)
      lines.push(`- **ต้นทุนรวม (Total Cost)**: **${fmtMoney(costBasis, 'THB', 2)}**`)
      lines.push(`- **มูลค่าปัจจุบัน (Market Value)**: **${fmtMoney(marketValue, 'THB', 2)}**`)
      lines.push(`- **กำไร/ขาดทุน (PnL)**: **${fmtSignMoney(pnl, 'THB', 2)} (${fmtPct(pnlPct, 2)})**`)

      if (h.goldLocations && h.goldLocations.length > 0) {
        lines.push(`- **แหล่งจัดเก็บ / ร้านทอง (Gold Locations)**:`)
        for (const loc of h.goldLocations) {
          const locBaht = loc.grams / GRAMS_PER_BAHT_GOLD
          const locCostPerBaht = loc.grams > 0 ? (loc.thbSpent / loc.grams) * GRAMS_PER_BAHT_GOLD : 0
          const locCostXauUsd = goldThbPerBahtToXauUsd(locCostPerBaht, rate)
          lines.push(`  - 📍 **${loc.name}**: ${fmtNum(locBaht, 4)} บาททอง (${fmtNum(loc.grams, 4)} g) | ทุน: ${fmtMoney(loc.thbSpent, 'THB', 2)} | ทุนเฉลี่ย: ${fmtMoney(locCostPerBaht, 'THB', 0)}/บาททอง ($${fmtMoney(locCostXauUsd, 'USD', 0)}/oz)`)
        }
      }
      lines.push('')
    }
  }

  // 4. Thai Funds
  if (funds.length > 0) {
    lines.push(`## 🏛️ กองทุนรวมไทย (Thai Funds)`)
    for (const h of funds) {
      const marketValue = h.units * h.price
      const costBasis = h.totalThbInvested ?? (h.units * h.avgCost)
      const pnl = marketValue - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0

      lines.push(`### 🔹 ${h.name} (\`${h.ticker}\`)`)
      lines.push(`- **จำนวนหน่วยลงทุน**: **${fmtNum(h.units, 4)} units**`)
      lines.push(`- **ต้นทุนเฉลี่ย (Avg Cost / NAV)**: **${fmtMoney(h.avgCost, 'THB', 4)} / unit**`)
      lines.push(`- **ราคาปัจจุบัน (Current NAV)**: **${fmtMoney(h.price, 'THB', 4)} / unit**`)
      lines.push(`- **ต้นทุนรวม (Total Cost)**: **${fmtMoney(costBasis, 'THB', 2)}**`)
      lines.push(`- **มูลค่าปัจจุบัน (Market Value)**: **${fmtMoney(marketValue, 'THB', 2)}**`)
      lines.push(`- **กำไร/ขาดทุน (PnL)**: **${fmtSignMoney(pnl, 'THB', 2)} (${fmtPct(pnlPct, 2)})**`)
      lines.push('')
    }
  }

  // 5. Cash Accounts
  if (cashAccounts.length > 0) {
    lines.push(`## 💵 บัญชีเงินสด (Cash Accounts)`)
    for (const acc of cashAccounts) {
      const isUsd = acc.currency === 'USD'
      const thbVal = isUsd ? acc.balance * rate : acc.balance
      const balStr = isUsd
        ? `${fmtMoney(acc.balance, 'USD', 2)} (≈ ${fmtMoney(thbVal, 'THB', 2)})`
        : fmtMoney(acc.balance, 'THB', 2)
      lines.push(`- 🏦 **${acc.name}**: **${balStr}**`)
    }
    lines.push(`- **รวมเงินสดทั้งหมด**: **${fmtMoney(totalCashThb, 'THB', 2)}**`)
    lines.push('')
  }

  lines.push(`---`)
  lines.push(`*Generated by Spendiary*`)

  return lines.join('\n')
}
