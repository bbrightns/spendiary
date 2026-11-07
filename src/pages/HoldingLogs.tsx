import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { planEditUndo } from '../store/actions/undoEdit'
import { canUndoLog, undoHoldingLogChecked } from '../store/actions/holdingLogs'
import { useToast } from '../store/ToastContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, Inset } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { DropdownChip } from '../components/ui/DropdownChip'
import { FilterChip } from '../components/ui/FilterChip'
import { Popover, PopoverOption } from '../components/ui/Popover'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { getLogTransactionDetails } from '../lib/activitySummary'
import { dateStrToTimestamp, localDateStr, money, thb } from '../lib/format'
import type { AcquisitionSource, AssetClass, HoldingLog } from '../lib/types'
import { logTookCash, noteForSource, paidFromName } from '../lib/acquisition'
import { AcquisitionSourceField } from '../components/forms/AcquisitionSourceField'
import { FormActions } from '../components/forms/FormActions'
import { ClockIcon, DotsHorizontalIcon, DownloadIcon, LockClosedIcon, SearchIcon, TrashIcon, UndoIcon } from '../components/icons'
import { TransactionDateField } from '../components/forms/TransactionDateField'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { buildCsv, downloadCsv } from '../lib/csv'
import { ActiveSearch, EMPTY_TITLE, HistoryRangeBar, HistorySearchSheet, dayLabel, rangePeriod, type Range, type SearchContext } from '../modules/spend/history'
import { inPeriod } from '../modules/spend/logic'
import { getLogActionMeta, getDisplayNote, getDestinationLocation, ASSET_FILTERS, ACTION_FILTERS, isAcquisitionLog } from './holdingLogs/logMeta'
import { renderLogDetails } from './holdingLogs/logDetails'
import { TradeRow, TradeTile } from './holdingLogs/TradeRow'
import { getTradeRow, matchesTrade, tickerOf, tradeTotals } from './holdingLogs/tradeView'

type ActionFilter = (typeof ACTION_FILTERS)[number]['key']

const dayOf = (log: HoldingLog) => localDateStr(new Date(log.timestamp))

function matchesAction(log: HoldingLog, filter: ActionFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'buy') return log.action === 'add' || log.action === 'buy_more'
  return log.action === filter
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
  const logs = useMemo(
    () => [...(data.holdingLogs ?? [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [data.holdingLogs],
  )

  const [undoTarget, setUndoTarget] = useState<HoldingLog | null>(null)
  const [editingDateLog, setEditingDateLog] = useState<HoldingLog | null>(null)
  const [editDateValue, setEditDateValue] = useState<string>('')
  const [editTimeValue, setEditTimeValue] = useState<string>('')
  const [editSource, setEditSource] = useState<AcquisitionSource>('bought')
  const [editReceivedFrom, setEditReceivedFrom] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  function startEditDate(log: HoldingLog) {
    setEditingDateLog(log)
    const dt = new Date(log.timestamp)
    setEditDateValue(localDateStr(dt))
    setEditTimeValue(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    setEditSource(log.source ?? 'bought')
    setEditReceivedFrom(log.receivedFrom ?? '')
    setDetailsOpen(false)
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

  /** Says why right away when an entry can't be undone; otherwise asks first */
  function requestUndo(log: HoldingLog) {
    const check = undoHoldingLogChecked(data, log.id)
    if (check.ok) setUndoTarget(log)
    else showToast(check.reason, 'warn')
  }

  const [assetFilter, setAssetFilter] = useState<AssetClass | 'all'>('all')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [range, setRange] = useState<Range>('month')
  const [anchor, setAnchor] = useState(localDateStr())
  const period = useMemo(() => rangePeriod(range, anchor), [range, anchor])
  const [searchOpen, setSearchOpen] = useState(false)

  // Opened from the search bar with ?q=BTC: start filtered to it
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const setQuery = (q: string) => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q)
    else next.delete('q')
    setParams(next, { replace: true })
  }
  // A search looks across every month; browsing without one stays on the chosen range
  const searching = query.trim() !== ''
  const showYear = searching || range === 'all'

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return logs.filter(
      (l) =>
        (terms.length > 0 || !period || inPeriod(period, dayOf(l))) &&
        (assetFilter === 'all' || l.assetClass === assetFilter) &&
        matchesAction(l, actionFilter) &&
        matchesTrade(l, terms),
    )
  }, [logs, period, assetFilter, actionFilter, query])

  const groups = useMemo(() => {
    const map = new Map<string, HoldingLog[]>()
    for (const l of filtered) map.set(dayOf(l), [...(map.get(dayOf(l)) ?? []), l])
    return [...map.entries()]
  }, [filtered])

  const totals = useMemo(() => tradeTotals(filtered, usdThb), [filtered, usdThb])

  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set())
  // Choosing entries to delete is rare, so its checkboxes stay out of the list until asked for
  const [selecting, setSelecting] = useState(false)
  const toggleSelecting = () => {
    setSelecting((v) => !v)
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

  const allVisibleSelected = filtered.length > 0 && filtered.every((log) => selectedLogIds.has(log.id))
  const toggleAllVisibleLogs = () => setSelectedLogIds(allVisibleSelected ? new Set() : new Set(filtered.map((log) => log.id)))

  const anyFilter = assetFilter !== 'all' || actionFilter !== 'all' || searching
  const resetFilters = () => {
    setQuery('')
    setAssetFilter('all')
    setActionFilter('all')
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBtnRef = useRef<HTMLButtonElement>(null)

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

  const undoCheck = undoTarget ? undoHoldingLogChecked(data, undoTarget.id) : null
  // The balances this undo moves, shown before it happens
  const undoCash = undoCheck?.ok
    ? (undoCheck.data.cashAccounts ?? []).flatMap((after) => {
        const before = data.cashAccounts?.find((c) => c.id === after.id)
        return before && before.balance !== after.balance ? [{ id: after.id, name: after.name, from: before.balance, to: after.balance, currency: after.currency }] : []
      })
    : []

  return (
    <div className="space-y-4">
      <div id="guide-logs-header" className="space-y-4">
        <PageHeader
          eyebrow="Invest"
          title="Trades"
          className="mb-0"
          onStartGuide={startTour}
          subtitle={
            searching ? (
              <ActiveSearch label={query} onOpen={() => setSearchOpen(true)} onClear={() => setQuery('')} />
            ) : (
              <HistoryRangeBar
                range={range}
                period={period}
                onRangeChange={(r) => {
                  setRange(r)
                  setAnchor(localDateStr())
                }}
                onAnchorChange={setAnchor}
                onSearch={() => setSearchOpen(true)}
                searchLabel="Search trades"
              />
            )
          }
          action={
            <>
              {/* ⋯ menu: Export CSV and bulk delete, used far less than the filters */}
              <button
                ref={moreBtnRef}
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More actions"
                title="More actions"
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-xs transition-colors hover:text-ink cursor-pointer"
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
                  icon={<TrashIcon className="h-4 w-4" />}
                  onClick={() => {
                    setMoreOpen(false)
                    toggleSelecting()
                  }}
                >
                  {selecting ? 'Done selecting' : 'Select to delete'}
                </PopoverOption>
              </Popover>
            </>
          }
        />

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
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
          {ACTION_FILTERS.map((f) => (
            <FilterChip key={f.key} active={actionFilter === f.key} onClick={() => setActionFilter(f.key)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <HistorySearchSheet
        open={searchOpen}
        initial={query}
        recentKey={STORAGE_KEYS.tradesRecentSearches}
        placeholder="Assets, notes or wallets"
        ariaLabel="Search trades"
        countFor={(words) => logs.filter((l) => matchesTrade(l, words)).length}
        onClose={() => setSearchOpen(false)}
        onApply={(q) => {
          setQuery(q)
          setSearchOpen(false)
        }}
      >
        {(search) => <AssetSuggestions logs={logs} search={search} />}
      </HistorySearchSheet>

      {/* Bulk delete bar: says the list is selectable and holds Delete + Done */}
      {selecting && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-sm">
          <span className="font-semibold text-link tnum">
            {selectedLogIds.size > 0 ? `${selectedLogIds.size} selected` : 'Pick entries to remove from history'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleAllVisibleLogs} className="cursor-pointer">
              {allVisibleSelected ? 'Clear' : 'Select all'}
            </Button>
            {selectedLogIds.size > 0 && (
              <Button variant="danger" size="sm" onClick={() => setShowBatchDeleteConfirm(true)} className="cursor-pointer">
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={toggleSelecting} className="cursor-pointer">
              Done
            </Button>
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-ink-muted tnum">
          <span>
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
          {totals.bought > 0 && (
            <span>
              Bought <b className="font-bold text-ink">{thb(totals.bought, true)}</b>
            </span>
          )}
          {totals.sold > 0 && (
            <span>
              Sold <b className="font-bold text-ink">{thb(totals.sold, true)}</b>
            </span>
          )}
          {totals.dividends > 0 && (
            <span>
              Dividends <b className="font-bold text-gain-ink">{thb(totals.dividends, true)}</b>
            </span>
          )}
        </div>
      )}

      <div id="guide-logs-list">
        {logs.length === 0 ? (
          <Card className="card-bleed-mobile">
            <EmptyState
              icon={<ClockIcon className="h-7 w-7" />}
              title="No activity yet"
              description="Actions you take in Portfolio (adding, buying more, or editing holdings) will appear here."
              accent="var(--color-brand)"
            />
          </Card>
        ) : groups.length === 0 ? (
          <Card className="card-bleed-mobile">
            <EmptyState
              icon={anyFilter ? <SearchIcon className="h-7 w-7" /> : <ClockIcon className="h-7 w-7" />}
              title={anyFilter ? 'No matches' : EMPTY_TITLE[range]}
              description={anyFilter ? 'Try another word or clear the filters.' : 'Older entries are still here.'}
              accent="var(--color-brand)"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={anyFilter ? resetFilters : () => setRange('all')}
                  className="mt-2 cursor-pointer"
                >
                  {anyFilter ? 'Clear all filters' : 'Show all'}
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map(([date, entries]) => (
              <Card key={date} list className="card-bleed-mobile pt-3 pb-1">
                <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-semibold text-ink-muted">
                  <span>{dayLabel(date, showYear)}</span>
                  <span className="tnum">
                    {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {entries.map((log) => (
                    <TradeRow
                      key={log.id}
                      log={log}
                      usdThb={usdThb}
                      onOpen={() => startEditDate(log)}
                      onUndo={() => requestUndo(log)}
                      selecting={selecting}
                      selected={selectedLogIds.has(log.id)}
                      onToggleSelected={() => toggleLogSelection(log.id)}
                    />
                  ))}
                </div>
              </Card>
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

      <ConfirmModal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title="Undo this entry?"
        description={undoTarget?.action === 'edit'
          ? 'Puts back only what this edit changed. Buys, sells and later edits stay as they are.'
          : 'Puts your holdings and cash back to how they were without this entry. Later entries stay as they are.'}
        confirmText="Undo entry"
        confirmVariant="primary"
        confirmIcon={<UndoIcon className="h-4 w-4" strokeWidth={2.4} />}
        onConfirm={() => {
          if (undoTarget) {
            // Say why when it can't be undone (nothing changes then), and which edited fields were changed again since
            const plan = undoTarget.action === 'edit' && undoTarget.holdingId
              ? planEditUndo(data.holdings.find((h) => h.id === undoTarget.holdingId), undoTarget)
              : null
            if (undoCheck && !undoCheck.ok) {
              showToast(undoCheck.reason, 'warn')
            } else {
              undoHoldingLog(undoTarget.id)
              const kept = plan?.ok && plan.kept.length > 0 ? ` Kept the ${plan.kept.join(', ')}: changed again since.` : ''
              showToast(`Undid "${getTradeRow(undoTarget, usdThb).title}".${kept}`, 'info')
            }
          }
          setUndoTarget(null)
        }}
      >
        {undoTarget && (() => {
          const view = getTradeRow(undoTarget, usdThb)
          const undoMeta = getLogActionMeta(undoTarget)
          const linkedHolding = undoTarget.holdingId
            ? data.holdings.find((h) => h.id === undoTarget.holdingId)
            : undefined
          const isHoldingLocked = Boolean(linkedHolding?.isLocked || undoTarget.previousHoldingState?.isLocked)

          return (
            <div className="space-y-3">
              {isHoldingLocked && (
                <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 flex items-start gap-2.5 text-xs text-warn-ink">
                  <LockClosedIcon className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-sm">This asset is locked</span>
                    <span className="text-ink-muted mt-0.5 block leading-relaxed">
                      Undo will restore the units and cost from before this change. The asset will stay locked.
                    </span>
                  </div>
                </div>
              )}

              <Inset className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <TradeTile log={undoTarget} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{view.title}</p>
                    <p className="truncate text-xs text-ink-muted">{view.meta}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${undoMeta.style}`}>{undoMeta.label}</span>
                </div>
                {undoCash.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 border-t border-line pt-2.5 text-xs">
                    <span className="min-w-0 truncate font-semibold text-ink-muted">{c.name}</span>
                    <span className="shrink-0 tnum text-ink">
                      {money(c.from, c.currency, true)} → <b className="font-bold">{money(c.to, c.currency, true)}</b>
                    </span>
                  </div>
                ))}
              </Inset>
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
        const ticker = tickerOf(log)
        const undoable = canUndoLog(log)
        const details = renderLogDetails(log, { cashAccounts: data.cashAccounts, usdThb, detailsOpen, onToggleDetails: () => setDetailsOpen((v) => !v) })
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
              <div className="flex items-center gap-3 rounded-2xl bg-surface-muted px-3.5 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-base font-bold text-ink"
                  aria-hidden
                >
                  <meta.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-ink">{log.holdingName}</span>
                    {ticker && <span className="shrink-0 text-xs font-medium text-ink-muted">{ticker}</span>}
                  </div>
                  <p className="truncate text-xs text-ink-muted">{getDisplayNote(log) || meta.label}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.style}`}>{meta.label}</span>
              </div>

              {details && <div>{details}</div>}

              {/* Undo reverses the entry; the bin below only takes it off this list */}
              {undoable ? (
                <div className="space-y-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      closeEdit()
                      requestUndo(log)
                    }}
                    className="w-full cursor-pointer"
                  >
                    <UndoIcon className="h-4 w-4" />
                    Undo this entry
                  </Button>
                  <p className="text-xs text-ink-muted">Undo puts back what this entry changed. The bin only removes it from this list.</p>
                </div>
              ) : (
                <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-xs text-ink-muted">This entry only records what happened, so it has nothing to undo.</p>
              )}

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
                    className="h-11 w-full rounded-xl border border-line-strong bg-surface-muted focus:bg-surface px-3.5 text-base text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
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
    </div>
  )
}

/** Assets from the entries, to search by tapping */
function AssetSuggestions({ logs, search }: { logs: HoldingLog[]; search: SearchContext }) {
  const { words, last, apply } = search
  const assets = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>()
    for (const l of logs) {
      const ticker = tickerOf(l)
      if (!ticker) continue
      const a = m.get(ticker) ?? { label: l.holdingName, n: 0 }
      a.n += 1
      m.set(ticker, a)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [logs])
  const shown = assets
    .filter(([ticker, a]) => !last || ticker.toLowerCase().startsWith(last) || a.label.toLowerCase().includes(last))
    .slice(0, 10)
  if (shown.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink-soft">Assets</p>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(([ticker, a]) => (
          <button
            key={ticker}
            type="button"
            // Replace the half-typed word with the ticker, then search
            onClick={() => apply([...words.slice(0, last ? -1 : undefined), ticker.toLowerCase()].join(' '))}
            className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer"
          >
            {ticker}
            <span className="ml-1.5 font-semibold opacity-70 tnum">{a.n}×</span>
          </button>
        ))}
      </div>
    </div>
  )
}
