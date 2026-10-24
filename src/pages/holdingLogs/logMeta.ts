/** How each activity-log entry is labelled, filtered and described. */
import type { FC } from 'react'
import type { AssetClass, HoldingLog } from '../../lib/types'
import type { IconProps } from '../../components/appIcon'
import { ArrowDownIcon, ArrowUpIcon, DividendIcon, GiftIcon, MoveIcon, PencilIcon, PlusIcon, TagIcon } from '../../components/icons'
import { tintBadge } from '../../components/tones'

export interface ActionMeta {
  label: string
  style: string
  /** Lucide icon for the entry's badge */
  icon: FC<IconProps>
  isPriceUpdate: boolean
}

export function getLogActionMeta(log: HoldingLog): ActionMeta {
  if (log.action === 'note') {
    return {
      label: 'Note',
      style: tintBadge('violet'),
      icon: PencilIcon,
      isPriceUpdate: false,
    }
  }

  if (log.action === 'transfer') {
    return {
      label: 'Transfer',
      style: tintBadge('sky'),
      icon: MoveIcon,
      isPriceUpdate: false,
    }
  }

  if (log.action === 'dividend') {
    return {
      label: 'Dividend',
      style: tintBadge('emerald'),
      icon: DividendIcon,
      isPriceUpdate: false,
    }
  }

  if (log.action === 'sell') {
    return {
      label: 'Sold',
      style: tintBadge('rose'),
      icon: ArrowDownIcon,
      isPriceUpdate: false,
    }
  }

  if ((log.action === 'add' || log.action === 'buy_more') && log.source === 'received') {
    return {
      label: 'Received',
      style: tintBadge('violet'),
      icon: GiftIcon,
      isPriceUpdate: false,
    }
  }

  if (log.action === 'add') {
    return {
      label: 'Added',
      style: 'bg-gain/10 text-gain',
      icon: PlusIcon,
      isPriceUpdate: false,
    }
  }

  // If note indicates Added (e.g. Added "SCB EZ" with balance...)
  if (
    log.note &&
    (log.note.startsWith('Added ') || log.note.startsWith('Created ')) &&
    !log.note.includes('Updated ') &&
    !log.note.includes('Renamed ') &&
    !log.note.includes('Removed ')
  ) {
    return {
      label: 'Added',
      style: 'bg-gain/10 text-gain',
      icon: PlusIcon,
      isPriceUpdate: false,
    }
  }

  if (log.action === 'buy_more') {
    return {
      label: log.dcaPlanId ? 'DCA buy' : 'Bought more',
      style: 'bg-brand/10 text-link',
      icon: ArrowUpIcon,
      isPriceUpdate: false,
    }
  }

  // edit action
  const prev = log.previousHoldingState
  const curr = log.afterHoldingState
  if (prev && curr) {
    const prevUnits = prev.units ?? prev.totalUnits ?? 0
    const currUnits = curr.units ?? curr.totalUnits ?? 0
    const unitsChanged = Math.abs(currUnits - prevUnits) > 0.0001 && Number(currUnits.toFixed(4)) !== Number(prevUnits.toFixed(4))

    const prevBasis = prev.totalThbInvested ?? (prevUnits * (prev.avgCostThb ?? prev.avgCost ?? 0))
    const currBasis = curr.totalThbInvested ?? (currUnits * (curr.avgCostThb ?? curr.avgCost ?? 0))
    const costChanged = Math.abs(currBasis - prevBasis) > 1 && Number(currBasis.toFixed(2)) !== Number(prevBasis.toFixed(2))

    const prevPrice = prev.price ?? 0
    const currPrice = curr.price ?? 0
    const priceChanged = Math.abs(currPrice - prevPrice) > 0.01 && Number(currPrice.toFixed(2)) !== Number(prevPrice.toFixed(2))

    const tickerChanged = !!prev.ticker && !!curr.ticker && prev.ticker !== curr.ticker
    const nameChanged = !!prev.name && !!curr.name && prev.name !== curr.name

    if (tickerChanged || nameChanged) {
      return {
        label: tickerChanged ? 'Ticker Updated' : 'Renamed',
        style: tintBadge('amber'),
        icon: TagIcon,
        isPriceUpdate: false,
      }
    }

    if (priceChanged && !unitsChanged && !costChanged) {
      const isFund = log.assetClass === 'fund'
      return {
        label: isFund ? 'NAV Updated' : 'Price Updated',
        style: tintBadge('sky'),
        icon: TagIcon,
        isPriceUpdate: true,
      }
    }
  }

  if (log.note && (log.note.toLowerCase().includes('ticker') || log.note.toLowerCase().includes('renamed'))) {
    return {
      label: 'Renamed',
      style: tintBadge('amber'),
      icon: TagIcon,
      isPriceUpdate: false,
    }
  }

  if (log.note && (log.note.toLowerCase().includes('price') || log.note.toLowerCase().includes('nav')) && !log.note.includes('+') && !log.note.includes('shares @') && !log.note.includes('units @')) {
    return {
      label: log.assetClass === 'fund' ? 'NAV Updated' : 'Price Updated',
      style: tintBadge('sky'),
      icon: TagIcon,
      isPriceUpdate: true,
    }
  }

  return {
    label: 'Edited',
    style: 'bg-surface-muted text-ink-muted',
    icon: PencilIcon,
    isPriceUpdate: false,
  }
}

export function getDisplayNote(log: HoldingLog): string {
  const prev = log.previousHoldingState
  const curr = log.afterHoldingState

  if (prev && curr && log.action === 'edit') {
    const tickerChanged = !!prev.ticker && !!curr.ticker && prev.ticker !== curr.ticker
    const nameChanged = !!prev.name && !!curr.name && prev.name !== curr.name
    const prevUnits = prev.units ?? prev.totalUnits ?? 0
    const currUnits = curr.units ?? curr.totalUnits ?? 0
    const unitsEqual = Math.abs(currUnits - prevUnits) <= 0.0001 || Number(currUnits.toFixed(4)) === Number(prevUnits.toFixed(4))

    if (tickerChanged && nameChanged) {
      return `Updated name to "${curr.name}" and ticker to ${curr.ticker}`
    }
    if (tickerChanged) {
      return `Updated ticker from ${prev.ticker} → ${curr.ticker}`
    }
    if (nameChanged) {
      return `Renamed from "${prev.name}" → "${curr.name}"`
    }
    if (log.note && (log.note.includes('Units: ') || log.note.includes('shares · cost basis')) && unitsEqual) {
      return `Updated holding details`
    }
  }

  // If price/NAV updated with no custom memo, suppress note as strip & badge show details
  if (log.action === 'edit' && log.note && (log.note.startsWith('Updated NAV to ') || log.note.startsWith('Updated price to '))) {
    return ''
  }

  // Format sell action note: remove redundant units, proceeds, price, and realized PnL.
  // Older logs may contain Thai wording, so each pattern accepts both languages.
  if (log.action === 'sell' && log.note) {
    let n = log.note

    // Remove redundant units sold e.g. "Sold 5,000,000 sats" or "Sold 800 units @ ฿25.50"
    n = n.replace(/^(?:Sold|ขาย)\s+[0-9,.]+\s*(?:sats|g|units|shares)?(?:\s*@[^·\n]+)?\s*(?:·\s*)?/i, '')
    // Remove redundant proceeds e.g. "· Proceeds: ฿146,000"
    n = n.replace(/(?:·\s*)?(?:Proceeds|ได้รับเงิน):\s*[฿$][0-9,.]+\s*(?:·\s*)?/gi, '')
    // Remove redundant realized profit / loss
    n = n.replace(/(?:·\s*)?(?:กำไร|ขาดทุน|Realized PnL):\s*[^·]+(?:\s*·\s*)?/gi, '')
    // Remove redundant price e.g. "@ ฿42,500/baht"
    n = n.replace(/(?:·\s*)?(?:@|ที่ราคา)\s*[฿$]?[0-9,.]+(?:\/[^·\n]+)?(?:\s*·\s*)?/gi, '')
    // Legacy Thai wording for "Deposited to" / "from"
    n = n.replace(/·\s*ฝากเข้า\s*/, '· Deposited to ')
    n = n.replace(/\s+จาก\s+/, ' from ')

    n = n.replace(/\s*·\s*·\s*/g, ' · ').trim()
    n = n.replace(/^·\s*/, '').replace(/\s*·$/, '').trim()
    return n
  }

  // Format buy / add action note: remove redundant units, price, spent amounts
  if ((log.action === 'buy_more' || log.action === 'add') && log.note) {
    let n = log.note

    // Legacy Thai wording -> English
    n = n.replace(/^ซื้อ DCA:\s*/, 'DCA Buy: ').replace(/^ซื้อ\s+/, 'Buy ')
    n = n.replace(/จ่ายจาก\s*/g, 'Paid from ')

    // Remove "+15.2440 g (1.0000 gold baht) · ฿42,500 spent · "
    n = n.replace(/^\+[0-9,.]+\s*g(?:\s*\([^)]+\))?\s*·\s*฿[0-9,.]+\s*(?:spent|worth)\s*·\s*/i, '')
    // Remove "฿42,500 spent · "
    n = n.replace(/(?:·\s*)?฿[0-9,.]+\s*(?:spent|worth)\s*(?:·\s*)?/gi, '')
    // Remove "DCA Buy: 800 units @ ฿22.50 (+฿18,000.00)" or "Buy 800 units @ ฿22.50"
    n = n.replace(/^(?:DCA Buy:|Buy)\s*[0-9,.]+\s*(?:units|shares|g|sats)?\s*@[^·\n(]+(?:\(\+?[฿$][0-9,.]+\))?\s*(?:·\s*)?/i, '')

    n = n.replace(/\s*·\s*·\s*/g, ' · ').trim()
    n = n.replace(/^·\s*/, '').replace(/\s*·$/, '').trim()

    // If only the DCA buy prefix was present without extra memo, provide a clean label
    if (!n && (log.dcaPlanId || log.note.includes('DCA'))) {
      return 'Automatic DCA buy'
    }
    return n
  }

  // Format dividend note: e.g. "Received dividend ฿3,024.00 (DPS: ฿0.28, Tax 10%: -฿336.00) into SCB Easy"
  if (log.action === 'dividend' && log.note) {
    const intoMatch = log.note.match(/into\s+([^·\n]+)/i)
    if (intoMatch) {
      return `Dividend paid into ${intoMatch[1].trim()}`
    }
    let n = log.note.replace(/Received dividend\s*฿?[0-9,.]+(?:\s*\([^)]+\))?\s*/i, '')
    n = n.replace(/\s*·\s*·\s*/g, ' · ').trim()
    n = n.replace(/^·\s*/, '').replace(/\s*·$/, '').trim()
    return n || 'Dividend received'
  }

  return log.note
}

// Helper to detect destination wallet / storage location
export function getDestinationLocation(log: HoldingLog): string | null {
  // Cash Accounts / Wallet names
  if (log.assetClass === 'cash' || log.ticker === 'CASH' || log.holdingName === 'Cash Accounts') {
    // 1. Check for Renamed "X" to "Y"
    const renameMatches = [...log.note.matchAll(/Renamed\s*"[^"]+"\s*to\s*"([^"]+)"/g)]
    if (renameMatches.length > 0) {
      return renameMatches.map((m) => m[1]).join(', ')
    }

    // 2. Check for Added / Updated / Changed / Removed "X"
    const quoteMatches = [...log.note.matchAll(/(?:Added|Updated|Changed|Removed)\s*"([^"]+)"/g)]
    if (quoteMatches.length > 0) {
      return quoteMatches.map((m) => m[1]).join(', ')
    }

    // 3. Check for DCA into X
    const dcaMatch = log.note.match(/into\s+([^·\n]+)$/)
    if (dcaMatch) return dcaMatch[1].trim()
  }

  // Fixed Costs
  if (log.ticker === 'FIXED' || log.holdingName.startsWith('Fixed Cost:')) {
    return 'Fixed Cost'
  }

  const prev = log.previousHoldingState
  const curr = log.afterHoldingState

  if (log.assetClass === 'crypto') {
    const prevLocs = prev?.btcLocations ?? []
    const currLocs = curr?.btcLocations ?? []
    for (const c of currLocs) {
      const p = prevLocs.find((item) => item.id === c.id || item.name === c.name)
      if (!p || c.satoshi > p.satoshi || c.thbSpent > p.thbSpent) {
        return c.name
      }
    }
    if (currLocs.length === 1) return currLocs[0].name
  }

  if (log.assetClass === 'gold') {
    const prevLocs = prev?.goldLocations ?? []
    const currLocs = curr?.goldLocations ?? []
    for (const c of currLocs) {
      const p = prevLocs.find((item) => item.id === c.id || item.name === c.name)
      if (!p || c.grams > p.grams || c.thbSpent > p.thbSpent) {
        return c.name
      }
    }
    if (currLocs.length === 1) return currLocs[0].name
  }

  if (log.note) {
    const depMatch = log.note.match(/Deposited to\s*([^·\n]+)/)
    const fromMatch = log.note.match(/from\s*([^·\n]+?)\s*·\s*Proceeds/)
    if (fromMatch && depMatch) {
      return `${fromMatch[1].trim()} → ${depMatch[1].trim()}`
    }
    if (depMatch) {
      return depMatch[1].trim()
    }
    const paidMatch = log.note.match(/Paid from\s*([^·\n]+)/)
    if (paidMatch) {
      return paidMatch[1].trim()
    }
    if (log.action === 'sell' && fromMatch) {
      return fromMatch[1].trim()
    }

    const match = log.note.match(/(?:·|→)\s*([A-Za-z0-9\s_-]+)$/)
    if (match && match[1]) {
      const name = match[1].trim()
      if (!name.startsWith('(+') && !name.startsWith('฿') && !name.startsWith('$') && !name.endsWith('spent')) {
        return name
      }
    }
  }

  return null
}

export const ASSET_FILTERS: { key: AssetClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fund', label: 'Thai assets' },
  { key: 'stock', label: 'US stocks' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'gold', label: 'Gold' },
  { key: 'real_estate', label: 'Real estate' },
  { key: 'cash', label: 'Cash' },
]

export function getLogAssetLabel(log: HoldingLog): string {
  if (log.ticker === 'FIXED') return 'expense'
  return ASSET_FILTERS.find((filter) => filter.key === log.assetClass)?.label ?? log.assetClass
}

export const ACTION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'buy', label: 'Buy / add' },
  { key: 'sell', label: 'Sold' },
  { key: 'dividend', label: 'Dividend' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'edit', label: 'Edited' },
] as const

/** Buy / add entries for a real holding — the ones that can be a purchase or a gift */
export function isAcquisitionLog(log: HoldingLog): boolean {
  return (log.action === 'add' || log.action === 'buy_more') && log.assetClass !== 'cash' && log.ticker !== 'IMPORT'
}
