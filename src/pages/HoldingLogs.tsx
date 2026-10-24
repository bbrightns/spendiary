import { useEffect, useRef, useState, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { DropdownChip } from '../components/ui/DropdownChip'
import { Popover, PopoverOption } from '../components/ui/Popover'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { ASSET_META } from '../lib/calc'
import { getCashDiffItems, getLogTransactionDetails } from '../lib/activitySummary'
import { dateStrToTimestamp, localDateStr, thb } from '../lib/format'
import type { AcquisitionSource, AssetClass, HoldingLog } from '../lib/types'
import { logTookCash, noteForSource, paidFromName } from '../lib/acquisition'
import { AcquisitionSourceField } from '../components/forms/AcquisitionSourceField'
import { FormActions } from '../components/forms/FormActions'
import {
  ClockIcon,
  DotsHorizontalIcon,
  DownloadIcon,
  ListIcon,
  PencilIcon,
  SearchIcon,
  TableIcon,
  TrashIcon,
  UndoIcon,
  WalletIcon,
  LockClosedIcon,
} from '../components/icons'
import { TransactionDateField } from '../components/forms/TransactionDateField'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { buildCsv, downloadCsv } from '../lib/csv'
import { getLogActionMeta, getDisplayNote, getDestinationLocation, ASSET_FILTERS, getLogAssetLabel, ACTION_FILTERS, isAcquisitionLog } from './holdingLogs/logMeta'
import { renderLogDetails } from './holdingLogs/logDetails'



const DATE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom range…' },
] as const

/** "2026-10-12" → "12 Oct" for the date chip */
function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

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
  const { data, removeHoldingLog, removeHoldingLogs, undoHoldingLog, updateHoldingLog, usdThb } = useData()
  const { showToast } = useToast()
  const rawLogs = data.holdingLogs ?? []
  const logs = [...rawLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const [undoTarget, setUndoTarget] = useState<HoldingLog | null>(null)
  const [editingDateLog, setEditingDateLog] = useState<HoldingLog | null>(null)
  const [editDateValue, setEditDateValue] = useState<string>('')
  const [editTimeValue, setEditTimeValue] = useState<string>('')
  const [editSource, setEditSource] = useState<AcquisitionSource>('bought')
  const [editReceivedFrom, setEditReceivedFrom] = useState('')
  function startEditDate(log: HoldingLog) {
    setEditingDateLog(log)
    const dt = new Date(log.timestamp)
    setEditDateValue(localDateStr(dt))
    setEditTimeValue(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    setEditSource(log.source ?? 'bought')
    setEditReceivedFrom(log.receivedFrom ?? '')
  }

  function closeEdit() {
    setEditingDateLog(null)
  }

  function saveEdit() {
    const log = editingDateLog
    if (!log || !editDateValue) return
    const patch: Parameters<typeof updateHoldingLog>[1] = {
      timestamp: dateStrToTimestamp(editDateValue, editTimeValue),
    }
    if (isAcquisitionLog(log) && !logTookCash(log)) {
      const from = editReceivedFrom.trim()
      const sourceChanged = editSource !== (log.source ?? 'bought') || (editSource === 'received' && from !== (log.receivedFrom ?? ''))
      if (sourceChanged) {
        patch.source = editSource === 'received' ? 'received' : undefined
        patch.receivedFrom = editSource === 'received' ? from || undefined : undefined
        patch.note = noteForSource(log.note, editSource, from)
      }
    }
    updateHoldingLog(log.id, patch)
    showToast(`Updated "${log.holdingName}"`, 'success')
    closeEdit()
  }

  const [assetFilter, setAssetFilter] = useState<AssetClass | 'all'>('all')
  const [actionFilter, setActionFilter] = useState<'all' | 'buy' | 'sell' | 'dividend' | 'transfer' | 'edit'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  // Opened from the search bar with ?search=BTC: start filtered to it
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearchQuery(q)
  }, [searchParams])
  const [datePreset, setDatePreset] = useState<'all' | 'month' | '30d' | 'year' | 'custom'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.logsViewMode)
    if (saved === 'timeline' || saved === 'table') return saved
    return 'timeline'
  })
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set())
  // Selecting, re-dating and undoing only appear while editing, to keep the list calm
  const [editMode, setEditMode] = useState(false)
  const toggleEditMode = () => {
    setEditMode((v) => !v)
    setSelectedLogIds(new Set())
  }
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)

  const toggleLogSelection = (logId: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev)
      if (next.has(logId)) next.delete(logId)
      else next.add(logId)
      return next
    })
  }

  const toggleAllVisibleLogs = () => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) filtered.forEach((log) => next.delete(log.id))
      else filtered.forEach((log) => next.add(log.id))
      return next
    })
  }


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
    localStorage.setItem(STORAGE_KEYS.logsViewMode, mode)
    setSelectedLogIds(new Set())
  }

  // Inclusive local-date bounds (YYYY-MM-DD) for the selected date preset
  const dateBounds = (() => {
    const now = new Date()
    if (datePreset === 'month') return { from: localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: '' }
    if (datePreset === '30d') {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      return { from: localDateStr(d), to: '' }
    }
    if (datePreset === 'year') return { from: localDateStr(new Date(now.getFullYear(), 0, 1)), to: '' }
    if (datePreset === 'custom') return { from: dateFrom, to: dateTo }
    return { from: '', to: '' }
  })()
  const hasDateFilter = datePreset !== 'all' && (dateBounds.from !== '' || dateBounds.to !== '')
  const dateChipLabel = datePreset !== 'custom'
    ? (DATE_PRESETS.find((p) => p.key === datePreset)?.label ?? 'Date')
    : dateFrom && dateTo
      ? `${shortDate(dateFrom)} – ${shortDate(dateTo)}`
      : dateFrom
        ? `From ${shortDate(dateFrom)}`
        : dateTo
          ? `Until ${shortDate(dateTo)}`
          : 'Custom range'
  const anyFilter = Boolean(searchQuery || assetFilter !== 'all' || actionFilter !== 'all' || hasDateFilter)
  const resetFilters = () => {
    setSearchQuery('')
    setAssetFilter('all')
    setActionFilter('all')
    setDatePreset('all')
    setDateFrom('')
    setDateTo('')
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBtnRef = useRef<HTMLButtonElement>(null)

  const filtered = logs.filter((l) => {
    if (assetFilter !== 'all' && l.assetClass !== assetFilter) return false
    if (hasDateFilter) {
      const day = localDateStr(new Date(l.timestamp))
      if (dateBounds.from && day < dateBounds.from) return false
      if (dateBounds.to && day > dateBounds.to) return false
    }
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

  const selectedVisibleCount = filtered.filter((log) => selectedLogIds.has(log.id)).length
  const allVisibleSelected = filtered.length > 0 && filtered.every((log) => selectedLogIds.has(log.id))

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      showToast('No transactions to export', 'warn')
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


    const rows = filtered.map((log) => {
      const dt = new Date(log.timestamp)
      const dateStr = localDateStr(dt)
      const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      const actionMeta = getLogActionMeta(log)
      const locName = getDestinationLocation(log)
      const tx = getLogTransactionDetails(log, usdThb)
      const noteStr = getDisplayNote(log)
      const realizedPnLStr = log.realizedPnL !== undefined
        ? log.realizedPnL.toFixed(2)
        : (log.note.match(/Realized PnL:\s*([+-]?฿[0-9,.]+)/) ? log.note.match(/Realized PnL:\s*([+-]?฿[0-9,.]+)/)![1].replace(/[฿,]/g, '') : '')

      return [
        dateStr,
        timeStr,
        actionMeta.label,
        log.assetClass,
        log.ticker || '',
        log.holdingName,
        tx.sharesDisplay !== '-' ? tx.sharesDisplay : '',
        tx.priceDisplay !== '-' ? tx.priceDisplay : '',
        tx.amountThbValue !== null ? tx.amountThbValue.toFixed(2) : '',
        realizedPnLStr,
        locName || '',
        noteStr,
      ]
    })

    downloadCsv(buildCsv(headers, rows), `spendiary-activity-logs-${localDateStr()}.csv`)

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

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Activity Logs"
        onStartGuide={startTour}
      />

      {/* Toolbar: Search + view switcher + ⋯ menu, then Date / Asset / Action dropdown chips */}
      <div id="guide-logs-header" className="mb-5 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
              <SearchIcon className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs…"
              title="Search by ticker, asset, note or wallet"
              aria-label="Search activity"
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

          {/* View Switcher */}
          <SegmentedControl
            shape="rounded"
            size="sm"
            fullWidth={false}
            value={viewMode}
            onChange={(v) => handleViewModeChange(v as 'table' | 'timeline')}
            options={[
              { value: 'table', label: <span className="sr-only">Table</span>, icon: <TableIcon className="h-4 w-4" />, title: 'Table statement view' },
              { value: 'timeline', label: <span className="sr-only">Timeline</span>, icon: <ListIcon className="h-4 w-4" />, title: 'Timeline feed view' },
            ]}
            ariaLabel="Choose table or timeline view"
            className="shrink-0"
          />

          {/* ⋯ menu: Export CSV and Edit, used far less than the filters */}
          <button
            ref={moreBtnRef}
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More actions"
            title="More actions"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-muted transition-colors hover:text-ink hover:bg-surface-muted cursor-pointer"
          >
            <DotsHorizontalIcon className="h-[18px] w-[18px]" />
          </button>
          <Popover open={moreOpen} onClose={() => setMoreOpen(false)} anchorRef={moreBtnRef} title="Actions" align="right">
            <PopoverOption
              icon={<DownloadIcon className="h-4 w-4" />}
              disabled={filtered.length === 0}
              hint={filtered.length === 0 ? 'No results' : `${filtered.length}`}
              onClick={() => {
                setMoreOpen(false)
                handleExportCsv()
              }}
            >
              Export CSV
            </PopoverOption>
            <PopoverOption
              icon={<PencilIcon className="h-4 w-4" />}
              onClick={() => {
                setMoreOpen(false)
                toggleEditMode()
              }}
            >
              {editMode ? 'Done editing' : 'Edit entries'}
            </PopoverOption>
          </Popover>
        </div>

        {/* Filter chips + result count */}
        <div className="flex flex-wrap items-center gap-1.5">
          <DropdownChip
            title="Date range"
            label={datePreset === 'all' ? 'Date' : dateChipLabel}
            active={datePreset !== 'all'}
            onClear={() => {
              setDatePreset('all')
              setDateFrom('')
              setDateTo('')
            }}
          >
            {(close) => (
              <>
                {DATE_PRESETS.map((p) => (
                  <PopoverOption
                    key={p.key}
                    selected={datePreset === p.key}
                    onClick={() => {
                      setDatePreset(p.key)
                      if (p.key !== 'custom') close()
                    }}
                  >
                    {p.label}
                  </PopoverOption>
                ))}
                {/* Custom range: the sheet stays open to pick the two dates */}
                {datePreset === 'custom' && (
                  <div className="mt-1 space-y-2 border-t border-line/60 px-3 pt-3 pb-1">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-xs font-medium text-ink-faint">
                        <span>From</span>
                        <input
                          type="date"
                          value={dateFrom}
                          max={dateTo || undefined}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm text-ink"
                        />
                      </label>
                      <label className="space-y-1 text-xs font-medium text-ink-faint">
                        <span>To</span>
                        <input
                          type="date"
                          value={dateTo}
                          min={dateFrom || undefined}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm text-ink"
                        />
                      </label>
                    </div>
                    <Button variant="primary" size="sm" onClick={close} className="w-full cursor-pointer">
                      Done
                    </Button>
                  </div>
                )}
              </>
            )}
          </DropdownChip>

          <DropdownChip
            title="Asset type"
            label={assetFilter === 'all' ? 'Asset' : (ASSET_FILTERS.find((f) => f.key === assetFilter)?.label ?? 'Asset')}
            active={assetFilter !== 'all'}
            onClear={() => setAssetFilter('all')}
          >
            {(close) =>
              ASSET_FILTERS.map((f) => (
                <PopoverOption
                  key={f.key}
                  selected={assetFilter === f.key}
                  onClick={() => {
                    setAssetFilter(f.key)
                    close()
                  }}
                >
                  {f.key === 'all' ? 'All assets' : f.label}
                </PopoverOption>
              ))
            }
          </DropdownChip>

          <DropdownChip
            title="Action"
            label={actionFilter === 'all' ? 'Action' : (ACTION_FILTERS.find((f) => f.key === actionFilter)?.label ?? 'Action')}
            active={actionFilter !== 'all'}
            onClear={() => setActionFilter('all')}
          >
            {(close) =>
              ACTION_FILTERS.map((f) => (
                <PopoverOption
                  key={f.key}
                  selected={actionFilter === f.key}
                  onClick={() => {
                    setActionFilter(f.key)
                    close()
                  }}
                >
                  {f.key === 'all' ? 'All actions' : f.label}
                </PopoverOption>
              ))
            }
          </DropdownChip>

          <div className="ml-auto flex items-center gap-2 pl-1 text-xs text-ink-muted">
            <span>
              {filtered.length}
              {anyFilter && <span className="text-ink-faint"> of {logs.length}</span>}
              {' '}{filtered.length === 1 && !anyFilter ? 'transaction' : 'transactions'}
            </span>
            {anyFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="font-medium text-brand hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Edit mode bar: says the list is editable and holds bulk delete + Done */}
        {editMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-sm">
            <span className="font-semibold text-brand">
              {selectedVisibleCount > 0 ? `${selectedLogIds.size} selected` : 'Editing: select, re-date or undo'}
            </span>
            <div className="flex items-center gap-2">
              {selectedVisibleCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedLogIds(new Set())}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink cursor-pointer"
                  >
                    Clear
                  </button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowBatchDeleteConfirm(true)}
                    className="cursor-pointer"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </>
              )}
              <Button variant="primary" size="sm" onClick={toggleEditMode} className="cursor-pointer">
                Done
              </Button>
            </div>
          </div>
        )}
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
                  onClick={resetFilters}
                  className="mt-2 cursor-pointer"
                >
                  Clear all filters
                </Button>
              }
            />
          </Card>
        ) : viewMode === 'table' ? (
          <Card padded={false} className="card-bleed-wide overflow-hidden border-0 shadow-none !bg-transparent">
            <div className="logs-table-shell overflow-x-auto">
              <table className="logs-table w-full text-left text-sm min-w-[980px]">
                <thead>
                  <tr className="logs-table-head text-xs font-bold text-ink-muted uppercase tracking-[0.12em]">
                    {editMode && (
                    <th className="logs-table-cell logs-table-check text-center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisibleLogs}
                        aria-label="Select all visible logs"
                        className="h-4 w-4 rounded border-line-strong accent-brand"
                      />
                    </th>
                    )}
                    <th className="logs-table-cell logs-table-date">Date & Time</th>
                    <th className="logs-table-cell logs-table-action">Action</th>
                    <th className="logs-table-cell logs-table-asset">Asset / Ticker</th>
                    <th className="logs-table-cell logs-table-metric text-right">Price / NAV</th>
                    <th className="logs-table-cell logs-table-metric text-right">Shares / Qty</th>
                    <th className="logs-table-cell logs-table-metric text-right">Amount (THB)</th>
                    <th className="logs-table-cell logs-table-location">Location</th>
                    <th className="logs-table-cell logs-table-note min-w-[220px]">Note</th>
                    {editMode && <th className="logs-table-cell logs-table-actions text-center">Edit</th>}
                  </tr>
                </thead>
                <tbody>
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
                          className={`logs-table-row transition-colors ${
                            hasComparison ? 'cursor-pointer' : ''
                          } ${isExpanded ? 'is-expanded' : ''}`}
                        >
                          {editMode && (
                          <td className="logs-table-cell logs-table-check text-center align-top">
                            <input
                              type="checkbox"
                              checked={selectedLogIds.has(log.id)}
                              onChange={() => toggleLogSelection(log.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${log.holdingName}`}
                              className="mt-1 h-4 w-4 rounded border-line-strong accent-brand"
                            />
                          </td>
                          )}
                          <td
                            className={`logs-table-cell logs-table-date whitespace-nowrap group/date ${editMode ? 'cursor-pointer' : ''}`}
                            onClick={editMode ? (e) => {
                              e.stopPropagation()
                              startEditDate(log)
                            } : undefined}
                            title={editMode ? 'Click to edit transaction' : undefined}
                          >
                            <div className="logs-table-date-main tnum flex items-center gap-1.5">
                              <span>{dateStr}</span>
                              {editMode && <PencilIcon className="h-2.5 w-2.5 opacity-70 text-brand" />}
                            </div>
                            <div className="logs-table-time tnum">{timeStr}</div>
                          </td>
                          <td className="logs-table-cell logs-table-action whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-bold tracking-[0.02em] ${actionMeta.style}`}>
                              {actionMeta.label}
                            </span>
                          </td>
                          <td className="logs-table-cell logs-table-asset">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="logs-table-asset-name text-ink">{log.holdingName}</span>
                              {log.ticker && log.ticker !== 'CASH' && log.ticker !== 'FIXED' && log.ticker !== 'DCA' && (
                                <span className="logs-table-ticker">
                                  {log.ticker}
                                </span>
                              )}
                            </div>
                            <span
                              className="logs-table-asset-type inline-block mt-1"
                              style={{
                                color:
                                  log.ticker === 'FIXED'
                                    ? '#f59e0b'
                                    : (ASSET_META[log.assetClass]?.color ?? '#6366f1'),
                              }}
                            >
                              {getLogAssetLabel(log)}
                            </span>
                          </td>
                          <td className="logs-table-cell logs-table-metric text-right whitespace-nowrap tnum font-semibold text-ink">
                            {tx.priceDisplay}
                          </td>
                          <td
                            className={`logs-table-cell logs-table-metric text-right whitespace-nowrap tnum font-bold ${
                              tx.sharesDisplay.startsWith('+')
                                ? 'text-gain'
                                : tx.sharesDisplay.startsWith('-')
                                ? 'text-loss'
                                : 'text-brand'
                            }`}
                          >
                            <div>{tx.sharesDisplay}</div>
                            {tx.sharesDisplaySecondary && (
                              <div className="text-2xs font-normal text-ink-faint tracking-tight mt-0.5">
                                {tx.sharesDisplaySecondary}
                              </div>
                            )}
                          </td>
                          <td className="logs-table-cell logs-table-metric text-right whitespace-nowrap tnum">
                            <div className="logs-table-amount font-semibold text-ink">
                              {tx.amountThbDisplay}
                            </div>
                            {log.action === 'sell' && log.realizedPnL !== undefined && (
                              <div
                                className={`logs-table-delta text-xs font-bold mt-1 ${
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
                          <td className="logs-table-cell logs-table-location whitespace-nowrap">
                            {locName ? (
                              <span className="logs-table-location-badge inline-flex items-center gap-1.5">
                                <WalletIcon className="h-3 w-3" />
                                {locName}
                              </span>
                            ) : (
                              <span className="text-ink-faint text-xs">-</span>
                            )}
                          </td>
                          <td className="logs-table-cell logs-table-note text-xs text-ink-muted">
                            <div className="flex items-center gap-1.5">
                              <span className="logs-table-note-text truncate" title={getDisplayNote(log)}>
                                {getDisplayNote(log)}
                              </span>
                              {hasComparison && (
                                <span
                                  className="logs-table-diff text-xs font-medium shrink-0"
                                  title="Click row to view Before/After comparison"
                                >
                                  {isExpanded ? '▲ Hide' : '▼ Diff'}
                                </span>
                              )}
                            </div>
                          </td>
                          {editMode && (
                          <td className="logs-table-cell logs-table-actions text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditDate(log)
                                }}
                                title="Edit transaction"
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
                          )}
                        </tr>
                        {isExpanded && (
                          <tr className="bg-surface-muted/20 border-b border-line">
                            <td colSpan={editMode ? 10 : 8} className="p-4 pl-8 sm:pl-12">
                              <div className="max-w-xl">
                                <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">
                                  State Comparison (Before → After)
                                </p>
                                {renderLogDetails(log, { cashAccounts: data.cashAccounts, usdThb, detailsOpen: expandedDetails.has(log.id), onToggleDetails: () => toggleDetails(log.id) })}
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
                <p className="mb-3 px-1 text-base sm:text-lg font-extrabold text-ink tracking-tight">{group.date}</p>
                <Card padded={false}>
                  <ul className="divide-y divide-line">
                  {group.entries.map((log) => {
                    const locName = getDestinationLocation(log)
                    const actionMeta = getLogActionMeta(log)
                    return (
                      <li key={log.id} className={`px-4 py-3.5 sm:px-5 sm:py-4 transition-colors hover:bg-surface-muted/30 ${selectedLogIds.has(log.id) ? 'bg-brand/5' : ''}`}>
                        {/* Header Row: Icon + Title & Badges + Time & Actions */}
                        <div className="flex items-start justify-between gap-2.5">
                          {/* Left: Asset Icon + Holding Info */}
                          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                            {editMode && (
                            <input
                              type="checkbox"
                              checked={selectedLogIds.has(log.id)}
                              onChange={() => toggleLogSelection(log.id)}
                              aria-label={`Select ${log.holdingName}`}
                              className="mt-2 h-4 w-4 shrink-0 rounded border-line-strong accent-brand"
                            />
                            )}
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
                            {editMode ? (
                              <button
                                type="button"
                                onClick={() => startEditDate(log)}
                                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-ink-faint hover:text-brand hover:bg-brand/5 transition-colors cursor-pointer"
                                title="Edit transaction"
                              >
                                <time>
                                  {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </time>
                                <PencilIcon className="h-2.5 w-2.5 opacity-70" />
                              </button>
                            ) : (
                              <time className="px-1.5 py-1 text-xs font-medium text-ink-faint">
                                {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </time>
                            )}
                            {editMode && (
                              <button
                                type="button"
                                onClick={() => setUndoTarget(log)}
                                aria-label={`Undo activity for ${log.holdingName}`}
                                className="rounded-lg px-2 py-1 text-xs font-bold text-loss/85 hover:text-loss hover:bg-loss/10 transition-colors cursor-pointer"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Body: State comparison / Unified Summary Strip */}
                        {renderLogDetails(log, { cashAccounts: data.cashAccounts, usdThb, detailsOpen: expandedDetails.has(log.id), onToggleDetails: () => toggleDetails(log.id) }) && (
                          <div className="mt-2.5 sm:ml-11">
                            {renderLogDetails(log, { cashAccounts: data.cashAccounts, usdThb, detailsOpen: expandedDetails.has(log.id), onToggleDetails: () => toggleDetails(log.id) })}
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

      <ConfirmModal
        open={showBatchDeleteConfirm}
        onClose={() => setShowBatchDeleteConfirm(false)}
        title={`Delete ${selectedLogIds.size} history ${selectedLogIds.size === 1 ? 'entry' : 'entries'}?`}
        description="This removes only Activity Log records. It will not change holdings, cash accounts, dividends, or any portfolio data."
        confirmText="Delete history only"
        confirmVariant="danger"
        confirmIcon={<TrashIcon className="h-4 w-4" />}
        onConfirm={() => {
          removeHoldingLogs(Array.from(selectedLogIds))
          showToast(`Deleted ${selectedLogIds.size} history ${selectedLogIds.size === 1 ? 'entry' : 'entries'}`, 'success')
          setSelectedLogIds(new Set())
          setShowBatchDeleteConfirm(false)
        }}
      />

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
          const linkedHolding = undoTarget.holdingId
            ? data.holdings.find((h) => h.id === undoTarget.holdingId)
            : undefined
          const isHoldingLocked = Boolean(linkedHolding?.isLocked || undoTarget.previousHoldingState?.isLocked)

          return (
            <div className="space-y-3">
              {isHoldingLocked && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <LockClosedIcon className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-sm">This asset is locked</span>
                    <span className="text-ink-muted mt-0.5 block leading-relaxed">
                      Undo will restore the units and cost from before this change. The asset will stay locked.
                    </span>
                  </div>
                </div>
              )}

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
            </div>
          )
        })()}
      </ConfirmModal>

      {/* Edit Transaction Modal */}
      {editingDateLog && (() => {
        const log = editingDateLog
        const meta = getLogActionMeta(log)
        const canChangeSource = isAcquisitionLog(log)
        const tookCash = canChangeSource && logTookCash(log)
        const payer = tookCash ? (log.dcaPlanId ? 'a DCA plan' : paidFromName(log) ?? 'a cash account') : ''
        const showTicker = log.ticker && !['CASH', 'FIXED', 'DCA'].includes(log.ticker)
        return (
          <Modal
            open
            onClose={closeEdit}
            title="Edit transaction"
            description={canChangeSource ? 'Change when it happened or how you got it.' : 'Change when it happened.'}
            footer={
              <FormActions
                editing
                canSave={Boolean(editDateValue)}
                onSave={saveEdit}
                onDelete={() => {
                  removeHoldingLog(log.id)
                  showToast(`Deleted "${log.holdingName}"`, 'success')
                  closeEdit()
                }}
                hint="Pick a date"
              />
            }
          >
            <div className="space-y-5">
              {/* What this entry is */}
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-muted px-3.5 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-base font-bold text-ink"
                  aria-hidden
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-ink">{log.holdingName}</span>
                    {showTicker && <span className="shrink-0 text-xs font-medium text-ink-muted">{log.ticker}</span>}
                  </div>
                  <p className="truncate text-xs text-ink-muted">{getDisplayNote(log) || meta.label}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.style}`}>{meta.label}</span>
              </div>

              {/* When */}
              <div className="space-y-3">
                <TransactionDateField value={editDateValue} onChange={setEditDateValue} label="Date" />
                <div>
                  <label htmlFor="edit-log-time" className="mb-1.5 block text-sm font-semibold text-ink-soft">
                    Time
                  </label>
                  <input
                    id="edit-log-time"
                    type="time"
                    value={editTimeValue}
                    onChange={(e) => setEditTimeValue(e.target.value)}
                    className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                </div>
              </div>

              {/* How it was acquired */}
              {canChangeSource && (
                <div className="border-t border-line pt-4">
                  {tookCash ? (
                    <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-xs text-ink-muted">
                      Paid from {payer}, so this stays a purchase. To record it as a gift, undo it and add it again.
                    </p>
                  ) : (
                    <AcquisitionSourceField
                      source={editSource}
                      onSourceChange={setEditSource}
                      receivedFrom={editReceivedFrom}
                      onReceivedFromChange={setEditReceivedFrom}
                      hint="Only the label changes. The cost you recorded stays the same."
                    />
                  )}
                </div>
              )}
            </div>
          </Modal>
        )
      })()}

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
