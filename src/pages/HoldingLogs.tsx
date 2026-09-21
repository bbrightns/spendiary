import { useState, Fragment } from 'react'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { FilterChip } from '../components/ui/FilterChip'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { ASSET_META, GRAMS_PER_BAHT_GOLD, SATS_PER_BTC } from '../lib/calc'
import { getCashDiffItems, getLogTransactionDetails } from '../lib/activitySummary'
import { dateStrToTimestamp, localDateStr, thb } from '../lib/format'
import type { AssetClass, HoldingLog } from '../lib/types'
import {
  ClockIcon,
  DownloadIcon,
  ListIcon,
  PencilIcon,
  SearchIcon,
  TableIcon,
  UndoIcon,
  WalletIcon,
} from '../components/icons'
import { TransactionDateField } from '../components/forms/TransactionDateField'


interface ActionMeta {
  label: string
  style: string
  icon: string
  isPriceUpdate: boolean
}

function getLogActionMeta(log: HoldingLog): ActionMeta {
  if (log.action === 'dividend') {
    return {
      label: 'Dividend',
      style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      icon: '💰',
      isPriceUpdate: false,
    }
  }

  if (log.action === 'sell') {
    return {
      label: 'Sold',
      style: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
      icon: '↓',
      isPriceUpdate: false,
    }
  }

  if (log.action === 'add') {
    return {
      label: 'Added',
      style: 'bg-gain/10 text-gain',
      icon: '+',
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
      icon: '+',
      isPriceUpdate: false,
    }
  }

  if (log.action === 'buy_more') {
    return {
      label: log.dcaPlanId ? 'DCA Buy' : 'Bought more',
      style: 'bg-brand/10 text-brand',
      icon: '↑',
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
        style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        icon: '🏷️',
        isPriceUpdate: false,
      }
    }

    if (priceChanged && !unitsChanged && !costChanged) {
      const isFund = log.assetClass === 'fund'
      return {
        label: isFund ? 'NAV Updated' : 'Price Updated',
        style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
        icon: '🏷️',
        isPriceUpdate: true,
      }
    }
  }

  if (log.note && (log.note.toLowerCase().includes('ticker') || log.note.toLowerCase().includes('renamed'))) {
    return {
      label: 'Renamed',
      style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      icon: '🏷️',
      isPriceUpdate: false,
    }
  }

  if (log.note && (log.note.toLowerCase().includes('price') || log.note.toLowerCase().includes('nav')) && !log.note.includes('+') && !log.note.includes('shares @') && !log.note.includes('units @')) {
    return {
      label: log.assetClass === 'fund' ? 'NAV Updated' : 'Price Updated',
      style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
      icon: '🏷️',
      isPriceUpdate: true,
    }
  }

  return {
    label: 'Edited',
    style: 'bg-surface-muted text-ink-muted',
    icon: '✎',
    isPriceUpdate: false,
  }
}

function getDisplayNote(log: HoldingLog): string {
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

  // Format sell action note: remove redundant units, proceeds, price, and realized PnL
  if (log.action === 'sell' && log.note) {
    let n = log.note
    if (n.startsWith('Sold ')) {
      n = n.replace(/^Sold\s+/, 'ขาย ')
      n = n.replace(/\s+from\s+/, ' จาก ')
      n = n.replace(/·\s*Proceeds:\s*/, '· ได้รับเงิน: ')
      n = n.replace(/·\s*Deposited to\s*/, '· ฝากเข้า ')
    }

    // Remove redundant units sold e.g. "ขาย 5,000,000 sats" or "ขาย 800 units @ ฿25.50"
    n = n.replace(/^ขาย\s+[0-9,.]+\s*(?:sats|g|units|shares)?(?:\s*@[^·\n]+)?\s*(?:·\s*)?/i, '')
    // Remove redundant proceeds e.g. "· ได้รับเงิน: ฿146,000" or "ได้รับเงิน: ฿146,000"
    n = n.replace(/(?:·\s*)?ได้รับเงิน:\s*[฿$][0-9,.]+\s*(?:·\s*)?/gi, '')
    n = n.replace(/(?:·\s*)?Proceeds:\s*[฿$][0-9,.]+\s*(?:·\s*)?/gi, '')
    // Remove redundant Realized PnL / กำไร / ขาดทุน
    n = n.replace(/(?:·\s*)?(?:กำไร|ขาดทุน|Realized PnL):\s*[^·]+(?:\s*·\s*)?/gi, '')
    // Remove redundant price e.g. "ที่ราคา ฿42,500/บาททอง"
    n = n.replace(/(?:·\s*)?(?:@|ที่ราคา)\s*[฿$]?[0-9,.]+(?:\/[^·\n]+)?(?:\s*·\s*)?/gi, '')

    n = n.replace(/\s*·\s*·\s*/g, ' · ').trim()
    n = n.replace(/^·\s*/, '').replace(/\s*·$/, '').trim()
    return n
  }

  // Format buy / add action note: remove redundant units, price, spent amounts
  if ((log.action === 'buy_more' || log.action === 'add') && log.note) {
    let n = log.note

    // Translate common prefixes
    if (n.startsWith('DCA Buy: ')) {
      n = n.replace(/^DCA Buy:\s*/, 'ซื้อ DCA: ')
    } else if (n.startsWith('Buy ')) {
      n = n.replace(/^Buy\s+/, 'ซื้อ ')
    }

    // Replace Paid from -> จ่ายจาก
    n = n.replace(/·\s*Paid from\s*/g, '· จ่ายจาก ')
    n = n.replace(/Paid from\s*/g, 'จ่ายจาก ')

    // Replace Deposited ... via DCA into ... -> ฝาก ... ผ่าน DCA เข้า ...
    if (n.startsWith('Deposited ')) {
      n = n.replace(/^Deposited\s+/, 'ฝาก ')
      n = n.replace(/\s+via\s+DCA\s+into\s+/, ' ผ่าน DCA เข้า ')
      n = n.replace(/\s+into\s+/, ' เข้า ')
    }

    // Remove "+15.2440 g (1.0000 บาททอง) · ฿42,500 spent · "
    n = n.replace(/^\+[0-9,.]+\s*g(?:\s*\([^)]+\))?\s*·\s*฿[0-9,.]+\s*spent\s*·\s*/i, '')
    // Remove "฿42,500 spent · "
    n = n.replace(/(?:·\s*)?฿[0-9,.]+\s*spent\s*(?:·\s*)?/gi, '')
    // Remove "ซื้อ DCA: 800 units @ ฿22.50 (+฿18,000.00)" or "ซื้อ 800 units @ ฿22.50"
    n = n.replace(/^(?:ซื้อ DCA:|ซื้อ)\s*[0-9,.]+\s*(?:units|shares|g|sats)?\s*@[^·\n(]+(?:\(\+?[฿$][0-9,.]+\))?\s*(?:·\s*)?/i, '')

    n = n.replace(/\s*·\s*·\s*/g, ' · ').trim()
    n = n.replace(/^·\s*/, '').replace(/\s*·$/, '').trim()

    // If only DCA buy prefix was present without extra memo, provide clean label
    if (!n && (log.dcaPlanId || log.note.includes('DCA'))) {
      return 'ซื้อแบบ DCA (อัตโนมัติ)'
    }
    return n
  }

  // Format dividend note: e.g. "Received dividend ฿3,024.00 (DPS: ฿0.28, Tax 10%: -฿336.00) into SCB Easy (ใช้จ่ายทั่วไป & QR)"
  if (log.action === 'dividend' && log.note) {
    const intoMatch = log.note.match(/into\s+([^·\n]+)/i)
    if (intoMatch) {
      return `เงินปันผลเข้าบัญชี ${intoMatch[1].trim()}`
    }
    let n = log.note.replace(/Received dividend\s*฿?[0-9,.]+(?:\s*\([^)]+\))?\s*/i, '')
    n = n.replace(/\s*·\s*·\s*/g, ' · ').trim()
    n = n.replace(/^·\s*/, '').replace(/\s*·$/, '').trim()
    return n || 'รับเงินปันผล'
  }

  return log.note
}

// Helper to detect destination wallet / storage location
function getDestinationLocation(log: HoldingLog): string | null {
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

const ASSET_FILTERS: { key: AssetClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fund', label: 'Thai Assets' },
  { key: 'stock', label: 'US Stocks' },
  { key: 'crypto', label: 'Bitcoin' },
  { key: 'gold', label: 'Gold' },
  { key: 'real_estate', label: 'Real Estate' },
  { key: 'cash', label: 'Cash' },
]

const ACTION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'buy', label: 'Buy / Add' },
  { key: 'sell', label: 'Sold' },
  { key: 'dividend', label: 'Dividend' },
  { key: 'edit', label: 'Edited' },
] as const

export function HoldingLogs() {
  const {
    steps,
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  } = usePageGuide('logs')
  const { data, undoHoldingLog, updateHoldingLogTimestamp, usdThb } = useData()
  const { showToast } = useToast()
  const rawLogs = data.holdingLogs ?? []
  const logs = [...rawLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const [undoTarget, setUndoTarget] = useState<HoldingLog | null>(null)
  const [editingDateLog, setEditingDateLog] = useState<HoldingLog | null>(null)
  const [editDateValue, setEditDateValue] = useState<string>('')
  const [editTimeValue, setEditTimeValue] = useState<string>('')

  function startEditDate(log: HoldingLog) {
    setEditingDateLog(log)
    const dt = new Date(log.timestamp)
    setEditDateValue(localDateStr(dt))
    setEditTimeValue(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
  }

  const [assetFilter, setAssetFilter] = useState<AssetClass | 'all'>('all')
  const [actionFilter, setActionFilter] = useState<'all' | 'buy' | 'sell' | 'dividend' | 'edit'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>(() => {
    const saved = localStorage.getItem('spendiary_logs_view_mode')
    if (saved === 'timeline' || saved === 'table') return saved
    return 'table'
  })
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())

  const toggleDetails = (logId: string) => {
    setExpandedDetails((prev) => {
      const next = new Set(prev)
      if (next.has(logId)) next.delete(logId)
      else next.add(logId)
      return next
    })
  }

  const handleViewModeChange = (mode: 'table' | 'timeline') => {
    setViewMode(mode)
    localStorage.setItem('spendiary_logs_view_mode', mode)
  }

  const filtered = logs.filter((l) => {
    if (assetFilter !== 'all' && l.assetClass !== assetFilter) return false
    if (actionFilter !== 'all') {
      if (actionFilter === 'buy') {
        if (l.action !== 'add' && l.action !== 'buy_more') return false
      } else if (l.action !== actionFilter) {
        return false
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const loc = getDestinationLocation(l)?.toLowerCase() || ''
      const actionMeta = getLogActionMeta(l)
      const match =
        l.ticker?.toLowerCase().includes(q) ||
        l.holdingName.toLowerCase().includes(q) ||
        l.note.toLowerCase().includes(q) ||
        l.assetClass.toLowerCase().includes(q) ||
        actionMeta.label.toLowerCase().includes(q) ||
        loc.includes(q)
      if (!match) return false
    }

    return true
  })

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      showToast('No transactions to export', 'error')
      return
    }

    const headers = [
      'Date',
      'Time',
      'Action',
      'Asset Class',
      'Ticker',
      'Holding Name',
      'Units / Shares',
      'Price',
      'Total Amount (THB)',
      'Realized PnL (THB)',
      'Wallet / Location',
      'Note',
    ]

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return ''
      const str = String(val).trim()
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = filtered.map((log) => {
      const dt = new Date(log.timestamp)
      const dateStr = dt.toISOString().slice(0, 10)
      const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      const actionMeta = getLogActionMeta(log)
      const locName = getDestinationLocation(log)
      const tx = getLogTransactionDetails(log, usdThb)
      const noteStr = getDisplayNote(log)
      const realizedPnLStr = log.realizedPnL !== undefined
        ? log.realizedPnL.toFixed(2)
        : (log.note.match(/Realized PnL:\s*([+-]?฿[0-9,.]+)/) ? log.note.match(/Realized PnL:\s*([+-]?฿[0-9,.]+)/)![1].replace(/[฿,]/g, '') : '')

      return [
        escapeCsv(dateStr),
        escapeCsv(timeStr),
        escapeCsv(actionMeta.label),
        escapeCsv(log.assetClass),
        escapeCsv(log.ticker || ''),
        escapeCsv(log.holdingName),
        escapeCsv(tx.sharesDisplay !== '-' ? tx.sharesDisplay : ''),
        escapeCsv(tx.priceDisplay !== '-' ? tx.priceDisplay : ''),
        escapeCsv(tx.amountThbValue !== null ? tx.amountThbValue.toFixed(2) : ''),
        escapeCsv(realizedPnLStr),
        escapeCsv(locName || ''),
        escapeCsv(noteStr),
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spendiary-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast(`Exported ${filtered.length} transaction${filtered.length === 1 ? '' : 's'} to CSV`, 'success')
  }

  // Group by date
  const groups: { date: string; entries: typeof filtered }[] = []
  for (const log of filtered) {
    const date = new Date(log.timestamp).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    })
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.entries.push(log)
    } else {
      groups.push({ date, entries: [log] })
    }
  }

  // Helper to render before -> after comparison details
  const renderStateComparison = (log: typeof filtered[number]) => {
    // ── Dividend Action: Unified 3-Column Summary Strip ──
    if (log.action === 'dividend') {
      const netDiv = log.netDividend ?? (log.note.match(/(?:dividend|ปันผล)\s*฿([0-9,.]+)/i) ? parseFloat(log.note.match(/(?:dividend|ปันผล)\s*฿([0-9,.]+)/i)![1].replace(/,/g, '')) : null)
      const tax = log.withholdingTax ?? (log.note.match(/Tax[^:]*:\s*-?฿([0-9,.]+)/i) ? parseFloat(log.note.match(/Tax[^:]*:\s*-?฿([0-9,.]+)/i)![1].replace(/,/g, '')) : null)
      const dps = log.dividendPerShare ?? (log.note.match(/DPS:\s*฿([0-9,.]+)/i) ? parseFloat(log.note.match(/DPS:\s*฿([0-9,.]+)/i)![1].replace(/,/g, '')) : null)
      const gross = log.grossDividend ?? (netDiv !== null && tax !== null ? netDiv + tax : null)
      const prevHold = log.previousHoldingState
      const currHold = log.afterHoldingState
      const holdingUnits = currHold?.units ?? currHold?.totalUnits ?? prevHold?.units ?? prevHold?.totalUnits ?? (gross && dps && dps > 0 ? Math.round(gross / dps) : null)
      const cashAccMatch = log.note.match(/(?:into|เข้า)\s*([^·\n()]+)/i)
      const cashAccName = cashAccMatch ? cashAccMatch[1].trim() : (log.cashAccountId ? data.cashAccounts?.find((c) => c.id === log.cashAccountId)?.name : undefined)

      return (
        <div className="rounded-2xl border border-line/70 bg-surface-muted/40 dark:bg-surface-muted/20 p-2.5 sm:p-3 space-y-2.5">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Col 1: ปันผลสุทธิ */}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                <span>💰</span> <span className="truncate">ปันผลสุทธิ</span>
              </span>
              <div className="text-sm sm:text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                {netDiv !== null ? `฿${netDiv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
              </div>
              <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={cashAccName ? `เข้า ${cashAccName}` : 'รับเข้ากระเป๋า'}>
                {cashAccName ? `เข้า ${cashAccName}` : 'รับเข้ากระเป๋า'}
              </span>
            </div>

            {/* Col 2: หักภาษี */}
            <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
              <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                <span>🏛️</span> <span className="truncate">หักภาษี (10%)</span>
              </span>
              <div className="text-sm sm:text-base font-extrabold tracking-tight text-loss/90 truncate mt-0.5">
                {tax !== null ? `-฿${tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
              </div>
              {gross !== null && (
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={`ยอดรวม ฿${gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                  ยอดรวม ฿{gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Col 3: ปันผลต่อหุ้น */}
            <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
              <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                <span>🏷️</span> <span className="truncate">ปันผลต่อหุ้น</span>
              </span>
              <div className="text-sm sm:text-base font-extrabold tracking-tight text-ink truncate mt-0.5">
                {dps !== null ? `฿${dps.toLocaleString()}/หุ้น` : '-'}
              </div>
              {holdingUnits && (
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={`จาก ${holdingUnits.toLocaleString()} หุ้น`}>
                  จาก {holdingUnits.toLocaleString()} หุ้น
                </span>
              )}
            </div>
          </div>
        </div>
      )
    }

    const prev = log.previousHoldingState
    const curr = log.afterHoldingState ?? (log.action === 'sell' && prev ? { ...prev, units: 0, totalUnits: 0, totalThbInvested: 0 } : null)

    if (!prev || !curr) {
      const cashItems = getCashDiffItems(log)
      if (cashItems.length > 0) {
        return (
          <div className="rounded-2xl border border-line/70 bg-surface-muted/40 dark:bg-surface-muted/20 p-2.5 sm:p-3 text-xs space-y-2.5">
            {cashItems.map((item, idx) => {
              const sym = item.currencySymbol
              const hasNameChange = item.prevName && item.currName && item.prevName !== item.currName

              return (
                <div key={idx} className={idx > 0 ? 'pt-2.5 border-t border-line/60 space-y-2' : 'space-y-2'}>
                  {/* Account Name Row */}
                  {hasNameChange && (
                    <div>
                      <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                        Account Name
                      </span>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                        <span className="whitespace-nowrap">{item.prevName}</span>
                        <span className="text-ink-faint text-xs">→</span>
                        <span className="font-semibold text-brand whitespace-nowrap">{item.currName}</span>
                      </div>
                    </div>
                  )}

                  {/* Account Balance Row */}
                  <div>
                    <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                      {item.actionType === 'add' ? `New Account: ${item.accountName}` : `Balance: ${item.accountName}`}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                      {item.actionType === 'add' ? (
                        <>
                          <span className="text-ink-muted text-xs">(New Account)</span>
                          <span className="text-ink-faint text-xs">→</span>
                          <span className="font-bold text-gain whitespace-nowrap">
                            {sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap bg-gain/10 text-gain">
                            +{sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </>
                      ) : item.actionType === 'remove' ? (
                        <>
                          <span className="whitespace-nowrap">
                            {sym}{item.prevBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-ink-faint text-xs">→</span>
                          <span className="font-bold text-loss whitespace-nowrap">(Removed)</span>
                        </>
                      ) : (
                        <>
                          {item.prevBalance !== undefined && (
                            <>
                              <span className="whitespace-nowrap">
                                {sym}{item.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-ink-faint text-xs">→</span>
                            </>
                          )}
                          <span className="font-bold text-brand whitespace-nowrap">
                            {sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {item.diff !== undefined && Math.abs(item.diff) > 0.001 && (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${
                                item.diff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                              }`}
                            >
                              {item.diff > 0 ? '+' : ''}{sym}{Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      return null
    }

    const prevUnits = prev.units ?? prev.totalUnits ?? 0
    const currUnits = curr.units ?? curr.totalUnits ?? 0
    const unitDiff = currUnits - prevUnits
    const unitsChanged = Math.abs(unitDiff) > 0.0001 && Number(currUnits.toFixed(4)) !== Number(prevUnits.toFixed(4))

    const prevBasis = prev.totalThbInvested ?? (prevUnits * (prev.avgCostThb ?? prev.avgCost ?? 0))
    const currBasis = curr.totalThbInvested ?? (currUnits * (curr.avgCostThb ?? curr.avgCost ?? 0))
    const prevAvgCostThb = prevUnits > 0 ? prevBasis / prevUnits : (prev.avgCostThb ?? prev.avgCost ?? 0)
    const currAvgCostThb = currUnits > 0 ? currBasis / currUnits : (curr.avgCostThb ?? curr.avgCost ?? 0)
    const avgCostDiffThb = currAvgCostThb - prevAvgCostThb
    const avgCostChanged = Math.abs(avgCostDiffThb) > 0.01 && Number(currAvgCostThb.toFixed(2)) !== Number(prevAvgCostThb.toFixed(2))

    const fx = usdThb && usdThb > 0 ? usdThb : 34

    // Price change calculations
    const prevPriceThb = prev.price ?? 0
    const currPriceThb = curr.price ?? 0
    const priceDiffThb = currPriceThb - prevPriceThb
    const priceChanged = Math.abs(priceDiffThb) > 0.01 && Number(currPriceThb.toFixed(2)) !== Number(prevPriceThb.toFixed(2))

    const tickerChanged = !!prev.ticker && !!curr.ticker && prev.ticker !== curr.ticker
    const nameChanged = !!prev.name && !!curr.name && prev.name !== curr.name

    const formatUnit = (val: number) => {
      if (log.assetClass === 'crypto') {
        const sats = Math.round(val * SATS_PER_BTC)
        return `${sats.toLocaleString()} sats`
      }
      if (log.assetClass === 'gold') return `${val.toFixed(4)} g (${(val / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททอง)`
      if (log.assetClass === 'stock') return val.toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' shares'
      return val.toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' units'
    }

    const formatUnitDiff = (diff: number) => {
      const prefix = diff > 0 ? '+' : ''
      if (log.assetClass === 'crypto') {
        const sats = Math.round(diff * SATS_PER_BTC)
        return `${prefix}${sats.toLocaleString()} sats`
      }
      if (log.assetClass === 'gold') {
        return `${prefix}${diff.toFixed(4)} g`
      }
      if (log.assetClass === 'stock') {
        return `${prefix}${diff.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares`
      }
      return `${prefix}${diff.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
    }

    // Format average cost per asset class
    let prevAvgCostDisplay = ''
    let currAvgCostDisplay = ''
    let avgCostDeltaBadge: { text: string; positive: boolean } | null = null

    if (log.assetClass === 'crypto') {
      const prevUsd = (prev.avgCostUsd && prev.avgCostUsd > 0) ? prev.avgCostUsd : (fx > 0 ? prevAvgCostThb / fx : 0)
      const currUsd = (curr.avgCostUsd && curr.avgCostUsd > 0) ? curr.avgCostUsd : (fx > 0 ? currAvgCostThb / fx : 0)
      prevAvgCostDisplay = `$${Math.round(prevUsd).toLocaleString()}/BTC`
      currAvgCostDisplay = `$${Math.round(currUsd).toLocaleString()}/BTC`
      const diffUsd = Math.round(currUsd - prevUsd)
      if (diffUsd !== 0 && prevUnits > 0) {
        const sign = diffUsd > 0 ? '+' : '-'
        avgCostDeltaBadge = {
          text: `${sign}$${Math.abs(diffUsd).toLocaleString()}/BTC`,
          positive: diffUsd < 0,
        }
      }
    } else if (log.assetClass === 'stock') {
      const prevUsd = (prev.avgCostUsd && prev.avgCostUsd > 0) ? prev.avgCostUsd : (fx > 0 ? prevAvgCostThb / fx : 0)
      const currUsd = (curr.avgCostUsd && curr.avgCostUsd > 0) ? curr.avgCostUsd : (fx > 0 ? currAvgCostThb / fx : 0)
      prevAvgCostDisplay = `$${prevUsd.toFixed(2)}/share`
      currAvgCostDisplay = `$${currUsd.toFixed(2)}/share`
      const diff = Number((currUsd - prevUsd).toFixed(2))
      if (Math.abs(diff) > 0.001 && prevUnits > 0) {
        const sign = diff > 0 ? '+' : '-'
        avgCostDeltaBadge = {
          text: `${sign}$${Math.abs(diff).toFixed(2)}/share`,
          positive: diff < 0,
        }
      }
    } else if (log.assetClass === 'gold') {
      const prevBaht = prevAvgCostThb * GRAMS_PER_BAHT_GOLD
      const currBaht = currAvgCostThb * GRAMS_PER_BAHT_GOLD

      prevAvgCostDisplay = `฿${Math.round(prevBaht).toLocaleString()}/บาททอง`
      currAvgCostDisplay = `฿${Math.round(currBaht).toLocaleString()}/บาททอง`
      const diffBaht = Math.round(currBaht - prevBaht)
      if (diffBaht !== 0 && prevUnits > 0) {
        const sign = diffBaht > 0 ? '+' : '-'
        avgCostDeltaBadge = {
          text: `${sign}฿${Math.abs(diffBaht).toLocaleString()}/บาททอง`,
          positive: diffBaht < 0,
        }
      }
    } else {
      prevAvgCostDisplay = `฿${prevAvgCostThb.toFixed(2)}/unit`
      currAvgCostDisplay = `฿${currAvgCostThb.toFixed(2)}/unit`
      const diff = Number((currAvgCostThb - prevAvgCostThb).toFixed(2))
      if (Math.abs(diff) > 0.001 && prevUnits > 0) {
        const sign = diff > 0 ? '+' : '-'
        avgCostDeltaBadge = {
          text: `${sign}฿${Math.abs(diff).toFixed(2)}/unit`,
          positive: diff < 0,
        }
      }
    }

    // Format price per asset class
    let prevPriceDisplay = ''
    let currPriceDisplay = ''
    let priceDeltaBadge: { text: string; positive: boolean } | null = null

    if (priceChanged || (log.action === 'edit' && !unitsChanged && !avgCostChanged)) {
      if (log.assetClass === 'stock') {
        const prevUsd = (prevPriceThb > 0 && fx > 0) ? prevPriceThb / fx : 0
        const currUsd = (currPriceThb > 0 && fx > 0) ? currPriceThb / fx : 0
        prevPriceDisplay = `$${prevUsd.toFixed(2)}/share`
        currPriceDisplay = `$${currUsd.toFixed(2)}/share`
        const diffUsd = Number((currUsd - prevUsd).toFixed(2))
        const pct = prevUsd > 0 ? ((diffUsd / prevUsd) * 100).toFixed(2) : '0.00'
        if (Math.abs(diffUsd) > 0.001) {
          const sign = diffUsd > 0 ? '+' : ''
          priceDeltaBadge = {
            text: `${sign}$${Math.abs(diffUsd).toFixed(2)} (${sign}${pct}%)`,
            positive: diffUsd >= 0,
          }
        }
      } else if (log.assetClass === 'fund') {
        prevPriceDisplay = `฿${prevPriceThb.toFixed(4)}/unit`
        currPriceDisplay = `฿${currPriceThb.toFixed(4)}/unit`
        const diff = Number((currPriceThb - prevPriceThb).toFixed(4))
        const pct = prevPriceThb > 0 ? ((diff / prevPriceThb) * 100).toFixed(2) : '0.00'
        if (Math.abs(diff) > 0.0001) {
          const sign = diff > 0 ? '+' : ''
          priceDeltaBadge = {
            text: `${sign}฿${Math.abs(diff).toFixed(4)} (${sign}${pct}%)`,
            positive: diff >= 0,
          }
        }
      } else if (log.assetClass === 'crypto') {
        const prevUsd = (prevPriceThb > 0 && fx > 0) ? prevPriceThb / fx : 0
        const currUsd = (currPriceThb > 0 && fx > 0) ? currPriceThb / fx : 0
        prevPriceDisplay = `$${Math.round(prevUsd).toLocaleString()}/BTC`
        currPriceDisplay = `$${Math.round(currUsd).toLocaleString()}/BTC`
        const diffUsd = Math.round(currUsd - prevUsd)
        const pct = prevUsd > 0 ? ((diffUsd / prevUsd) * 100).toFixed(2) : '0.00'
        if (diffUsd !== 0) {
          const sign = diffUsd > 0 ? '+' : ''
          priceDeltaBadge = {
            text: `${sign}$${Math.abs(diffUsd).toLocaleString()} (${sign}${pct}%)`,
            positive: diffUsd >= 0,
          }
        }
      } else if (log.assetClass === 'gold') {
        const prevBaht = prevPriceThb * GRAMS_PER_BAHT_GOLD
        const currBaht = currPriceThb * GRAMS_PER_BAHT_GOLD
        prevPriceDisplay = `฿${Math.round(prevBaht).toLocaleString()}/บาททอง`
        currPriceDisplay = `฿${Math.round(currBaht).toLocaleString()}/บาททอง`
        const diffBaht = Math.round(currBaht - prevBaht)
        const pct = prevBaht > 0 ? ((diffBaht / prevBaht) * 100).toFixed(2) : '0.00'
        if (diffBaht !== 0) {
          const sign = diffBaht > 0 ? '+' : ''
          priceDeltaBadge = {
            text: `${sign}฿${Math.abs(diffBaht).toLocaleString()} (${sign}${pct}%)`,
            positive: diffBaht >= 0,
          }
        }
      }
    }

    const showTickerRow = tickerChanged && prev.ticker !== curr.ticker
    const showNameRow = nameChanged && prev.name !== curr.name
    const showBalanceRow = (log.action === 'buy_more' || log.action === 'sell')
      ? (formatUnit(prevUnits) !== formatUnit(currUnits) || currUnits === 0)
      : (unitsChanged && formatUnit(prevUnits) !== formatUnit(currUnits))

    const showAvgCostRow = (log.action === 'buy_more' || log.action === 'sell')
      ? (prevAvgCostDisplay !== currAvgCostDisplay && prevAvgCostDisplay !== '' && currAvgCostDisplay !== '')
      : (avgCostChanged && prevAvgCostDisplay !== currAvgCostDisplay && prevAvgCostDisplay !== '' && currAvgCostDisplay !== '')

    const showPriceRow = priceChanged && prevPriceDisplay !== currPriceDisplay && prevPriceDisplay !== '' && currPriceDisplay !== ''

    if (!showTickerRow && !showNameRow && !showBalanceRow && !showAvgCostRow && !showPriceRow && log.action !== 'sell' && log.action !== 'buy_more' && log.action !== 'add') {
      return null
    }

    const isFund = log.assetClass === 'fund'
    const priceLabel = isFund ? 'NAV / Price' : 'Market Price'

    return (
      <div className="rounded-2xl border border-line/70 bg-surface-muted/40 dark:bg-surface-muted/20 p-2.5 sm:p-3 text-xs space-y-2.5">
        {/* Holding Name Row (if renamed) */}
        {showNameRow && (
          <div>
            <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">ชื่อทรัพย์สิน</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
              <span className="whitespace-nowrap">{prev.name}</span>
              <span className="text-ink-faint text-xs">→</span>
              <span className="font-semibold text-brand whitespace-nowrap">{curr.name}</span>
            </div>
          </div>
        )}

        {/* Ticker Symbol Row (if ticker updated) */}
        {showTickerRow && (
          <div className={showNameRow ? 'pt-1.5 border-t border-line/60' : ''}>
            <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Ticker Symbol</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
              <span className="rounded-md bg-surface px-1.5 py-0.5 tnum text-xs font-medium text-ink-muted border border-line">{prev.ticker}</span>
              <span className="text-ink-faint text-xs">→</span>
              <span className="rounded-md bg-brand/10 border border-brand/20 px-1.5 py-0.5 tnum text-xs font-bold text-brand">{curr.ticker}</span>
            </div>
          </div>
        )}

        {log.action === 'sell' ? (() => {
          const pnl = log.realizedPnL ?? (log.note.match(/Realized PnL:\s*([+-]?฿[0-9,.]+)/) ? parseFloat(log.note.match(/Realized PnL:\s*([+-]?฿[0-9,.]+)/)![1].replace(/[฿,]/g, '')) : null)
          const pct = log.realizedPnLPercent ?? (log.note.match(/\(([+-]?[0-9.]+)%\)/) ? parseFloat(log.note.match(/\(([+-]?[0-9.]+)%\)/)![1]) : null)
          const isGain = pnl !== null && pnl >= 0
          const isDetailsOpen = expandedDetails.has(log.id)
          const txDetails = getLogTransactionDetails(log, usdThb)
          const cashItems = getCashDiffItems(log)

          let cashDest = ''
          if (cashItems.length > 0) {
            const deposit = cashItems.find((c) => c.diff && c.diff > 0) || cashItems[0]
            if (deposit) cashDest = `เข้า ${deposit.accountName}`
          } else {
            const depMatch = log.note.match(/(?:Deposited to|ฝากเข้า)\s*([^·\n()]+)/i)
            if (depMatch) cashDest = `เข้า ${depMatch[1].trim()}`
          }

          return (
            <>
              {/* ── Unified 3-Column Strip for Sell ── */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {/* Col 1: ยอดที่ได้รับ */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>💵</span> <span className="truncate">ได้รับเงิน</span>
                  </span>
                  <div className="text-sm sm:text-base font-black tracking-tight text-ink truncate mt-0.5">
                    {txDetails.amountThbDisplay && txDetails.amountThbDisplay !== '-' ? txDetails.amountThbDisplay : (log.proceeds ? thb(log.proceeds) : '-')}
                  </div>
                  <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={cashDest || 'รับเข้ากระเป๋า'}>
                    {cashDest || 'รับเข้ากระเป๋า'}
                  </span>
                </div>

                {/* Col 2: ขายออก */}
                <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>📦</span> <span className="truncate">ขายออก</span>
                  </span>
                  <div className="text-sm sm:text-base font-extrabold tracking-tight text-ink-muted truncate mt-0.5">
                    {txDetails.sharesDisplay && txDetails.sharesDisplay !== '-' ? txDetails.sharesDisplay : (Math.abs(unitDiff) > 0 ? formatUnitDiff(unitDiff) : '-')}
                  </div>
                  <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                    หักออกจากพอร์ต
                  </span>
                </div>

                {/* Col 3: กำไร/ขาดทุน */}
                <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>{isGain ? '💚' : '🔴'}</span> <span className="truncate">{isGain ? 'กำไรสุทธิ' : 'ขาดทุน'}</span>
                  </span>
                  <div className={`text-sm sm:text-base font-black tracking-tight truncate mt-0.5 ${isGain ? 'text-gain' : 'text-loss'}`}>
                    {pnl !== null ? `${isGain ? '+' : ''}${thb(pnl)}` : '-'}
                  </div>
                  {pct !== null && (
                    <span className={`text-xs font-bold truncate mt-0.5 ${isGain ? 'text-gain' : 'text-loss'}`}>
                      {isGain ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Cash movement row */}
              {cashItems.length > 0 && (
                <div className="pt-2 border-t border-line/50 space-y-1">
                  {cashItems.map((item, idx) => {
                    const sym = item.currencySymbol
                    return (
                      <div key={idx} className="flex flex-wrap items-center justify-between text-xs text-ink-muted">
                        <span className="font-semibold text-ink-soft flex items-center gap-1">
                          <span>{item.diff && item.diff < 0 ? '💸' : '💵'}</span>
                          <span>{item.diff && item.diff < 0 ? 'จ่ายจาก' : 'รับเงินเข้า'}: {item.accountName}</span>
                        </span>
                        <div className="flex items-center gap-1 font-mono text-xs">
                          {item.prevBalance !== undefined && (
                            <>
                              <span>{sym}{item.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span className="text-ink-faint">→</span>
                            </>
                          )}
                          <span className="font-bold text-ink">{sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {item.diff !== undefined && (
                            <span className={`rounded px-1 text-xs font-bold ${item.diff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                              {item.diff > 0 ? '+' : ''}{sym}{Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Collapse toggle for details */}
              {(showPriceRow || showBalanceRow || showAvgCostRow) && (
                <div className="pt-2 border-t border-line/60">
                  <button
                    type="button"
                    onClick={() => toggleDetails(log.id)}
                    className="inline-flex items-center gap-1.5 py-0.5 text-xs font-semibold text-ink-muted hover:text-ink active:scale-95 transition-all cursor-pointer select-none"
                  >
                    <span>{isDetailsOpen ? '▲ ซ่อนรายละเอียด' : '▼ ดูรายละเอียด'}</span>
                  </button>

                  {isDetailsOpen && (
                    <div className="mt-2 space-y-2 pt-1.5 border-t border-line/40 text-xs">
                      {showPriceRow && (
                        <div>
                          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                            {isFund ? 'NAV / ราคา' : 'ราคาตลาด ณ วันขาย'}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                            <span className="whitespace-nowrap">{prevPriceDisplay}</span>
                            <span className="text-ink-faint text-xs">→</span>
                            <span className="font-semibold text-brand whitespace-nowrap">{currPriceDisplay}</span>
                            {priceDeltaBadge && (
                              <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${priceDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                                {priceDeltaBadge.text}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {showBalanceRow && (
                        <div className={showPriceRow ? 'pt-1.5 border-t border-line/60' : ''}>
                          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">จำนวนคงเหลือหลังขาย</span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                            <span className="whitespace-nowrap">{formatUnit(prevUnits)}</span>
                            <span className="text-ink-faint text-xs">→</span>
                            {currUnits === 0 ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">0 (ขายหมดแล้ว)</span>
                            ) : (
                              <span className="font-semibold text-brand whitespace-nowrap">{formatUnit(currUnits)}</span>
                            )}
                            {Math.abs(unitDiff) > 0.0001 && (
                              <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${unitDiff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                                {formatUnitDiff(unitDiff)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {showAvgCostRow && (
                        <div className={(showPriceRow || showBalanceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                            {(log.assetClass === 'gold' || log.assetClass === 'crypto')
                              ? 'ต้นทุนเฉลี่ยรวมทุกกระเป๋า (ส่วนที่เหลือ)'
                              : 'ต้นทุนเฉลี่ย (ส่วนที่เหลือ)'}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                            <span className="whitespace-nowrap">{prevAvgCostDisplay}</span>
                            <span className="text-ink-faint text-xs">→</span>
                            <span className="font-semibold text-brand whitespace-nowrap">{currAvgCostDisplay}</span>
                            {avgCostDeltaBadge && (
                              <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${avgCostDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-ink-muted'}`}>
                                {avgCostDeltaBadge.text}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {(log.assetClass === 'gold' || log.assetClass === 'crypto') && (
                        <div className="pt-1.5 border-t border-line/40 text-xs text-ink-muted">
                          💡 <span className="font-medium text-ink-soft">ระบบคำนวณกำไร/ขาดทุนตามต้นทุนจริงของกระเป๋าที่เลือกขายโดยเฉพาะ</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })() : (log.action === 'buy_more' || log.action === 'add') ? (() => {
          const txDetails = getLogTransactionDetails(log, usdThb)
          const isDetailsOpen = expandedDetails.has(log.id)
          const cashItems = getCashDiffItems(log)

          let buyPriceDisplay = ''
          if (txDetails.priceDisplay && txDetails.priceDisplay !== '-') {
            buyPriceDisplay = txDetails.priceDisplay
            if (log.assetClass === 'gold' && !buyPriceDisplay.includes('/')) {
              buyPriceDisplay += '/บาททอง'
            } else if (log.assetClass === 'stock' && !buyPriceDisplay.includes('/')) {
              buyPriceDisplay += '/sh'
            } else if (log.assetClass === 'crypto' && !buyPriceDisplay.includes('/')) {
              buyPriceDisplay += '/BTC'
            } else if ((log.assetClass === 'fund' || log.assetClass === 'real_estate') && !buyPriceDisplay.includes('/')) {
              buyPriceDisplay += '/unit'
            }
          } else if (currPriceDisplay) {
            buyPriceDisplay = currPriceDisplay
          }

          let cashSource = ''
          if (cashItems.length > 0) {
            const deduction = cashItems.find((c) => c.diff && c.diff < 0) || cashItems[0]
            if (deduction) cashSource = `จาก ${deduction.accountName}`
          } else {
            const paidMatch = log.note.match(/(?:Paid from|จ่ายจาก)\s*([^·\n()]+)/i)
            if (paidMatch) cashSource = `จาก ${paidMatch[1].trim()}`
          }

          return (
            <>
              {/* ── Unified 3-Column Strip for Buy / Add ── */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {/* Col 1: ยอดที่ซื้อ */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>💳</span> <span className="truncate">ยอดที่ซื้อ</span>
                  </span>
                  <div className="text-sm sm:text-base font-black tracking-tight text-sky-700 dark:text-sky-300 truncate mt-0.5">
                    {txDetails.amountThbDisplay && txDetails.amountThbDisplay !== '-' ? txDetails.amountThbDisplay : (txDetails.sharesDisplay || '-')}
                  </div>
                  <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={cashSource || 'ยอดลงทุน'}>
                    {cashSource || 'ยอดลงทุน'}
                  </span>
                </div>

                {/* Col 2: หน่วยที่ได้ */}
                <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>📦</span> <span className="truncate">หน่วยที่ได้</span>
                  </span>
                  <div className="text-sm sm:text-base font-extrabold tracking-tight text-gain truncate mt-0.5">
                    {txDetails.sharesDisplay && txDetails.sharesDisplay !== '-' ? txDetails.sharesDisplay : (unitDiff > 0 ? formatUnitDiff(unitDiff) : '-')}
                  </div>
                  <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                    สะสมเข้าพอร์ต
                  </span>
                </div>

                {/* Col 3: ราคาเข้าซื้อ */}
                <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>🏷️</span> <span className="truncate">ราคาเข้าซื้อ</span>
                  </span>
                  <div className="text-sm sm:text-base font-extrabold tracking-tight text-ink truncate mt-0.5">
                    {buyPriceDisplay || '-'}
                  </div>
                  <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                    ราคาต่อหน่วย
                  </span>
                </div>
              </div>

              {/* Cash movement row */}
              {cashItems.length > 0 && (
                <div className="pt-2 border-t border-line/50 space-y-1">
                  {cashItems.map((item, idx) => {
                    const sym = item.currencySymbol
                    return (
                      <div key={idx} className="flex flex-wrap items-center justify-between text-xs text-ink-muted">
                        <span className="font-semibold text-ink-soft flex items-center gap-1">
                          <span>{item.diff && item.diff < 0 ? '💸' : '💵'}</span>
                          <span>{item.diff && item.diff < 0 ? 'จ่ายจาก' : 'รับเงินเข้า'}: {item.accountName}</span>
                        </span>
                        <div className="flex items-center gap-1 font-mono text-xs">
                          {item.prevBalance !== undefined && (
                            <>
                              <span>{sym}{item.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span className="text-ink-faint">→</span>
                            </>
                          )}
                          <span className="font-bold text-ink">{sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {item.diff !== undefined && (
                            <span className={`rounded px-1 text-xs font-bold ${item.diff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                              {item.diff > 0 ? '+' : ''}{sym}{Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Collapse toggle for details */}
              {(showPriceRow || showBalanceRow || showAvgCostRow) && (
                <div className="pt-2 border-t border-line/60">
                  <button
                    type="button"
                    onClick={() => toggleDetails(log.id)}
                    className="inline-flex items-center gap-1.5 py-0.5 text-xs font-semibold text-ink-muted hover:text-ink active:scale-95 transition-all cursor-pointer select-none"
                  >
                    <span>{isDetailsOpen ? '▲ ซ่อนรายละเอียด' : '▼ ดูรายละเอียด'}</span>
                  </button>

                  {isDetailsOpen && (
                    <div className="mt-2 space-y-2 pt-1.5 border-t border-line/40 text-xs">
                      {showPriceRow && (
                        <div>
                          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                            {priceLabel}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                            <span className="whitespace-nowrap">{prevPriceDisplay}</span>
                            <span className="text-ink-faint text-xs">→</span>
                            <span className="font-semibold text-brand whitespace-nowrap">{currPriceDisplay}</span>
                            {priceDeltaBadge && (
                              <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${priceDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                                {priceDeltaBadge.text}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {showBalanceRow && (
                        <div className={showPriceRow ? 'pt-1.5 border-t border-line/60' : ''}>
                          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Holding Balance (ยอดสะสมรวม)</span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                            <span className="whitespace-nowrap">{formatUnit(prevUnits)}</span>
                            <span className="text-ink-faint text-xs">→</span>
                            <span className="font-semibold text-brand whitespace-nowrap">{formatUnit(currUnits)}</span>
                            {Math.abs(unitDiff) > 0.0001 && (
                              <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${unitDiff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                                {formatUnitDiff(unitDiff)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {showAvgCostRow && (
                        <div className={(showPriceRow || showBalanceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                            Average Cost (ต้นทุนเฉลี่ยใหม่)
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                            <span className="whitespace-nowrap">{prevAvgCostDisplay}</span>
                            <span className="text-ink-faint text-xs">→</span>
                            <span className="font-semibold text-brand whitespace-nowrap">{currAvgCostDisplay}</span>
                            {avgCostDeltaBadge && (
                              <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${avgCostDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-ink-muted'}`}>
                                {avgCostDeltaBadge.text}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })() : (() => {
          const isPriceOnly = showPriceRow && !unitsChanged && !avgCostChanged && !showNameRow && !showTickerRow

          if (isPriceOnly) {
            return (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {/* Col 1: ราคาเดิม */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>🏷️</span> <span className="truncate">ราคาเดิม</span>
                  </span>
                  <div className="text-sm sm:text-base font-extrabold tracking-tight text-ink-muted truncate mt-0.5">
                    {prevPriceDisplay}
                  </div>
                  <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                    ก่อนอัปเดต
                  </span>
                </div>

                {/* Col 2: ราคาใหม่ */}
                <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>🏷️</span> <span className="truncate">ราคาใหม่</span>
                  </span>
                  <div className="text-sm sm:text-base font-black tracking-tight text-brand truncate mt-0.5">
                    {currPriceDisplay}
                  </div>
                  <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                    {isFund ? 'NAV ปัจจุบัน' : 'ราคาตลาดล่าสุด'}
                  </span>
                </div>

                {/* Col 3: เปลี่ยนแปลง */}
                <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                    <span>{priceDeltaBadge?.positive ? '📈' : '📉'}</span> <span className="truncate">เปลี่ยนแปลง</span>
                  </span>
                  <div className={`text-sm sm:text-base font-black tracking-tight truncate mt-0.5 ${priceDeltaBadge?.positive ? 'text-gain' : 'text-loss'}`}>
                    {priceDeltaBadge ? priceDeltaBadge.text.split(' ')[0] : '-'}
                  </div>
                  {priceDeltaBadge && priceDeltaBadge.text.includes('(') && (
                    <span className={`text-xs font-bold truncate mt-0.5 ${priceDeltaBadge?.positive ? 'text-gain' : 'text-loss'}`}>
                      {priceDeltaBadge.text.substring(priceDeltaBadge.text.indexOf('(')).replace(/[()]/g, '')}
                    </span>
                  )}
                </div>
              </div>
            )
          }

          return (
            <>
              {/* ── NON-SELL / NON-BUY General Edit ── */}
              {showPriceRow && (
                <div className={(showNameRow || showTickerRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                  <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                    {priceLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                    <span className="whitespace-nowrap">{prevPriceDisplay}</span>
                    <span className="text-ink-faint text-xs">→</span>
                    <span className="font-semibold text-brand whitespace-nowrap">{currPriceDisplay}</span>
                    {priceDeltaBadge && (
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${priceDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                        {priceDeltaBadge.text}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {showBalanceRow && (
                <div className={(showNameRow || showTickerRow || showPriceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                  <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Holding Balance</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                    <span className="whitespace-nowrap">{formatUnit(prevUnits)}</span>
                    <span className="text-ink-faint text-xs">→</span>
                    <span className="font-semibold text-brand whitespace-nowrap">{formatUnit(currUnits)}</span>
                    {Math.abs(unitDiff) > 0.0001 && (
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${unitDiff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                        {formatUnitDiff(unitDiff)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {showAvgCostRow && (
                <div className={(showNameRow || showTickerRow || showPriceRow || showBalanceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                  <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Average Cost</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                    <span className="whitespace-nowrap">{prevAvgCostDisplay}</span>
                    <span className="text-ink-faint text-xs">→</span>
                    <span className="font-semibold text-brand whitespace-nowrap">{currAvgCostDisplay}</span>
                    {avgCostDeltaBadge && (
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${avgCostDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-ink-muted'}`}>
                        {avgCostDeltaBadge.text}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Cash Account Row */}
              {(() => {
                const cashItems = getCashDiffItems(log)
                if (cashItems.length === 0) return null
                return (
                  <div className="pt-1.5 border-t border-line/60 space-y-1.5">
                    {cashItems.map((item, idx) => {
                      const sym = item.currencySymbol
                      return (
                        <div key={idx}>
                          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                            {item.diff && item.diff > 0 ? 'Cash Deposit' : 'Cash Deduction'}: {item.accountName}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                            {item.prevBalance !== undefined && (
                              <>
                                <span className="whitespace-nowrap">{sym}{item.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="text-ink-faint text-xs">→</span>
                              </>
                            )}
                            <span className="font-bold text-brand whitespace-nowrap">{sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            {item.diff !== undefined && (
                              <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${item.diff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                                {item.diff > 0 ? '+' : ''}{sym}{Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </>
          )
        })()}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Activity Logs"
        onStartGuide={startTour}
      />

      {/* Toolbar: Search + View Switcher + Export */}
      <div id="guide-logs-header" className="mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
              <SearchIcon className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, asset, note, wallet..."
              className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-8 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-ink-faint hover:text-ink cursor-pointer"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-muted text-xs font-bold">
                  ✕
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Switcher */}
            <div className="inline-flex rounded-xl bg-surface-muted p-1 border border-line-strong/30 shrink-0">
              <button
                type="button"
                onClick={() => handleViewModeChange('table')}
                title="Table statement view"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-surface text-ink shadow-xs font-bold border border-line/40'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('timeline')}
                title="Timeline feed view"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-surface text-ink shadow-xs font-bold border border-line/40'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span>Timeline</span>
              </button>
            </div>

            {/* Export CSV */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              title="Export activity logs to CSV"
              className="cursor-pointer shrink-0 h-9"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Filter bar: Asset filters (Left) & Action filters (Right) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          {/* Left: Asset Category pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 -my-1.5">
            {ASSET_FILTERS.map((f) => (
              <FilterChip
                key={f.key}
                active={assetFilter === f.key}
                onClick={() => setAssetFilter(f.key)}
                aria-label={`Filter by ${f.label}`}
              >
                {f.label}
              </FilterChip>
            ))}
          </div>

          {/* Right: Action Type pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1.5 -my-1.5">
            <span className="shrink-0 text-xs font-medium text-ink-faint mr-1">Action:</span>
            {ACTION_FILTERS.map((f) => (
              <FilterChip
                key={f.key}
                active={actionFilter === f.key}
                onClick={() => setActionFilter(f.key)}
                aria-label={`Filter by action ${f.label}`}
              >
                {f.label}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Results summary & Active filter reset */}
        <div className="flex items-center justify-between text-xs text-ink-muted px-0.5">
          <span>
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
            {(searchQuery || assetFilter !== 'all' || actionFilter !== 'all') && (
              <span className="text-ink-faint ml-1">
                (filtered from {logs.length})
              </span>
            )}
          </span>
          {(searchQuery || assetFilter !== 'all' || actionFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setAssetFilter('all')
                setActionFilter('all')
              }}
              className="text-brand hover:underline font-medium cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      <div id="guide-logs-list">
        {logs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClockIcon className="h-7 w-7" />}
              title="No activity yet"
              description="Actions you take in Portfolio (adding, buying more, or editing holdings) will appear here."
              accent="var(--color-brand)"
            />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<SearchIcon className="h-7 w-7" />}
              title="No transactions match your search"
              description="Try adjusting your keywords or clearing the active filters."
              accent="var(--color-brand)"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setAssetFilter('all')
                    setActionFilter('all')
                  }}
                  className="mt-2 cursor-pointer"
                >
                  Clear all filters
                </Button>
              }
            />
          </Card>
        ) : viewMode === 'table' ? (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[840px]">
                <thead>
                  <tr className="border-b border-line bg-surface-muted/60 text-xs font-bold text-ink-muted uppercase tracking-wider">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-3">Action</th>
                    <th className="py-3 px-3">Asset / Ticker</th>
                    <th className="py-3 px-3 text-right">Price / NAV</th>
                    <th className="py-3 px-3 text-right">Shares / Qty</th>
                    <th className="py-3 px-3 text-right">Amount (THB)</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-4 min-w-[200px]">Note</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((log) => {
                    const actionMeta = getLogActionMeta(log)
                    const locName = getDestinationLocation(log)
                    const tx = getLogTransactionDetails(log, usdThb)
                    const dt = new Date(log.timestamp)
                    const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    const isExpanded = expandedLogId === log.id
                    const hasComparison =
                      !!(log.previousHoldingState && log.afterHoldingState) ||
                      (log.action === 'sell' && !!log.previousHoldingState) ||
                      getCashDiffItems(log).length > 0

                    return (
                      <Fragment key={log.id}>
                        <tr
                          onClick={() => {
                            if (hasComparison) {
                              setExpandedLogId(isExpanded ? null : log.id)
                            }
                          }}
                          className={`transition-colors ${
                            hasComparison ? 'cursor-pointer hover:bg-surface-muted/50' : 'hover:bg-surface-muted/30'
                          } ${isExpanded ? 'bg-surface-muted/40' : ''}`}
                        >
                          <td
                            className="py-3 px-4 whitespace-nowrap cursor-pointer group/date"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditDate(log)
                            }}
                            title="Click to edit date / แตะเพื่อแก้ไขวันที่"
                          >
                            <div className="font-semibold text-ink text-xs tnum group-hover/date:text-brand flex items-center gap-1">
                              {dateStr}
                              <PencilIcon className="h-2.5 w-2.5 opacity-0 group-hover/date:opacity-100 transition-opacity text-brand" />
                            </div>
                            <div className="text-xs text-ink-faint tnum">{timeStr}</div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${actionMeta.style}`}>
                              {actionMeta.label}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-ink text-sm">{log.holdingName}</span>
                              {log.ticker && log.ticker !== 'CASH' && log.ticker !== 'FIXED' && log.ticker !== 'DCA' && (
                                <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-ink-muted">
                                  {log.ticker}
                                </span>
                              )}
                            </div>
                            <span
                              className="inline-block mt-0.5 text-xs font-semibold uppercase tracking-wider"
                              style={{
                                color:
                                  log.ticker === 'FIXED'
                                    ? '#f59e0b'
                                    : (ASSET_META[log.assetClass]?.color ?? '#6366f1'),
                              }}
                            >
                              {log.ticker === 'FIXED' ? 'expense' : log.assetClass}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap tnum font-semibold text-ink">
                            {tx.priceDisplay}
                          </td>
                          <td
                            className={`py-3 px-3 text-right whitespace-nowrap tnum font-bold ${
                              tx.sharesDisplay.startsWith('+')
                                ? 'text-gain'
                                : tx.sharesDisplay.startsWith('-')
                                ? 'text-loss'
                                : 'text-brand'
                            }`}
                          >
                            {tx.sharesDisplay}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap tnum">
                            <div className="font-semibold text-ink">
                              {tx.amountThbDisplay}
                            </div>
                            {log.action === 'sell' && log.realizedPnL !== undefined && (
                              <div
                                className={`text-xs font-bold mt-0.5 ${
                                  log.realizedPnL >= 0 ? 'text-gain' : 'text-loss'
                                }`}
                              >
                                {log.realizedPnL >= 0 ? '+' : ''}{thb(log.realizedPnL)}
                                {log.realizedPnLPercent !== undefined && (
                                  <span className="font-normal opacity-90 ml-1">
                                    ({log.realizedPnLPercent >= 0 ? '+' : ''}{log.realizedPnLPercent.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {locName ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-xs font-semibold text-brand">
                                <WalletIcon className="h-3 w-3" />
                                {locName}
                              </span>
                            ) : (
                              <span className="text-ink-faint text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-ink-muted max-w-[260px]">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate" title={getDisplayNote(log)}>
                                {getDisplayNote(log)}
                              </span>
                              {hasComparison && (
                                <span
                                  className="text-xs text-brand hover:underline shrink-0 font-medium"
                                  title="Click row to view Before/After comparison"
                                >
                                  {isExpanded ? '▲ Hide' : '▼ Diff'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditDate(log)
                                }}
                                title="Edit Date / แก้ไขวันที่"
                                aria-label={`Edit date for ${log.holdingName}`}
                                className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                              >
                                <PencilIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setUndoTarget(log)
                                }}
                                aria-label={`Undo activity for ${log.holdingName}`}
                                className="rounded-lg px-2 py-1 text-xs font-bold text-loss hover:bg-loss/10 transition-colors cursor-pointer"
                              >
                                Undo
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-surface-muted/20 border-b border-line">
                            <td colSpan={9} className="p-4 pl-8 sm:pl-12">
                              <div className="max-w-xl">
                                <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">
                                  State Comparison (Before → After)
                                </p>
                                {renderStateComparison(log)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.date}>
                <p className="mb-2.5 px-1 text-xs font-bold text-ink-soft tracking-wide">{group.date}</p>
                <Card padded={false}>
                  <ul className="divide-y divide-line">
                  {group.entries.map((log) => {
                    const locName = getDestinationLocation(log)
                    const actionMeta = getLogActionMeta(log)
                    return (
                      <li key={log.id} className="px-4 py-3.5 sm:px-5 sm:py-4 transition-colors hover:bg-surface-muted/30">
                        {/* Header Row: Icon + Title & Badges + Time & Actions */}
                        <div className="flex items-start justify-between gap-2.5">
                          {/* Left: Asset Icon + Holding Info */}
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className="mt-0.5 grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl text-sm font-bold shadow-xs"
                              style={{
                                color: ASSET_META[log.assetClass]?.color ?? '#6366f1',
                                background: `color-mix(in srgb, ${ASSET_META[log.assetClass]?.color ?? '#6366f1'} 14%, transparent)`,
                              }}
                            >
                              {actionMeta.icon}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="text-sm sm:text-base font-bold text-ink">{log.holdingName}</span>
                                {log.ticker && log.ticker !== 'CASH' && log.ticker !== 'FIXED' && log.ticker !== 'DCA' && (
                                  <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-ink-muted">
                                    {log.ticker}
                                  </span>
                                )}
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${actionMeta.style}`}>
                                  {actionMeta.label}
                                </span>
                                {locName && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-xs font-semibold text-brand">
                                    <WalletIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    {locName}
                                  </span>
                                )}
                              </div>
                              {getDisplayNote(log) ? (
                                <p className="mt-1 text-xs sm:text-sm font-medium text-ink-muted leading-relaxed">
                                  {getDisplayNote(log)}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {/* Right: Time + Edit Date pencil + Undo */}
                          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={() => startEditDate(log)}
                              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-ink-faint hover:text-brand hover:bg-brand/5 transition-colors cursor-pointer"
                              title="Edit Date / แตะเพื่อแก้ไขวันที่"
                            >
                              <time>
                                {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </time>
                              <PencilIcon className="h-2.5 w-2.5 opacity-70" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setUndoTarget(log)}
                              aria-label={`Undo activity for ${log.holdingName}`}
                              className="rounded-lg px-2 py-1 text-xs font-bold text-loss/85 hover:text-loss hover:bg-loss/10 transition-colors cursor-pointer"
                            >
                              Undo
                            </button>
                          </div>
                        </div>

                        {/* Body: State comparison / Unified Summary Strip */}
                        {renderStateComparison(log) && (
                          <div className="mt-2.5 sm:ml-11">
                            {renderStateComparison(log)}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Custom Undo Confirmation Modal */}
      <ConfirmModal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title={`Undo "${undoTarget?.holdingName}"?`}
        description="This will revert your portfolio balance and holdings state to before this activity was recorded."
        confirmText="Yes, undo activity"
        confirmVariant="danger"
        confirmIcon={<UndoIcon className="h-4 w-4" strokeWidth={2.4} />}
        cancelText="Cancel"
        onConfirm={() => {
          if (undoTarget) {
            undoHoldingLog(undoTarget.id)
            showToast(`Undid activity for "${undoTarget.holdingName}"`, 'info')
          }
          setUndoTarget(null)
        }}
      >
        {undoTarget && (() => {
          const undoMeta = getLogActionMeta(undoTarget)
          return (
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold"
                    style={{
                      color: ASSET_META[undoTarget.assetClass]?.color ?? '#6366f1',
                      background: `color-mix(in srgb, ${ASSET_META[undoTarget.assetClass]?.color ?? '#6366f1'} 14%, transparent)`,
                    }}
                  >
                    {undoMeta.icon}
                  </span>
                  <span className="font-bold text-sm text-ink truncate">{undoTarget.holdingName}</span>
                  {undoTarget.ticker && undoTarget.ticker !== 'CASH' && undoTarget.ticker !== 'FIXED' && undoTarget.ticker !== 'DCA' && (
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-medium text-ink-muted">
                      {undoTarget.ticker}
                    </span>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${undoMeta.style}`}>
                  {undoMeta.label}
                </span>
              </div>
              <p className="text-xs font-medium text-ink-muted leading-relaxed">{getDisplayNote(undoTarget)}</p>
              <time className="block text-xs text-ink-faint">
                {new Date(undoTarget.timestamp).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </div>
          )
        })()}
      </ConfirmModal>

      {/* Edit Date Modal */}
      {editingDateLog && (
        <Modal
          open={!!editingDateLog}
          onClose={() => setEditingDateLog(null)}
          title="แก้ไขวันที่ทำรายการ"
          description={`ปรับเปลี่ยนวันและเวลาบันทึกสำหรับ "${editingDateLog.holdingName}" (${getLogActionMeta(editingDateLog).label})`}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="secondary"
                onClick={() => setEditingDateLog(null)}
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (editingDateLog && editDateValue) {
                    const newTimestamp = dateStrToTimestamp(editDateValue, editTimeValue)
                    updateHoldingLogTimestamp(editingDateLog.id, newTimestamp)
                    showToast(`แก้ไขวันที่ของ "${editingDateLog.holdingName}" เรียบร้อยแล้ว`, 'success')
                    setEditingDateLog(null)
                  }
                }}
              >
                บันทึกวันที่
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Info card */}
            <div className="rounded-2xl border border-line bg-surface-muted p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-sm text-ink truncate">
                    {editingDateLog.holdingName}
                  </span>
                  {editingDateLog.ticker && editingDateLog.ticker !== 'CASH' && editingDateLog.ticker !== 'FIXED' && editingDateLog.ticker !== 'DCA' && (
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-medium text-ink-muted">
                      {editingDateLog.ticker}
                    </span>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${getLogActionMeta(editingDateLog).style}`}>
                  {getLogActionMeta(editingDateLog).label}
                </span>
              </div>
              <p className="text-xs text-ink-muted truncate">
                {getDisplayNote(editingDateLog)}
              </p>
            </div>

            {/* Date Picker */}
            <TransactionDateField
              value={editDateValue}
              onChange={setEditDateValue}
              label="วันที่ทำรายการ (Transaction Date)"
            />

            {/* Time Picker */}
            <div>
              <label className="block mb-1.5 text-sm font-semibold text-ink-soft">
                เวลาที่ทำรายการ (Time)
              </label>
              <input
                type="time"
                value={editTimeValue}
                onChange={(e) => setEditTimeValue(e.target.value)}
                className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </div>
        </Modal>
      )}

      <GuideTour
        isOpen={isRunning}
        steps={steps}
        currentStepIndex={currentStepIndex}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={endTour}
        onFinish={finishTour}
      />
    </>
  )
}


