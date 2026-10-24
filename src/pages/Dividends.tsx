import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { AssetLogo } from '../components/ui/AssetLogo'
import { ConfirmDividendModal } from '../components/forms/ConfirmDividendModal'
import { HoldingForm } from '../components/forms/HoldingForm'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { thb } from '../lib/format'
import { getHoldingAnnualDividend, getHoldingDpsForMonth, isDividendReceivedThisMonth } from '../lib/calc'
import { CalendarIcon, CheckCircleIcon, ChevronDownIcon, CoinsIcon, PlusIcon, TrashIcon } from '../components/icons'
import type { DividendRecord, Holding } from '../lib/types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function Dividends() {
  const { data, removeDividendRecord } = useData()
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null)
  const [selectedDps, setSelectedDps] = useState<number | undefined>(undefined)
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null)

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

  const records = data.dividendRecords ?? []

  // KPI Calculations
  const thisYearRecords = useMemo(() => {
    return records.filter((r) => {
      const year = parseInt(r.paymentDate.split('-')[0], 10)
      return year === currentYear
    })
  }, [records, currentYear])

  const totalNetThisYear = useMemo(() => {
    return thisYearRecords.reduce((sum, r) => sum + r.netAmount, 0)
  }, [thisYearRecords])

  const totalGrossThisYear = useMemo(() => {
    return thisYearRecords.reduce((sum, r) => sum + r.grossAmount, 0)
  }, [thisYearRecords])

  const totalTaxThisYear = useMemo(() => {
    return thisYearRecords.reduce((sum, r) => sum + r.taxAmount, 0)
  }, [thisYearRecords])

  // Holdings that pay dividends
  const dividendHoldings = useMemo(() => {
    return (data.holdings ?? []).filter((h) => h.paysDividend)
  }, [data.holdings])

  // Estimated annual dividend across all dividend holdings
  const totalAnnualDividendGross = useMemo(() => {
    return dividendHoldings.reduce((sum, h) => sum + getHoldingAnnualDividend(h), 0)
  }, [dividendHoldings])

  const totalAnnualDividendNet = useMemo(() => {
    return totalAnnualDividendGross * 0.90 // estimate after 10% withholding tax
  }, [totalAnnualDividendGross])

  // Total investment basis for dividend-paying holdings
  const totalDividendPortfolioValue = useMemo(() => {
    return dividendHoldings.reduce((sum, h) => {
      const units = h.units ?? h.totalUnits ?? 0
      const value = h.price > 0 ? units * h.price : (h.totalThbInvested ?? (units * (h.avgCostThb ?? h.avgCost ?? 0)))
      return sum + value
    }, 0)
  }, [dividendHoldings])

  // Annual return rate (% ต่อปี)เทียบเหมือนดอกเบี้ยเงินฝาก
  const annualDividendYieldPct = useMemo(() => {
    if (totalDividendPortfolioValue <= 0) return 0
    return (totalAnnualDividendGross / totalDividendPortfolioValue) * 100
  }, [totalAnnualDividendGross, totalDividendPortfolioValue])

  // Upcoming dividends for this month
  const upcomingHoldings = useMemo(() => {
    return dividendHoldings.filter((h) => (h.dividendMonths ?? []).includes(currentMonth))
  }, [dividendHoldings, currentMonth])

  const upcomingOpen = isUpcomingOpen ?? (upcomingHoldings.length > 0)

  // Estimated this month
  const estimatedThisMonth = useMemo(() => {
    return upcomingHoldings.reduce((sum, h) => {
      const units = h.units ?? h.totalUnits ?? 0
      const dps = getHoldingDpsForMonth(h, currentMonth)
      const gross = units * dps
      const net = gross * 0.90 // 10% tax estimate
      return sum + net
    }, 0)
  }, [upcomingHoldings, currentMonth])


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
        eyebrow="Plan"
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
                ~{thb(totalAnnualDividendNet)}
              </p>
            </div>
            <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
              {annualDividendYieldPct > 0
                ? `About ${annualDividendYieldPct.toFixed(1)}% per year, like interest on a deposit`
                : 'Set up dividends on your stocks to see this'}
            </p>
          </Card>

          {/* Card 2: received this year */}
          <Card compact className="animate-rise flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Received ({currentYear})</p>
              <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold text-ink tnum truncate">
                {thb(totalNetThisYear)}
              </p>
            </div>
            <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
              Before tax {thb(totalGrossThisYear)} · tax -{thb(totalTaxThisYear)}
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
        <Card className="animate-rise overflow-hidden" padded={false}>
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
                    You can set the months a stock pays in its details, or tap "+ Record dividend" at any time.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {upcomingHoldings.map((h) => {
                    const units = h.units ?? h.totalUnits ?? 0
                    const dps = getHoldingDpsForMonth(h, currentMonth)
                    const estGross = units * dps
                    const estNet = estGross * 0.90
                    const isReceived = isDividendReceivedThisMonth(h.id, data.dividendRecords)
                    const sym = h.assetClass === 'stock' ? '$' : '฿'

                    // Asset level annual yield (% ต่อปี)
                    const annualGross = getHoldingAnnualDividend(h)
                    const assetVal = h.price > 0 ? units * h.price : (h.totalThbInvested ?? (units * (h.avgCostThb ?? h.avgCost ?? 0)))
                    const assetYieldPct = assetVal > 0 ? (annualGross / assetVal) * 100 : 0

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
                                    onClick={() => setEditingHolding(h)}
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
                                  ~{thb(estNet)}
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
                              <span>Dividend: <strong className="text-ink font-semibold">{dps > 0 ? `${sym}${dps}` : 'N/A'}</strong> / share</span>
                              {annualGross > 0 && (
                                <span className="hidden sm:inline text-ink-muted">
                                  {' '}(~{thb(annualGross)} per year)
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

        {/* ── Section 2: Dividend Payout History ── */}
        <Card className="animate-rise" padded={false}>
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
                        ฿{r.dps.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink-soft tnum whitespace-nowrap">
                        {r.shares.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink tnum whitespace-nowrap">
                        {thb(r.grossAmount)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-loss-ink tnum whitespace-nowrap">
                        {r.taxAmount > 0 ? `-฿${r.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '฿0.00'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-display font-extrabold text-gain-ink tnum whitespace-nowrap">
                        {thb(r.netAmount)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-ink-muted text-xs">
                        {r.cashAccountName ? (
                          <span className="inline-flex items-center rounded-md bg-surface-muted px-2 py-0.5 font-medium text-ink">
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

      {/* ── Edit Holding Modal (View & Edit Dividend Details) ── */}
      <HoldingForm
        open={Boolean(editingHolding)}
        editing={editingHolding ? (data.holdings.find((item) => item.id === editingHolding.id) ?? editingHolding) : null}
        initialSection="dividend"
        onClose={() => setEditingHolding(null)}
      />

      {/* ── Delete Confirmation Modal ── */}
      <ConfirmModal
        open={Boolean(deletingRecord)}
        onClose={() => setDeletingRecord(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove this dividend?"
        description={
          deletingRecord
            ? `Are you sure you want to remove this ฿${deletingRecord.netAmount.toLocaleString()} dividend for ${deletingRecord.ticker}? If this was deposited to ${deletingRecord.cashAccountName || 'a cash account'}, the cash balance will be reduced.`
            : ''
        }
        confirmText="Remove dividend"
      />
    </>
  )
}
