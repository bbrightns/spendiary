import { useState, useMemo } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { AssetLogo } from '../components/ui/AssetLogo'
import { ConfirmDividendModal } from '../components/forms/ConfirmDividendModal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { thb } from '../lib/format'
import { CheckCircleIcon, CoinsIcon, PlusIcon, TrashIcon } from '../components/icons'
import type { DividendRecord, Holding } from '../lib/types'

const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export function Dividends() {
  const { data, removeDividendRecord } = useData()
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null)
  const [selectedDps, setSelectedDps] = useState<number | undefined>(undefined)

  const [deletingRecord, setDeletingRecord] = useState<DividendRecord | null>(null)
  const [yearFilter, setYearFilter] = useState<string>('all')

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

  const totalNetAllTime = useMemo(() => {
    return records.reduce((sum, r) => sum + r.netAmount, 0)
  }, [records])

  // Holdings that pay dividends
  const dividendHoldings = useMemo(() => {
    return (data.holdings ?? []).filter((h) => h.paysDividend)
  }, [data.holdings])

  // Upcoming dividends for this month
  const upcomingHoldings = useMemo(() => {
    return dividendHoldings.filter((h) => (h.dividendMonths ?? []).includes(currentMonth))
  }, [dividendHoldings, currentMonth])

  // Estimated this month
  const estimatedThisMonth = useMemo(() => {
    return upcomingHoldings.reduce((sum, h) => {
      const units = h.units ?? h.totalUnits ?? 0
      const dps = h.expectedDps ?? 0
      const gross = units * dps
      const net = gross * 0.90 // 10% tax estimate
      return sum + net
    }, 0)
  }, [upcomingHoldings])

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
        eyebrow="Cashflow"
        title="Dividends"
        subtitle="Track passive income, dividend payouts & withholding tax."
        action={
          <Button
            variant="primary"
            size="md"
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" strokeWidth={2.4} />
            Log Dividend
          </Button>
        }
      />

      <div className="space-y-6">
        {/* ── KPI Stat Cards ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="animate-rise">
            <p className="text-[12px] font-medium text-ink-muted">Net Received ({currentYear})</p>
            <p className="mt-1 font-display text-[24px] font-extrabold text-emerald-600 dark:text-emerald-400 tnum">
              {thb(totalNetThisYear)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Gross: {thb(totalGrossThisYear)} · Tax: -{thb(totalTaxThisYear)}
            </p>
          </Card>

          <Card className="animate-rise">
            <p className="text-[12px] font-medium text-ink-muted">All-Time Net Dividends</p>
            <p className="mt-1 font-display text-[24px] font-extrabold text-ink tnum">
              {thb(totalNetAllTime)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Total {records.length} {records.length === 1 ? 'payout' : 'payouts'} recorded
            </p>
          </Card>

          <Card className="animate-rise">
            <p className="text-[12px] font-medium text-ink-muted">Estimated This Month</p>
            <p className="mt-1 font-display text-[24px] font-extrabold text-brand-ink tnum">
              {estimatedThisMonth > 0 ? `~${thb(estimatedThisMonth)}` : '-'}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {upcomingHoldings.length} {upcomingHoldings.length === 1 ? 'asset' : 'assets'} scheduled in {MONTH_NAMES[currentMonth - 1]}
            </p>
          </Card>

          <Card className="animate-rise">
            <p className="text-[12px] font-medium text-ink-muted">Dividend Holdings</p>
            <p className="mt-1 font-display text-[24px] font-extrabold text-ink tnum">
              {dividendHoldings.length}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Holdings configured with dividend policy
            </p>
          </Card>
        </div>

        {/* ── Section 1: Upcoming / Expected Dividends ── */}
        <Card className="animate-rise" padded={false}>
          <div className="flex items-center justify-between p-5 border-b border-line">
            <div>
              <h2 className="font-display text-[16px] font-bold text-ink flex items-center gap-2">
                <span>Upcoming & Expected Dividends</span>
                <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10.5px] font-bold">
                  {MONTH_NAMES[currentMonth - 1]}
                </span>
              </h2>
              <p className="text-[12px] text-ink-muted mt-0.5">
                Assets expected to pay dividend this month based on your holding configurations.
              </p>
            </div>
          </div>

          {upcomingHoldings.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[13px] text-ink-muted">
                No holdings scheduled for dividend payout in {MONTH_NAMES[currentMonth - 1]}.
              </p>
              <p className="text-[11.5px] text-ink-faint mt-1">
                You can set payout months in Holding settings or tap "Log Dividend" to record anytime.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {upcomingHoldings.map((h) => {
                const units = h.units ?? h.totalUnits ?? 0
                const dps = h.expectedDps ?? 0
                const estGross = units * dps
                const estNet = estGross * 0.90

                return (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <AssetLogo name={h.name} assetClass={h.assetClass} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-[14.5px] text-ink">{h.ticker}</span>
                          <span className="text-[12px] text-ink-muted truncate max-w-[200px] sm:max-w-xs">{h.name}</span>
                        </div>
                        <p className="text-[11.5px] text-ink-muted mt-0.5">
                          {units.toLocaleString()} shares · Estimated DPS: {dps > 0 ? `฿${dps}` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {estNet > 0 && (
                        <div className="text-right">
                          <span className="font-display text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tnum">
                            ~{thb(estNet)}
                          </span>
                          <p className="text-[10.5px] text-ink-muted">Est. Net (after 10% tax)</p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(h, dps > 0 ? dps : undefined)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-[12px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                        Confirm Received
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* ── Section 2: Dividend Payout History ── */}
        <Card className="animate-rise" padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-line">
            <div>
              <h2 className="font-display text-[16px] font-bold text-ink">Dividend Payout History</h2>
              <p className="text-[12px] text-ink-muted mt-0.5">
                Past recorded dividends with withholding tax breakdowns.
              </p>
            </div>

            {/* Year filter chips */}
            {availableYears.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setYearFilter('all')}
                  className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-all cursor-pointer ${
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
                    className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-all cursor-pointer ${
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
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<CoinsIcon className="h-8 w-8 text-ink-muted" />}
                title="No dividend payouts recorded yet"
                description="When you confirm receiving dividends, payouts will appear here with full tax details."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenAddModal()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    <PlusIcon className="h-3.5 w-3.5 mr-1" />
                    Log First Dividend
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-surface-muted/50 border-b border-line text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Asset</th>
                    <th className="px-5 py-3 text-right">DPS</th>
                    <th className="px-5 py-3 text-right">Shares</th>
                    <th className="px-5 py-3 text-right">Gross</th>
                    <th className="px-5 py-3 text-right">Tax (10%)</th>
                    <th className="px-5 py-3 text-right">Net Received</th>
                    <th className="px-5 py-3">Account</th>
                    <th className="px-4 py-3 text-right">Action</th>
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
                            <span className="block text-[11px] text-ink-muted truncate max-w-[140px] sm:max-w-none">
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
                      <td className="px-5 py-3.5 text-right font-medium text-rose-500 tnum whitespace-nowrap">
                        {r.taxAmount > 0 ? `-฿${r.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '฿0.00'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-display font-extrabold text-emerald-600 dark:text-emerald-400 tnum whitespace-nowrap">
                        {thb(r.netAmount)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-ink-muted text-[12px]">
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
                          className="rounded-lg p-1 text-ink-muted hover:bg-rose-500/10 hover:text-rose-600 transition-colors cursor-pointer"
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

      {/* ── Delete Confirmation Modal ── */}
      <ConfirmModal
        open={Boolean(deletingRecord)}
        onClose={() => setDeletingRecord(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove Dividend Record"
        description={
          deletingRecord
            ? `Are you sure you want to remove this ฿${deletingRecord.netAmount.toLocaleString()} dividend for ${deletingRecord.ticker}? If this was deposited to ${deletingRecord.cashAccountName || 'a cash account'}, the cash balance will be reduced.`
            : ''
        }
        confirmText="Remove Record"
      />
    </>
  )
}
