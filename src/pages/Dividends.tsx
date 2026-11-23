import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { AssetLogo } from '../components/ui/AssetLogo'
import { ConfirmDividendModal } from '../components/forms/ConfirmDividendModal'
import { DividendSetupModal } from '../components/forms/DividendSetupModal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { money, thb } from '../lib/format'
import { dividendInUsd, dividendThb } from '../lib/dividendSchedule'
import { THAI_MONTHS_SHORT, getHoldingAnnualDividend, getHoldingDpsForMonth, isDividendReceivedThisMonth } from '../lib/calc'
import { CalendarIcon, CheckCircleIcon, ChevronDownIcon, ChevronRightIcon, CoinsIcon, PlusIcon, TrashIcon } from '../components/icons'
import type { DividendRecord, Holding } from '../lib/types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/** What a holding is worth in baht (prices are kept in baht), or what was paid for it when it has no price */
function holdingValueThb(h: Holding): number {
  const units = h.units ?? h.totalUnits ?? 0
  return h.price > 0 ? units * h.price : (h.totalThbInvested ?? (units * (h.avgCostThb ?? h.avgCost ?? 0)))
}

export function Dividends() {
  const { data, removeDividendRecord, usdThb } = useData()
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null)
  const [selectedDps, setSelectedDps] = useState<number | undefined>(undefined)
  // Dividend setup sheet: a holding to edit, null to pick one, undefined when closed
  const [setupHolding, setSetupHolding] = useState<Holding | null | undefined>(undefined)

  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      const firstDividendHolding = (data.holdings ?? []).find((h) => h.paysDividend)
      if (firstDividendHolding) {
        setSelectedHolding(firstDividendHolding)
        setModalOpen(true)
      } else if (data.holdings.length > 0) {
        setSelectedHolding(data.holdings[0])
        setModalOpen(true)
      }
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, setSearchParams, data.holdings])

  const [deletingRecord, setDeletingRecord] = useState<DividendRecord | null>(null)
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [isUpcomingOpen, setIsUpcomingOpen] = useState<boolean | null>(null)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  // Memoised so the fallback [] is not a new array each render, which would re-run every memo below
  const records = useMemo(() => data.dividendRecords ?? [], [data.dividendRecords])

  // KPI Calculations
  const thisYearRecords = useMemo(() => {
    return records.filter((r) => {
      const year = parseInt(r.paymentDate.split('-')[0], 10)
      return year === currentYear
    })
  }, [records, currentYear])

  // Records hold dps × shares in the holding's currency; USD is counted in baht only at a real rate
  const receivedThisYear = useMemo(() => {
    const out = { net: 0, gross: 0, tax: 0, usdLeftOut: 0 }
    for (const r of thisYearRecords) {
      const net = dividendThb(r, r.netAmount, usdThb)
      if (net === null) {
        out.usdLeftOut += r.netAmount
        continue
      }
      out.net += net
      out.gross += dividendThb(r, r.grossAmount, usdThb) ?? 0
      out.tax += dividendThb(r, r.taxAmount, usdThb) ?? 0
    }
    return out
  }, [thisYearRecords, usdThb])

  // Holdings that pay dividends
  const dividendHoldings = useMemo(() => {
    return (data.holdings ?? []).filter((h) => h.paysDividend)
  }, [data.holdings])

  // Estimated annual dividend across all dividend holdings, in baht, and the yield on what those holdings are worth
  const expectedThisYear = useMemo(() => {
    let gross = 0
    let value = 0
    let usdLeftOut = 0
    for (const h of dividendHoldings) {
      const annual = getHoldingAnnualDividend(h)
      const annualThb = dividendThb(h, annual, usdThb)
      if (annualThb === null) {
        usdLeftOut += annual * 0.90
        continue
      }
      gross += annualThb
      value += holdingValueThb(h)
    }
    return { net: gross * 0.90, yieldPct: value > 0 ? (gross / value) * 100 : 0, usdLeftOut } // 10% withholding tax
  }, [dividendHoldings, usdThb])
  const annualDividendYieldPct = expectedThisYear.yieldPct

  // Upcoming dividends for this month
  const upcomingHoldings = useMemo(() => {
    return dividendHoldings.filter((h) => (h.dividendMonths ?? []).includes(currentMonth))
  }, [dividendHoldings, currentMonth])

  const upcomingOpen = isUpcomingOpen ?? (upcomingHoldings.length > 0)

  // Estimated this month, in baht (10% tax estimate); USD left out until a rate is known
  const estimatedThisMonth = useMemo(() => {
    return upcomingHoldings.reduce((sum, h) => {
      const units = h.units ?? h.totalUnits ?? 0
      return sum + (dividendThb(h, units * getHoldingDpsForMonth(h, currentMonth) * 0.90, usdThb) ?? 0)
    }, 0)
  }, [upcomingHoldings, currentMonth, usdThb])

  /** An amount in the holding's currency, shown in baht when it can be, else in dollars */
  const shown = (h: Pick<Holding, 'assetClass'>, amount: number) => {
    const inThb = dividendThb(h, amount, usdThb)
    return inThb === null ? money(amount, 'USD', true) : thb(inThb)
  }
  /** An amount in the holding's own currency (history table: what was actually paid) */
  const own = (h: Pick<Holding, 'assetClass'>, amount: number) => (dividendInUsd(h) ? money(amount, 'USD', true) : thb(amount))


  // Unique years in records for filter
  const availableYears = useMemo(() => {
    const set = new Set<string>()
    records.forEach((r) => {
      const y = r.paymentDate.split('-')[0]
      if (y) set.add(y)
    })
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [records])

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (yearFilter === 'all') return records
    return records.filter((r) => r.paymentDate.startsWith(yearFilter))
  }, [records, yearFilter])

  const handleOpenAddModal = (h?: Holding, dps?: number) => {
    setSelectedHolding(h ?? null)
    setSelectedDps(dps)
    setModalOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (!deletingRecord) return
    removeDividendRecord(deletingRecord.id)
    showToast(`Removed dividend record for ${deletingRecord.ticker}`, 'info')
    setDeletingRecord(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Invest"
        title="Dividends"
        subtitle="Record dividends you receive, see what to expect this year, and track tax withheld"
      />

      <div className="space-y-4 sm:space-y-6">
        {/* ── KPI Stat Cards ── */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          {/* Card 1: expected dividends this year & yield */}
          <Card compact className="animate-rise flex flex-col justify-between col-span-2 lg:col-span-1">
            <div>
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold text-gain-ink">
                  Expected this year
                </p>
                {annualDividendYieldPct > 0 && (
                  <span className="inline-flex items-center rounded-full bg-gain/15 border border-gain/30 px-2 py-0.5 text-xs font-bold text-gain-ink">
                    ~{annualDividendYieldPct.toFixed(1)}% per year
                  </span>
                )}
              </div>
              <p className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-gain-ink tnum truncate">
                ~{thb(expectedThisYear.net)}
              </p>
            </div>
            <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
              {expectedThisYear.usdLeftOut > 0
                ? `Leaves out ${money(expectedThisYear.usdLeftOut, 'USD')} until a USD/THB rate loads`
                : annualDividendYieldPct > 0
                  ? `About ${annualDividendYieldPct.toFixed(1)}% per year, like interest on a deposit`
                  : 'Set up dividends on your stocks to see this'}
            </p>
          </Card>

          {/* Card 2: received this year */}
          <Card compact className="animate-rise flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Received ({currentYear})</p>
              <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold text-ink tnum truncate">
                {thb(receivedThisYear.net)}
              </p>
            </div>
            <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
              {receivedThisYear.usdLeftOut > 0
                ? `Leaves out ${money(receivedThisYear.usdLeftOut, 'USD', true)} until a USD/THB rate loads`
                : `Before tax ${thb(receivedThisYear.gross)} · tax -${thb(receivedThisYear.tax)}`}
            </p>
          </Card>

          {/* Card 3: expected this month */}
          <Card compact className="animate-rise flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Due this month ({MONTH_NAMES[currentMonth - 1]})</p>
              <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold text-brand-ink tnum truncate">
                {estimatedThisMonth > 0 ? `~${thb(estimatedThisMonth)}` : '-'}
              </p>
            </div>
            <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
              {upcomingHoldings.length > 0 ? `${upcomingHoldings.length} waiting to be received` : 'Nothing due this month'}
            </p>
          </Card>
        </div>

        {/* ── Section 1: Upcoming / Expected Dividends (Smart Accordion) ── */}
        <Card className="card-bleed-mobile animate-rise overflow-hidden" padded={false}>
          <button
            type="button"
            onClick={() => setIsUpcomingOpen(!upcomingOpen)}
            aria-expanded={upcomingOpen}
            className="flex w-full items-center justify-between p-3.5 sm:p-5 text-left transition-colors hover:bg-surface-muted/50 cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CalendarIcon className="h-5 w-5 shrink-0 text-ink-muted" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="truncate font-display text-lg font-extrabold text-ink">
                    Dividends due this month
                  </h2>
                  <span className="rounded-full bg-gain/15 text-gain-ink px-2 py-0.5 text-xs font-bold">
                    {MONTH_NAMES[currentMonth - 1]}
                  </span>
                  {upcomingHoldings.length > 0 && (
                    <span className="rounded-full bg-surface-muted border border-line text-ink-muted px-2 py-0.5 text-xs font-bold">
                      {upcomingHoldings.length} {upcomingHoldings.length === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                {!upcomingOpen ? (
                  <p className="text-xs text-ink-muted mt-0.5 truncate">
                    {upcomingHoldings.length === 0
                      ? `No dividends due in ${MONTH_NAMES[currentMonth - 1]} (tap for details)`
                      : `Expecting ~${thb(estimatedThisMonth)} · tap to review and confirm`}
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted mt-0.5 hidden sm:block">
                    Stocks and assets that pay a dividend this month
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-medium text-ink-muted hidden sm:inline">
                {upcomingOpen ? 'Hide' : 'Show'}
              </span>
              <div className="rounded-full p-1 hover:bg-surface-muted text-ink-muted">
                <ChevronDownIcon
                  className={`h-4 w-4 transition-transform duration-200 ${
                    upcomingOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </button>

          {upcomingOpen && (
            <div className="border-t border-line">
              {upcomingHoldings.length === 0 ? (
                <div className="p-4 sm:p-6 text-center">
                  <p className="text-sm text-ink-muted">
                    No dividends due in {MONTH_NAMES[currentMonth - 1]}
                  </p>
                  <p className="text-xs text-ink-faint mt-1">
                    Set the months a stock pays under "Dividend stocks" below, or tap "+ Record dividend" at any time.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {upcomingHoldings.map((h) => {
                    const units = h.units ?? h.totalUnits ?? 0
                    const dps = getHoldingDpsForMonth(h, currentMonth)
                    const estNet = units * dps * 0.90
                    const isReceived = isDividendReceivedThisMonth(h.id, data.dividendRecords)
                    const sym = h.assetClass === 'stock' ? '$' : '฿'

                    // Asset level annual yield (% ต่อปี)
                    const annualGross = getHoldingAnnualDividend(h)
                    const annualThb = dividendThb(h, annualGross, usdThb)
                    const assetVal = holdingValueThb(h)
                    const assetYieldPct = annualThb !== null && assetVal > 0 ? (annualThb / assetVal) * 100 : 0

                    return (
                      <li key={h.id} className="p-3.5 sm:px-5 sm:py-4 hover:bg-surface-muted/50 transition-colors">
                        <div className="flex flex-col gap-2.5">
                          
                          {/* ── Row 1: stock info / amount & yield / edit button ── */}
                          <div className="flex items-start justify-between gap-3 min-w-0">
                            {/* Left: logo + name + yield | edit button */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <AssetLogo name={h.name} assetClass={h.assetClass} size="md" />
                              <div className="min-w-0 flex-1">
                                {/* Line 1.1: ticker + full name */}
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-display font-bold text-base text-ink truncate">
                                    {h.ticker}
                                  </span>
                                  <span className="text-xs text-ink-muted truncate max-w-[140px] sm:max-w-xs">
                                    {h.name}
                                  </span>
                                </div>

                                {/* Line 1.2: yield | [edit button] */}
                                <div className="flex items-center gap-2 mt-1 text-xs">
                                  {assetYieldPct > 0 ? (
                                    <span className="inline-flex items-center rounded bg-gain/10 text-gain-ink px-1.5 py-0.5 font-bold">
                                      ~{assetYieldPct.toFixed(1)}% per year
                                    </span>
                                  ) : (
                                    <span className="text-ink-muted">-</span>
                                  )}
                                  <span className="text-line">|</span>
                                  <button
                                    type="button"
                                    onClick={() => setSetupHolding(h)}
                                    className="inline-flex items-center text-link hover:text-brand-ink font-semibold hover:underline cursor-pointer transition-colors"
                                  >
                                    Edit dividend
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Right: amount to receive */}
                            {estNet > 0 && (
                              <div className="text-right shrink-0">
                                <span className="font-display text-base sm:text-lg font-extrabold text-gain-ink tnum">
                                  ~{shown(h, estNet)}
                                </span>
                                <p className="text-xs text-ink-muted">About (after tax)</p>
                              </div>
                            )}
                          </div>

                          {/* ── Divider ── */}
                          <div className="border-t border-line/60" />

                          {/* ── Row 2: shares, dividend per share, and [confirm button] ── */}
                          <div className="flex items-center justify-between gap-3 min-w-0">
                            {/* Left: shares and dividend per share */}
                            <div className="text-xs text-ink-muted min-w-0 truncate">
                              <span>{units.toLocaleString()} {units === 1 ? 'share' : 'shares'}</span>
                              <span className="mx-1.5">·</span>
                              <span>Dividend: <strong className="text-ink font-semibold">{dps > 0 ? `${sym}${dps.toLocaleString()}` : 'N/A'}</strong> / share</span>
                              {annualGross > 0 && (
                                <span className="hidden sm:inline text-ink-muted">
                                  {' '}(~{shown(h, annualGross)} per year)
                                </span>
                              )}
                            </div>

                            {/* Right: action buttons */}
                            <div className="shrink-0">
                              {isReceived ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-gain-soft px-3 py-1 text-xs font-bold text-gain-ink">
                                    <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.4} /> Received
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddModal(h, dps > 0 ? dps : undefined)}
                                    className="inline-flex items-center rounded-full border border-line bg-surface hover:bg-surface-muted text-ink-muted hover:text-ink px-2.5 py-1 text-xs font-medium active:scale-95 transition-all cursor-pointer"
                                  >
                                    + Add another
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddModal(h, dps > 0 ? dps : undefined)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-gain-strong hover:bg-gain-strong-hover text-white px-3.5 sm:px-4 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                                >
                                  <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                                  Confirm received
                                </button>
                              )}
                            </div>
                          </div>

                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </Card>

        {/* ── Section 2: Holdings set up to pay dividends ── */}
        <Card className="card-bleed-mobile animate-rise" padded={false}>
          <div className="flex items-center justify-between gap-3 p-5 border-b border-line">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-extrabold text-ink">Dividend stocks</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Funds and stocks you expect a dividend from, and when
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSetupHolding(null)}
              className="h-9 gap-1.5 shrink-0"
            >
              <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
              <span>Set up</span>
            </Button>
          </div>

          {dividendHoldings.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<CalendarIcon className="h-8 w-8 text-ink-muted" />}
                title="No dividend stocks yet"
                description="Pick a fund or stock you hold and set the months it pays, to see what to expect each month."
                action={
                  <Button variant="primary" size="sm" onClick={() => setSetupHolding(null)} className="h-9 gap-1.5">
                    <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
                    <span>Set up a dividend</span>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {dividendHoldings.map((h) => {
                const months = [...(h.dividendMonths ?? [])].sort((a, b) => a - b)
                const annualNet = getHoldingAnnualDividend(h) * 0.90
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setSetupHolding(h)}
                      className="flex w-full items-center gap-3 p-3.5 sm:px-5 text-left hover:bg-surface-muted/50 transition-colors cursor-pointer"
                    >
                      <AssetLogo name={h.name} assetClass={h.assetClass} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {h.ticker} <span className="font-normal text-ink-muted">{h.name}</span>
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {months.length > 0 ? months.map((m) => THAI_MONTHS_SHORT[m - 1]).join(', ') : 'No months set'}
                        </p>
                      </div>
                      {annualNet > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gain-ink tnum">~{shown(h, annualNet)}</p>
                          <p className="text-xs text-ink-muted">per year</p>
                        </div>
                      )}
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-muted" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* ── Section 3: Dividend Payout History ── */}
        <Card className="card-bleed-mobile animate-rise" padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-line">
            <div>
              <h2 className="font-display text-lg font-extrabold text-ink">Dividend history</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Dividends you have recorded, with the tax withheld
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Year filter chips */}
              {availableYears.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setYearFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      yearFilter === 'all'
                        ? 'bg-brand text-white shadow-2xs'
                        : 'bg-surface-muted text-ink-muted hover:text-ink'
                    }`}
                  >
                    All
                  </button>
                  {availableYears.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYearFilter(y)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        yearFilter === y
                          ? 'bg-brand text-white shadow-2xs'
                          : 'bg-surface-muted text-ink-muted hover:text-ink'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}

              {/* Action Button: Record Dividend */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenAddModal()}
                className="h-9 gap-1.5 text-xs sm:text-sm font-semibold cursor-pointer shadow-xs shrink-0"
              >
                <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
                <span>Record dividend</span>
              </Button>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<CoinsIcon className="h-8 w-8 text-ink-muted" />}
                title="No dividends recorded yet"
                description="When you confirm a dividend, it will show up here along with the tax details."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenAddModal()}
                    className="h-9 gap-1.5 text-xs sm:text-sm font-semibold cursor-pointer shadow-xs"
                  >
                    <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
                    <span>Record your first dividend</span>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-muted/50 border-b border-line text-xs font-bold text-ink-muted">
                  <tr>
                    <th className="px-5 py-3">Date received</th>
                    <th className="px-5 py-3">Stock / asset</th>
                    <th className="px-5 py-3 text-right">Dividend / share</th>
                    <th className="px-5 py-3 text-right">Shares</th>
                    <th className="px-5 py-3 text-right">Before tax</th>
                    <th className="px-5 py-3 text-right">Tax (10%)</th>
                    <th className="px-5 py-3 text-right">Net received</th>
                    <th className="px-5 py-3">Paid into</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-muted/40 transition-colors">
                      <td className="px-5 py-3.5 text-ink font-medium whitespace-nowrap">
                        {r.paymentDate}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <AssetLogo name={r.holdingName} assetClass={r.assetClass} size="sm" />
                          <div>
                            <span className="font-bold text-ink">{r.ticker}</span>
                            <span className="block text-xs text-ink-muted truncate max-w-[140px] sm:max-w-none">
                              {r.holdingName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink-soft tnum whitespace-nowrap">
                        {dividendInUsd(r) ? '$' : '฿'}{r.dps.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink-soft tnum whitespace-nowrap">
                        {r.shares.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink tnum whitespace-nowrap">
                        {own(r, r.grossAmount)}
                      </td>
                      <td className={`px-5 py-3.5 text-right font-medium tnum whitespace-nowrap ${r.taxAmount > 0 ? 'text-loss-ink' : 'text-ink-muted'}`}>
                        {r.taxAmount > 0 ? `-${own(r, r.taxAmount)}` : '–'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-display font-extrabold text-gain-ink tnum whitespace-nowrap">
                        {own(r, r.netAmount)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-ink-muted text-xs">
                        {r.cashAccountName ? (
                          <span title={r.cashAccountName} className="inline-block max-w-40 truncate align-middle rounded-md bg-surface-muted px-2 py-0.5 font-medium text-ink">
                            {r.cashAccountName}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDeletingRecord(r)}
                          aria-label={`Delete dividend for ${r.ticker}`}
                          className="rounded-lg p-1 text-ink-muted hover:bg-loss/10 hover:text-loss-ink transition-colors cursor-pointer"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Confirm Dividend Modal ── */}
      <ConfirmDividendModal
        open={modalOpen}
        holding={selectedHolding}
        initialDps={selectedDps}
        onClose={() => {
          setModalOpen(false)
          setSelectedHolding(null)
          setSelectedDps(undefined)
        }}
      />

      {/* ── Dividend setup: months, dividend per share, cash account ── */}
      <DividendSetupModal
        open={setupHolding !== undefined}
        holding={setupHolding ? (data.holdings.find((item) => item.id === setupHolding.id) ?? setupHolding) : null}
        onClose={() => setSetupHolding(undefined)}
      />

      {/* ── Delete Confirmation Modal ── */}
      <ConfirmModal
        open={Boolean(deletingRecord)}
        onClose={() => setDeletingRecord(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove this dividend?"
        description={
          deletingRecord
            ? `Are you sure you want to remove this ${own(deletingRecord, deletingRecord.netAmount)} dividend for ${deletingRecord.ticker}? If this was deposited to ${deletingRecord.cashAccountName || 'a cash account'}, the cash balance will be reduced.`
            : ''
        }
        confirmText="Remove dividend"
      />
    </>
  )
}
