import type { SpendiaryData } from './types'
import {
  ASSET_META,
  GRAMS_PER_BAHT_GOLD,
  SATS_PER_BTC,
  assetGroupAllocations,
  dcaPerMonth,
  dcaThisMonth,
  goldThbPerBahtToXauUsd,
  isBuyDayOverdue,
  isBuyDayToday,
  isConfirmedForPeriod,
  isSkippedForPeriod,
  nextBuyDate,
  planMonthlyEquivalent,
  portfolioSummary,
  sortDcaPlans,
} from './calc'

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
  const dcaPlans = data.dcaPlans ?? []
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

  // Asset Group Allocation
  const groupAllocs = assetGroupAllocations(holdings)
  if (groupAllocs.length > 0) {
    lines.push(`## 🎯 สัดส่วนตามกลุ่มสินทรัพย์ (Asset Group Allocation)`)
    for (const g of groupAllocs) {
      lines.push(`- **${g.name}**: **${fmtMoney(g.value, 'THB')}** (**${g.pct.toFixed(1)}%**) · PnL: ${fmtSignMoney(g.pnl, 'THB')} (${fmtPct(g.pnlPct)})`)
    }
    lines.push('')
  }

  // Summary Table
  if (holdings.length > 0) {
    lines.push(`## 📋 ตารางสรุปรายการถือครอง (Holdings Summary)`)
    lines.push(`| สินทรัพย์ (Asset) | ประเภท | จำนวนที่ถือ (Quantity) | ต้นทุนเฉลี่ย (Avg Cost) | ราคาปัจจุบัน (Price) | ต้นทุนรวม (Cost) | มูลค่าปัจจุบัน (Value) | กำไร/ขาดทุน (PnL) |`)
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`)

    for (const h of holdings) {
      const isStock = h.assetClass === 'stock'
      const isCrypto = h.assetClass === 'crypto'
      const isGold = h.assetClass === 'gold'
      const isRealEstate = h.assetClass === 'real_estate'

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
        const isBitcoin = h.ticker.toUpperCase() === 'BTC' || h.name.toLowerCase().includes('bitcoin')
        typeLabel = isBitcoin ? 'บิตคอยน์ (BTC)' : `คริปโต (${h.ticker || 'Crypto'})`
        if (isBitcoin) {
          const sats = Math.round(h.units * SATS_PER_BTC)
          qtyStr = `${sats.toLocaleString()} sats<br/>(${fmtNum(h.units, 8)} BTC)`
        } else {
          qtyStr = `${fmtNum(h.units, 8)} ${h.ticker || 'units'}`
        }
        const avgCostPerUnit = h.units > 0 ? costBasis / h.units : h.avgCost
        avgCostStr = `${fmtMoney(avgCostPerUnit, 'THB', 8)}/unit`
        priceStr = `${fmtMoney(h.price, 'THB', 8)}/unit`
      } else if (isGold) {
        typeLabel = 'ทองคำ (Gold)'
        const bahtGold = h.units / GRAMS_PER_BAHT_GOLD
        qtyStr = `${fmtNum(bahtGold, 4)} บาททอง<br/>(${fmtNum(h.units, 4)} g)`
        const avgCostPerBaht = (h.units > 0 ? costBasis / h.units : h.avgCost) * GRAMS_PER_BAHT_GOLD
        const avgCostXauUsd = goldThbPerBahtToXauUsd(avgCostPerBaht, rate)
        const pricePerBaht = h.price * GRAMS_PER_BAHT_GOLD
        const priceXauUsd = goldThbPerBahtToXauUsd(pricePerBaht, rate)
        avgCostStr = `${fmtMoney(avgCostPerBaht, 'THB', 0)}/บาททอง<br/>(${fmtMoney(avgCostXauUsd, 'USD', 0)}/oz)`
        priceStr = `${fmtMoney(pricePerBaht, 'THB', 0)}/บาททอง<br/>(${fmtMoney(priceXauUsd, 'USD', 0)}/oz)`
      } else if (isRealEstate) {
        typeLabel = 'อสังหาริมทรัพย์'
        qtyStr = `${h.units} หลัง/ห้อง`
        avgCostStr = fmtMoney(h.avgCost, 'THB')
        priceStr = fmtMoney(h.price, 'THB')
      }

      const pnlStr = `${fmtSignMoney(pnl, 'THB', 2)}<br/>(${fmtPct(pnlPct, 2)})`
      const tagBadge = h.tag ? ` \`#${h.tag}\`` : ''
      lines.push(`| **${h.name}** (${h.ticker})${tagBadge} | ${typeLabel} | ${qtyStr} | ${avgCostStr} | ${priceStr} | ${totalCostStr} | ${marketValStr} | ${pnlStr} |`)
    }
    lines.push('')
  }

  // Storage / Custody Locations (Only for BTC & Gold that have custody breakdowns)
  const holdingsWithLocations = holdings.filter(
    (h) => (h.btcLocations && h.btcLocations.length > 0) || (h.goldLocations && h.goldLocations.length > 0),
  )
  if (holdingsWithLocations.length > 0) {
    lines.push(`## 📍 แหล่งจัดเก็บสินทรัพย์ (Storage & Custody Locations)`)
    for (const h of holdingsWithLocations) {
      if (h.btcLocations && h.btcLocations.length > 0) {
        lines.push(`### 🪙 ${h.name} (\`${h.ticker}\`)`)
        for (const loc of h.btcLocations) {
          const locCostPerBtc = loc.satoshi > 0 ? (loc.thbSpent / loc.satoshi) * SATS_PER_BTC : 0
          const locCostPerBtcUsd = rate > 0 ? locCostPerBtc / rate : 0
          lines.push(`- 📍 **${loc.name}**: ${loc.satoshi.toLocaleString()} sats (${(loc.satoshi / SATS_PER_BTC).toFixed(8)} BTC) | ทุน: ${fmtMoney(loc.thbSpent, 'THB', 2)} | ทุนเฉลี่ย: ${fmtMoney(locCostPerBtcUsd, 'USD', 0)}/BTC (≈ ${fmtMoney(locCostPerBtc, 'THB', 0)})`)
        }
        lines.push('')
      }
      if (h.goldLocations && h.goldLocations.length > 0) {
        lines.push(`### 👑 ${h.name} (\`${h.ticker}\`)`)
        for (const loc of h.goldLocations) {
          const locBaht = loc.grams / GRAMS_PER_BAHT_GOLD
          const locCostPerBaht = loc.grams > 0 ? (loc.thbSpent / loc.grams) * GRAMS_PER_BAHT_GOLD : 0
          const locCostXauUsd = goldThbPerBahtToXauUsd(locCostPerBaht, rate)
          lines.push(`- 📍 **${loc.name}**: ${fmtNum(locBaht, 4)} บาททอง (${fmtNum(loc.grams, 4)} g) | ทุน: ${fmtMoney(loc.thbSpent, 'THB', 2)} | ทุนเฉลี่ย: ${fmtMoney(locCostPerBaht, 'THB', 0)}/บาททอง (${fmtMoney(locCostXauUsd, 'USD', 0)}/oz)`)
        }
        lines.push('')
      }
    }
  }

  // Real Estate (if any)
  const realEstates = holdings.filter((h) => h.assetClass === 'real_estate')
  if (realEstates.length > 0) {
    lines.push(`## 🏠 อสังหาริมทรัพย์ (Real Estate)`)
    for (const h of realEstates) {
      const marketValue = h.units * h.price
      const costBasis = h.totalThbInvested ?? (h.units * h.avgCost)
      const pnl = marketValue - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0

      lines.push(`### 🔹 ${h.name} (\`${h.ticker}\`)${h.tag ? ` - \`#${h.tag}\`` : ''}`)
      lines.push(`- **จำนวนยูนิต/หลัง**: **${h.units} หลัง/ห้อง**`)
      lines.push(`- **ต้นทุนเงินลงทุนรวม**: **${fmtMoney(costBasis, 'THB', 2)}**`)
      lines.push(`- **มูลค่าประเมิน/ราคาตลาดปัจจุบัน**: **${fmtMoney(marketValue, 'THB', 2)}**`)
      lines.push(`- **ส่วนต่างกำไร/ขาดทุนประเมิน (PnL)**: **${fmtSignMoney(pnl, 'THB', 2)} (${fmtPct(pnlPct, 2)})**`)
      lines.push('')
    }
  }

  // DCA Plans & Schedule
  if (dcaPlans.length > 0) {
    const sortedPlans = sortDcaPlans(dcaPlans, now)
    const monthlyTotal = dcaPerMonth(dcaPlans, now)
    const dcaMonth = dcaThisMonth(dcaPlans, now)

    lines.push(`## 🎯 แผนการลงทุนสะสม (DCA Plans)`)
    lines.push(`- **งบ DCA รวมต่อเดือน (Monthly Budget)**: **${fmtMoney(monthlyTotal, 'THB')}**`)
    lines.push(`- **ความคืบหน้างวดเดือนนี้**: ซื้อแล้ว **${fmtMoney(dcaMonth.invested, 'THB')}** (${dcaMonth.pct.toFixed(1)}%) · รอซื้อ **${fmtMoney(dcaMonth.upcoming, 'THB')}**`)
    lines.push(`- **จำนวนแผน DCA ทั้งหมด**: **${dcaPlans.length} รายการ**`)
    lines.push('')
    lines.push(`| แผน DCA (Plan) | สินทรัพย์ | ความถี่ | กำหนดซื้อ | ยอดต่องวด | เทียบเท่า/เดือน | สถานะงวดนี้ |`)
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`)

    const weekdayNames = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']

    for (const p of sortedPlans) {
      const freq = p.frequency ?? 'monthly'
      let freqLabel = 'รายเดือน'
      let schedLabel = `ทุกวันที่ ${p.dayOfMonth}`

      if (freq === 'daily') {
        freqLabel = 'รายวัน'
        schedLabel = 'ทุกวัน'
      } else if (freq === 'weekly') {
        freqLabel = 'รายสัปดาห์'
        schedLabel = `ทุกวัน${weekdayNames[p.dayOfMonth] ?? p.dayOfMonth}`
      }

      const meta = ASSET_META[p.assetClass]
      const assetLabel = meta?.label ?? p.assetClass
      const monthlyEquiv = planMonthlyEquivalent(p, now)

      const confirmed = isConfirmedForPeriod(p, now)
      const skipped = isSkippedForPeriod(p, now)
      const isOverdue = isBuyDayOverdue(p, now) && !confirmed && !skipped
      const isToday = isBuyDayToday(p, now) && !confirmed && !skipped
      const next = nextBuyDate(p, now)
      const nextDateStr = next.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

      let statusLabel = `⏳ รอซื้อ (${nextDateStr})`
      if (confirmed) {
        statusLabel = `✅ ซื้อแล้ว`
      } else if (skipped) {
        statusLabel = `⏭️ ข้ามงวดนี้`
      } else if (isToday) {
        statusLabel = `🔔 ซื้อวันนี้`
      } else if (isOverdue) {
        statusLabel = `⚠️ เลยกำหนด (${nextDateStr})`
      }

      const planName = p.ticker ? `**${p.name}** (\`${p.ticker}\`)` : `**${p.name}**`
      lines.push(`| ${planName} | ${assetLabel} | ${freqLabel} | ${schedLabel} | ${fmtMoney(p.monthlyAmount, 'THB')} | ${fmtMoney(monthlyEquiv, 'THB')} | ${statusLabel} |`)
    }
    lines.push('')
  }

  // Cash Accounts
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
