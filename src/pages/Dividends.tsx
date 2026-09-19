import { useState, useMemo } from 'react'
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
import { CheckCircleIcon, ChevronDownIcon, CoinsIcon, PlusIcon, TrashIcon } from '../components/icons'
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
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null)

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
        eyebrow="กระแสเงินสด"
        title="เงินปันผล"
        subtitle="บันทึกเงินปันผลที่ได้รับ คาดการณ์รายรับต่อปี และภาษีหัก ณ ที่จ่าย"
        action={
          <Button
            variant="primary"
            size="md"
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" strokeWidth={2.4} />
            + บันทึกรับปันผล
          </Button>
        }
      />

      <div className="space-y-4 sm:space-y-6">
        {/* ── KPI Stat Cards ── */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          {/* Card 1: เงินปันผลที่คาดว่าจะได้ต่อปี & อัตราผลตอบแทน (% ต่อปี) */}
          <Card className="p-3.5 sm:p-5 animate-rise flex flex-col justify-between col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-500/5 via-surface to-surface border-emerald-500/20" padded={false}>
            <div>
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] sm:text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                  คาดว่าจะได้ปีนี้ (ทั้งปี)
                </p>
                {annualDividendYieldPct > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] sm:text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                    ~{annualDividendYieldPct.toFixed(1)}% ต่อปี
                  </span>
                )}
              </div>
              <p className="mt-1 font-display text-[20px] sm:text-[24px] font-extrabold text-emerald-600 dark:text-emerald-400 tnum truncate">
                ~{thb(totalAnnualDividendNet)}
              </p>
            </div>
            <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11.5px] text-ink-muted truncate">
              {annualDividendYieldPct > 0
                ? `คิดเป็นประมาณ ${annualDividendYieldPct.toFixed(1)}% ต่อปี (เทียบเท่าดอกเบี้ยเงินฝาก)`
                : 'ตั้งค่าเงินปันผลในหุ้นเพื่อคำนวณ'}
            </p>
          </Card>

          {/* Card 2: รับเข้าบัญชีแล้วปีนี้ */}
          <Card className="p-3.5 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
            <div>
              <p className="text-[11px] sm:text-[12px] font-medium text-ink-muted">รับเข้าบัญชีแล้ว ({currentYear})</p>
              <p className="mt-1 font-display text-[18px] sm:text-[24px] font-extrabold text-ink tnum truncate">
                {thb(totalNetThisYear)}
              </p>
            </div>
            <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] text-ink-muted truncate">
              ก่อนหักภาษี {thb(totalGrossThisYear)} · ภาษี -{thb(totalTaxThisYear)}
            </p>
          </Card>

          {/* Card 3: คาดการณ์เดือนนี้ */}
          <Card className="p-3.5 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
            <div>
              <p className="text-[11px] sm:text-[12px] font-medium text-ink-muted">รอรับเดือนนี้ ({MONTH_NAMES[currentMonth - 1]})</p>
              <p className="mt-1 font-display text-[18px] sm:text-[24px] font-extrabold text-brand-ink tnum truncate">
                {estimatedThisMonth > 0 ? `~${thb(estimatedThisMonth)}` : '-'}
              </p>
            </div>
            <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] text-ink-muted truncate">
              {upcomingHoldings.length > 0 ? `${upcomingHoldings.length} รายการที่รอรับ` : 'ไม่มีรายการในเดือนนี้'}
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
              <span className="text-[18px] shrink-0">📅</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-[14.5px] sm:text-[16px] font-bold text-ink truncate">
                    เงินปันผลที่รอรับเดือนนี้
                  </h2>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10.5px] font-bold">
                    {MONTH_NAMES[currentMonth - 1]}
                  </span>
                  {upcomingHoldings.length > 0 && (
                    <span className="rounded-full bg-surface-muted border border-line text-ink-muted px-2 py-0.5 text-[10.5px] font-bold">
                      {upcomingHoldings.length} รายการ
                    </span>
                  )}
                </div>
                {!upcomingOpen ? (
                  <p className="text-[11.5px] text-ink-muted mt-0.5 truncate">
                    {upcomingHoldings.length === 0
                      ? `ไม่มีรายการปันผลในเดือน${MONTH_NAMES[currentMonth - 1]} (แตะเพื่อดูรายละเอียด)`
                      : `คาดว่าจะได้รับ ~${thb(estimatedThisMonth)} · แตะเพื่อดูและกดยืนยันรับเงิน`}
                  </p>
                ) : (
                  <p className="text-[11.5px] text-ink-muted mt-0.5 hidden sm:block">
                    รายการหุ้นหรือสินทรัพย์ที่มีรอบจ่ายเงินปันผลในเดือนนี้
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[11px] font-medium text-ink-muted hidden sm:inline">
                {upcomingOpen ? 'ย่อลง' : 'ขยายดู'}
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
                  <p className="text-[13px] text-ink-muted">
                    ไม่มีรายการปันผลในเดือน{MONTH_NAMES[currentMonth - 1]}
                  </p>
                  <p className="text-[11.5px] text-ink-faint mt-1">
                    คุณสามารถตั้งรอบเดือนที่จ่ายปันผลในรายละเอียดของหุ้น หรือกดปุ่ม "+ บันทึกรับปันผล" ได้ตลอดเวลา
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
                        {/* Mobile Layout (2 Rows) & Desktop Layout (1 Row) */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
                          
                          {/* Top Row on Mobile: Logo + Name/Ticker + Estimated Net Amount */}
                          <div className="flex items-center justify-between gap-3 min-w-0">
                            <div
                              onClick={() => setEditingHolding(h)}
                              title="แตะเพื่อดูรายละเอียดและแก้ไขการปันผล"
                              className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer group/item flex-1"
                            >
                              <AssetLogo name={h.name} assetClass={h.assetClass} size="md" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-display font-bold text-[15px] text-ink group-hover/item:text-brand transition-colors">
                                    {h.ticker}
                                  </span>
                                  <span className="text-[12px] text-ink-muted truncate max-w-[120px] sm:max-w-xs">
                                    {h.name}
                                  </span>
                                  {assetYieldPct > 0 && (
                                    <span className="inline-flex items-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10.5px] font-bold">
                                      ~{assetYieldPct.toFixed(1)}%/ปี
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Estimated Amount (Visible on mobile top-right and desktop) */}
                            {estNet > 0 && (
                              <div className="text-right shrink-0">
                                <span className="font-display text-[15px] sm:text-[16px] font-extrabold text-emerald-600 dark:text-emerald-400 tnum">
                                  ~{thb(estNet)}
                                </span>
                                <p className="text-[9.5px] sm:text-[10.5px] text-ink-muted">ได้สุทธิประมาณ</p>
                              </div>
                            )}
                          </div>

                          {/* Bottom Row on Mobile / Inline details on Desktop */}
                          <div className="flex items-center justify-between gap-2 pt-1.5 sm:pt-0 border-t border-line/40 sm:border-0">
                            <div className="text-[11.5px] text-ink-muted flex items-center gap-1.5 flex-wrap min-w-0">
                              <span>{units.toLocaleString()} หุ้น</span>
                              <span>·</span>
                              <span>ปันผล: <strong className="text-ink font-semibold">{dps > 0 ? `${sym}${dps}` : 'N/A'}</strong></span>
                              <button
                                type="button"
                                onClick={() => setEditingHolding(h)}
                                className="text-[10.5px] font-semibold text-brand hover:underline cursor-pointer bg-brand/10 px-1.5 py-0.5 rounded transition-all"
                              >
                                แก้ไขปันผล ↗
                              </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="shrink-0">
                              {isReceived ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-gain-soft px-2.5 py-1 text-[11.5px] font-bold text-gain">
                                    <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.4} /> ได้รับแล้ว
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddModal(h, dps > 0 ? dps : undefined)}
                                    className="inline-flex items-center rounded-full border border-line bg-surface hover:bg-surface-muted text-ink-muted hover:text-ink px-2.5 py-1 text-[11px] font-medium active:scale-95 transition-all cursor-pointer"
                                  >
                                    + บันทึกเพิ่ม
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddModal(h, dps > 0 ? dps : undefined)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-3.5 py-1.5 text-[11.5px] sm:text-[12px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                                >
                                  <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                                  ยืนยันรับเงิน
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
              <h2 className="font-display text-[16px] font-bold text-ink">ประวัติการรับเงินปันผล</h2>
              <p className="text-[12px] text-ink-muted mt-0.5">
                รายการเงินปันผลที่บันทึกไว้ พร้อมรายละเอียดภาษีหัก ณ ที่จ่าย
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
                  ทั้งหมด
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
                title="ยังไม่มีประวัติการรับเงินปันผล"
                description="เมื่อกดยืนยันการรับเงินปันผล ประวัติและรายละเอียดภาษีจะปรากฏที่นี่"
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenAddModal()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    <PlusIcon className="h-3.5 w-3.5 mr-1" />
                    บันทึกรายการแรก
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-surface-muted/50 border-b border-line text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-5 py-3">วันที่รับ</th>
                    <th className="px-5 py-3">หุ้น / สินทรัพย์</th>
                    <th className="px-5 py-3 text-right">ปันผล/หุ้น</th>
                    <th className="px-5 py-3 text-right">จำนวนหุ้น</th>
                    <th className="px-5 py-3 text-right">ยอดก่อนหักภาษี</th>
                    <th className="px-5 py-3 text-right">ภาษี (10%)</th>
                    <th className="px-5 py-3 text-right">ยอดสุทธิที่ได้รับ</th>
                    <th className="px-5 py-3">เข้าบัญชี</th>
                    <th className="px-4 py-3 text-right">จัดการ</th>
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

      {/* ── Edit Holding Modal (View & Edit Dividend Details) ── */}
      <HoldingForm
        open={Boolean(editingHolding)}
        editing={editingHolding ? (data.holdings.find((item) => item.id === editingHolding.id) ?? editingHolding) : null}
        onClose={() => setEditingHolding(null)}
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
