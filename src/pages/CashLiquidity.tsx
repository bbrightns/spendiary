import { useState, useMemo, Fragment } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import type { CashAccount, CashAccountCategory, CashPayoutSchedule } from '../lib/types'
import {
  CASH_CATEGORIES,
  calculateMonthlyCashInterest,
  detectBankPreset,
  inferCashCategory,
  netWorth,
  sortCashAccounts,
  totalCash,
} from '../lib/calc'
import { thb } from '../lib/format'
import {
  CoinsIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  TrashIcon,
  WalletIcon,
} from '../components/icons'

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const QUICK_PRESETS = [
  { name: 'Kept', rate: '2.22', category: 'emergency' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'Click', rate: '1.50', category: 'emergency' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'Dime THB', rate: '3.00', maxBalance: 10000, category: 'invest' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'Dime USD', currency: 'USD' as const, category: 'invest' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [] },
  { name: 'TrueMoney', category: 'spending' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [] },
  { name: 'KBank', category: 'spending' as CashAccountCategory, schedule: 'semi_annual' as CashPayoutSchedule, months: [6, 12] },
  { name: 'SCB', category: 'spending' as CashAccountCategory, schedule: 'semi_annual' as CashPayoutSchedule, months: [6, 12] },
  { name: 'ออมทรัพย์ หุ้น (สหกรณ์)', rate: '5.50', category: 'locked' as CashAccountCategory, schedule: 'annual' as CashPayoutSchedule, months: [2] },
  { name: 'กองทุนสำรองเลี้ยงชีพ', category: 'locked' as CashAccountCategory, schedule: 'annual' as CashPayoutSchedule, months: [] },
]

function tempId(): string {
  return `cash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function formatWithCommas(value: string | number): string {
  const s = String(value)
  const clean = s.replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('')
  }
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (parts.length > 1) {
    return `${integerPart}.${parts[1].slice(0, 2)}`
  }
  return integerPart
}

export function CashLiquidity() {
  const { data, setCashAccounts, usdThb } = useData()
  const { showToast } = useToast()

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<CashAccountCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'category' | 'yield' | 'balance'>('balance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modals state
  const [accountToEdit, setAccountToEdit] = useState<CashAccount | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<CashAccount | null>(null)

  const rate = usdThb && usdThb > 0 ? usdThb : 35
  const accounts = data.cashAccounts ?? []

  // Net worth & total cash
  const currentNetWorth = useMemo(() => netWorth(data, usdThb), [data, usdThb])
  const totalCashThb = useMemo(() => totalCash(data, usdThb), [data, usdThb])

  // Multi-currency breakdown
  const thbOnlyTotal = useMemo(() => {
    return accounts.reduce((sum, a) => (a.currency !== 'USD' ? sum + a.balance : sum), 0)
  }, [accounts])

  const usdOnlyTotal = useMemo(() => {
    return accounts.reduce((sum, a) => (a.currency === 'USD' ? sum + a.balance : sum), 0)
  }, [accounts])

  // Category Buckets
  const categoryBreakdown = useMemo(() => {
    const totals: Record<CashAccountCategory, number> = {
      spending: 0,
      emergency: 0,
      invest: 0,
      locked: 0,
    }
    for (const a of accounts) {
      const cat = a.category ?? inferCashCategory(a.name)
      const thbVal = a.currency === 'USD' ? a.balance * rate : a.balance
      totals[cat] = (totals[cat] ?? 0) + thbVal
    }
    return totals
  }, [accounts, rate])

  // Interest Yield Calculations
  const interestSummary = useMemo(() => {
    return calculateMonthlyCashInterest(accounts, usdThb)
  }, [accounts, usdThb])

  const totalAnnualYield = interestSummary.totalAnnual
  const effectiveApy = totalCashThb > 0 ? (totalAnnualYield / totalCashThb) * 100 : 0

  // Emergency Runway Calculation (Monthly fixed outflow from debts + estimated baseline)
  const monthlyDebtOutflow = useMemo(() => {
    return (data.liabilities ?? []).reduce((sum, l) => {
      if (l.balance <= 0) return sum
      return sum + (l.monthlyPayment ?? 0)
    }, 0)
  }, [data.liabilities])

  // Estimated baseline monthly burn (Debts + baseline 15,000 or 1.5x debt)
  const estimatedMonthlyBurn = Math.max(monthlyDebtOutflow, 15000)
  const emergencyAmount = categoryBreakdown.emergency
  const emergencyRunwayMonths = estimatedMonthlyBurn > 0 ? emergencyAmount / estimatedMonthlyBurn : 0

  // Warchest Dry Powder
  const warchestAmount = categoryBreakdown.invest
  const warchestPct = totalCashThb > 0 ? (warchestAmount / totalCashThb) * 100 : 0

  // 12-Month Interest Calendar Projection
  const monthlyInterestProjection = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    return months.map((monthNum) => {
      let monthTotal = 0
      const payingAccounts: { name: string; amount: number }[] = []

      for (const a of accounts) {
        if (!a.interestRate || a.interestRate <= 0 || a.balance <= 0) continue

        const cap = a.maxEligibleBalance && a.maxEligibleBalance > 0 ? Math.min(a.balance, a.maxEligibleBalance) : a.balance
        const eligibleThb = a.currency === 'USD' ? cap * rate : cap
        const annualThb = eligibleThb * (a.interestRate / 100)

        const schedule = a.payoutSchedule ?? (a.payoutMonths && a.payoutMonths.length > 0 ? 'custom' : 'monthly')
        const activeMonths = a.payoutMonths && a.payoutMonths.length > 0
          ? a.payoutMonths
          : schedule === 'semi_annual'
            ? [6, 12]
            : schedule === 'annual'
              ? [2]
              : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

        if (activeMonths.includes(monthNum)) {
          const payoutAmount = annualThb / (activeMonths.length || 1)
          monthTotal += payoutAmount
          payingAccounts.push({ name: a.name, amount: payoutAmount })
        }
      }

      return {
        month: monthNum,
        monthName: THAI_MONTHS_SHORT[monthNum - 1],
        amount: monthTotal,
        accounts: payingAccounts,
      }
    })
  }, [accounts, rate])

  const maxMonthInterest = useMemo(() => {
    return Math.max(...monthlyInterestProjection.map((m) => m.amount), 1)
  }, [monthlyInterestProjection])

  // Filtering and Sorting
  const filteredAccounts = useMemo(() => {
    const list = accounts.filter((a) => {
      const matchesCategory = activeCategoryFilter === 'all' || (a.category ?? inferCashCategory(a.name)) === activeCategoryFilter
      const matchesSearch = searchQuery.trim() === '' || a.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })

    return [...list].sort((a, b) => {
      let comparison = 0
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, 'th')
      } else if (sortField === 'category') {
        const catA = a.category ?? inferCashCategory(a.name)
        const catB = b.category ?? inferCashCategory(b.name)
        comparison = catA.localeCompare(catB)
      } else if (sortField === 'yield') {
        const getEarned = (acc: CashAccount) => {
          if (!acc.interestRate || acc.interestRate <= 0 || acc.balance <= 0) return 0
          const cap = acc.maxEligibleBalance && acc.maxEligibleBalance > 0 ? Math.min(acc.balance, acc.maxEligibleBalance) : acc.balance
          const thbVal = acc.currency === 'USD' ? cap * rate : cap
          return thbVal * (acc.interestRate / 100)
        }
        comparison = getEarned(a) - getEarned(b)
      } else if (sortField === 'balance') {
        const thbA = a.currency === 'USD' ? a.balance * rate : a.balance
        const thbB = b.currency === 'USD' ? b.balance * rate : b.balance
        comparison = thbA - thbB
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [accounts, activeCategoryFilter, searchQuery, sortField, sortOrder, rate])

  const handleSortToggle = (field: 'name' | 'category' | 'yield' | 'balance') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'name' || field === 'category' ? 'asc' : 'desc')
    }
  }

  // Handlers
  const handleAutoSort = () => {
    const sorted = sortCashAccounts(accounts, rate)
    setCashAccounts(sorted)
    showToast('จัดเรียงบัญชีตามสถาบันและยอดเงินเรียบร้อยแล้ว', 'success')
  }

  const handleAddPreset = (p: (typeof QUICK_PRESETS)[0]) => {
    const newAcc: CashAccount = {
      id: tempId(),
      name: p.name,
      balance: 0,
      currency: p.currency ?? 'THB',
      category: p.category,
      interestRate: p.rate ? Number(p.rate) : undefined,
      maxEligibleBalance: p.maxBalance,
      payoutSchedule: p.schedule ?? 'monthly',
      payoutMonths: p.months,
    }
    const updated = sortCashAccounts([...accounts, newAcc], rate)
    setCashAccounts(updated)
    setAccountToEdit(newAcc)
    setIsEditModalOpen(true)
    showToast(`เพิ่มบัญชี ${p.name} เรียบร้อยแล้ว`, 'success')
  }

  const handleOpenAddModal = () => {
    const newAcc: CashAccount = {
      id: tempId(),
      name: '',
      balance: 0,
      currency: 'THB',
      category: 'spending',
      interestRate: undefined,
      maxEligibleBalance: undefined,
      payoutSchedule: 'monthly',
      payoutMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    }
    setAccountToEdit(newAcc)
    setIsEditModalOpen(true)
  }

  const handleSaveModalAccount = (savedAcc: CashAccount) => {
    const exists = accounts.some((a) => a.id === savedAcc.id)
    let updated: CashAccount[]
    if (exists) {
      updated = accounts.map((a) => (a.id === savedAcc.id ? savedAcc : a))
    } else {
      updated = [...accounts, savedAcc]
    }
    const sorted = sortCashAccounts(updated, rate)
    setCashAccounts(sorted)
    setIsEditModalOpen(false)
    setAccountToEdit(null)
    showToast(`บันทึกบัญชี "${savedAcc.name}" เรียบร้อยแล้ว`, 'success')
  }

  const handleDeleteAccount = () => {
    if (!accountToDelete) return
    const updated = accounts.filter((a) => a.id !== accountToDelete.id)
    setCashAccounts(updated)
    setAccountToDelete(null)
    showToast(`ลบบัญชี "${accountToDelete.name}" เรียบร้อยแล้ว`, 'info')
  }

  const handleQuickBalanceChange = (id: string, newBalanceStr: string) => {
    const clean = newBalanceStr.replace(/[^0-9.]/g, '')
    const val = clean === '' ? 0 : Number(clean)
    const updated = accounts.map((a) => (a.id === id ? { ...a, balance: val } : a))
    setCashAccounts(updated)
  }

  const handleToggleCurrency = (id: string) => {
    const updated = accounts.map((a) => {
      if (a.id !== id) return a
      return { ...a, currency: a.currency === 'USD' ? ('THB' as const) : ('USD' as const) }
    })
    setCashAccounts(updated)
  }

  const currentMonthNum = new Date().getMonth() + 1

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title="Cash & Liquidity Hub"
        subtitle="ศูนย์บริหารจัดการพอร์ตเงินสด สภาพคล่องฉุกเฉิน กระสุนรอลงทุน และผลตอบแทนดอกเบี้ยเงินฝาก"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleAutoSort}
              className="gap-1.5 text-[12.5px]"
              title="จัดเรียงบัญชีตามสถาบันการเงินและยอดคงเหลือ"
            >
              <span>⚡ จัดเรียงสถาบัน</span>
            </Button>
            <Button onClick={handleOpenAddModal} className="gap-1.5 text-[12.5px]">
              <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
              <span>เพิ่มบัญชีใหม่</span>
            </Button>
          </div>
        }
      />

      {/* ── Top KPI Grid (4 Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Cash */}
        <Card className="p-4 flex flex-col justify-between border-line/60 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
              Total Liquid Cash
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <WalletIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="font-display text-[24px] sm:text-[26px] font-black text-ink tnum leading-tight truncate">
              {thb(totalCashThb)}
            </div>
            <div className="mt-1 text-[11.5px] text-ink-muted flex items-center justify-between">
              <span>สัดส่วนในพอร์ต</span>
              <span className="font-bold text-ink tnum">
                {currentNetWorth > 0 ? ((totalCashThb / currentNetWorth) * 100).toFixed(1) : 0}% ของ Net Worth
              </span>
            </div>
          </div>
          {usdOnlyTotal > 0 && (
            <div className="mt-2 pt-2 border-t border-line/40 text-[11px] text-ink-muted flex items-center justify-between font-mono">
              <span>THB: {thb(thbOnlyTotal)}</span>
              <span>USD: ${usdOnlyTotal.toLocaleString()}</span>
            </div>
          )}
        </Card>

        {/* Card 2: Annual Yield & APY */}
        <Card className="p-4 flex flex-col justify-between border-line/60 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
              Est. Annual Yield
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CoinsIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="font-display text-[24px] sm:text-[26px] font-black text-emerald-600 dark:text-emerald-400 tnum leading-tight truncate">
              {thb(totalAnnualYield)} <span className="text-xs font-semibold text-ink-muted">/ปี</span>
            </div>
            <div className="mt-1 text-[11.5px] text-ink-muted flex items-center justify-between">
              <span>เฉลี่ยเดือนละ</span>
              <span className="font-bold text-ink tnum">
                {thb(totalAnnualYield / 12)}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-line/40 text-[11px] text-ink-muted flex items-center justify-between">
            <span>Average Effective APY</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {effectiveApy.toFixed(2)}%
            </span>
          </div>
        </Card>

        {/* Card 3: Emergency Runway */}
        <Card className="p-4 flex flex-col justify-between border-line/60 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
              Emergency Runway
            </span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
              emergencyRunwayMonths >= 6
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : emergencyRunwayMonths >= 3
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}>
              <span className="text-sm">🛡️</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="font-display text-[24px] sm:text-[26px] font-black text-ink tnum leading-tight truncate">
              {emergencyRunwayMonths > 36 ? '36+ เดือน' : `${emergencyRunwayMonths.toFixed(1)} เดือน`}
            </div>
            <div className="mt-1 text-[11.5px] text-ink-muted flex items-center justify-between">
              <span>เงินสำรองในตลับ</span>
              <span className="font-bold text-ink tnum">
                {thb(emergencyAmount)}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-line/40 text-[11px] text-ink-muted flex items-center justify-between">
            <span>สถานะความปลอดภัย</span>
            <span className={`font-bold ${
              emergencyRunwayMonths >= 6
                ? 'text-emerald-600 dark:text-emerald-400'
                : emergencyRunwayMonths >= 3
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {emergencyRunwayMonths >= 6 ? '🛡️ แข็งแกร่ง (>6 ด.)' : emergencyRunwayMonths >= 3 ? '⚡ ปานกลาง (3-6 ด.)' : '⚠️ ควรเพิ่มสำรอง'}
            </span>
          </div>
        </Card>

        {/* Card 4: Investment Warchest */}
        <Card className="p-4 flex flex-col justify-between border-line/60 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
              Investment Warchest
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <span className="text-sm">🎯</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="font-display text-[24px] sm:text-[26px] font-black text-ink tnum leading-tight truncate">
              {thb(warchestAmount)}
            </div>
            <div className="mt-1 text-[11.5px] text-ink-muted flex items-center justify-between">
              <span>สัดส่วนกระสุนรอลงทุน</span>
              <span className="font-bold text-ink tnum">
                {warchestPct.toFixed(1)}% ของเงินสด
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-line/40 text-[11px] text-ink-muted flex items-center justify-between">
            <span>สภาพคล่องพร้อมช้อนซื้อ</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {warchestAmount > 0 ? 'พร้อม DCA & ซื้อหุ้น' : 'ไม่มีเงินสดรอซื้อ'}
            </span>
          </div>
        </Card>
      </div>

      {/* ── 4-Tier Liquidity Allocation Section ── */}
      <Card className="p-4 sm:p-5 border-line/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[16px] font-bold text-ink flex items-center gap-2">
              <span>📊 4-Tier Liquidity Allocation</span>
            </h3>
            <p className="text-[12px] text-ink-muted">
              จัดสรรเงินสดออกเป็น 4 ตะกร้าตามวัตถุประสงค์การใช้งานและสภาพคล่อง
            </p>
          </div>
          <span className="text-[11.5px] font-semibold text-ink-muted">
            รวมเงินสด {thb(totalCashThb)}
          </span>
        </div>

        {/* Multi-tier Progress Bar */}
        <div className="h-3.5 w-full rounded-full bg-surface-muted overflow-hidden flex shadow-inner">
          {(['spending', 'emergency', 'invest', 'locked'] as CashAccountCategory[]).map((catKey) => {
            const amount = categoryBreakdown[catKey]
            const pct = totalCashThb > 0 ? (amount / totalCashThb) * 100 : 0
            if (pct <= 0) return null

            const colors: Record<CashAccountCategory, string> = {
              spending: 'bg-emerald-500',
              emergency: 'bg-blue-500',
              invest: 'bg-violet-500',
              locked: 'bg-amber-500',
            }

            return (
              <div
                key={catKey}
                style={{ width: `${pct}%` }}
                className={`${colors[catKey]} transition-all duration-300 hover:brightness-110 cursor-pointer`}
                title={`${CASH_CATEGORIES[catKey].labelTh}: ${thb(amount)} (${pct.toFixed(1)}%)`}
              />
            )
          })}
        </div>

        {/* 4 Category Badges / Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(['spending', 'emergency', 'invest', 'locked'] as CashAccountCategory[]).map((catKey) => {
            const meta = CASH_CATEGORIES[catKey]
            const amount = categoryBreakdown[catKey]
            const pct = totalCashThb > 0 ? (amount / totalCashThb) * 100 : 0
            const isSelected = activeCategoryFilter === catKey

            const badgeBorderColors: Record<CashAccountCategory, string> = {
              spending: 'border-emerald-500/30 hover:border-emerald-500/60',
              emergency: 'border-blue-500/30 hover:border-blue-500/60',
              invest: 'border-violet-500/30 hover:border-violet-500/60',
              locked: 'border-amber-500/30 hover:border-amber-500/60',
            }

            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setActiveCategoryFilter(isSelected ? 'all' : catKey)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${badgeBorderColors[catKey]} ${
                  isSelected ? 'ring-2 ring-brand bg-brand-soft/20' : 'bg-surface-muted/40 hover:bg-surface-muted/80'
                }`}
              >
                <div className="flex items-center justify-between text-[11.5px] font-medium text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <span>{meta.icon}</span>
                    <span className="truncate">{meta.labelTh}</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-ink">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="font-display font-extrabold text-[15px] sm:text-[16px] text-ink tnum mt-1.5">
                  {thb(amount)}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* ── 12-Month Interest Cashflow Calendar ── */}
      <Card className="p-4 sm:p-5 border-line/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[16px] font-bold text-ink flex items-center gap-2">
              <span>📅 Cash Interest Calendar (ปฏิทินดอกเบี้ยรับรายเดือน)</span>
            </h3>
            <p className="text-[12px] text-ink-muted">
              ประเมินรอบกระแสเงินสดดอกเบี้ยเงินฝากที่จะได้รับเข้าบัญชีในแต่ละเดือนตลอดทั้งปี
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-ink-muted">ดอกเบี้ยรวมคาดการณ์:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {thb(totalAnnualYield)} / ปี
            </span>
          </div>
        </div>

        {/* 12-Month Bar Chart */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 sm:gap-2 pt-2">
          {monthlyInterestProjection.map((item) => {
            const heightPct = (item.amount / maxMonthInterest) * 100
            const isCurrentMonth = item.month === currentMonthNum
            const isSelected = selectedMonth === item.month

            return (
              <div
                key={item.month}
                onClick={() => setSelectedMonth(isSelected ? null : item.month)}
                className={`flex flex-col items-center justify-end p-2 rounded-xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'border-brand bg-brand-soft/30 ring-2 ring-brand/40'
                    : isCurrentMonth
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-line/40 bg-surface-muted/30 hover:bg-surface-muted/80'
                }`}
                title={`เดือน ${item.monthName}: ดอกเบี้ยรับคาดการณ์ ${thb(item.amount)}`}
              >
                <div className="w-full flex items-end justify-center h-24 mb-2">
                  <div
                    style={{ height: `${Math.max(heightPct, 6)}%` }}
                    className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                      item.amount > 0
                        ? isCurrentMonth
                          ? 'bg-emerald-500'
                          : 'bg-emerald-500/70 hover:bg-emerald-500'
                        : 'bg-surface-muted'
                    }`}
                  />
                </div>
                <span className="font-display text-[10.5px] font-bold text-ink tnum truncate">
                  {item.amount > 0 ? thb(item.amount) : '-'}
                </span>
                <span className={`text-[11px] font-semibold mt-0.5 ${isCurrentMonth ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-ink-muted'}`}>
                  {item.monthName}
                </span>
              </div>
            )
          })}
        </div>

        {/* Selected Month Detail Breakdown */}
        {selectedMonth !== null && (
          <div className="p-3 rounded-xl bg-surface-muted/50 border border-line/50 text-[12px] space-y-2">
            <div className="flex items-center justify-between font-bold text-ink">
              <span>
                รายละเอียดดอกเบี้ยรับเดือน {THAI_MONTHS_SHORT[selectedMonth - 1]}:
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                {thb(monthlyInterestProjection[selectedMonth - 1]?.amount ?? 0)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(monthlyInterestProjection[selectedMonth - 1]?.accounts ?? []).map((acc, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line/60">
                  <span className="text-ink font-medium">{acc.name}:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    +{thb(acc.amount)}
                  </span>
                </div>
              ))}
              {(monthlyInterestProjection[selectedMonth - 1]?.accounts ?? []).length === 0 && (
                <span className="text-ink-muted italic">ไม่มีรอบจ่ายดอกเบี้ยในเดือนนี้</span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Quick Bank Presets Bar ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
            <SparkleIcon className="h-3.5 w-3.5 text-amber-500" />
            Quick Presets (คลิกเพื่อเพิ่มบัญชีธนาคารยอดนิยม)
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PRESETS.map((p) => {
            const presetInfo = detectBankPreset(p.name)
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handleAddPreset(p)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold border transition-all hover:scale-105 cursor-pointer shadow-2xs"
                style={{
                  backgroundColor: presetInfo?.bg ?? 'var(--color-surface-muted)',
                  borderColor: 'var(--color-line)',
                  color: presetInfo?.color ?? 'var(--color-ink)',
                }}
                title={`เพิ่ม ${p.name} (${p.category})`}
              >
                <PlusIcon className="h-3 w-3" strokeWidth={2.5} />
                <span>{p.name}</span>
                {p.rate && <span className="opacity-80 text-[10px]">({p.rate}%)</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Cash Accounts Matrix & Filter Controls ── */}
      <Card className="p-4 sm:p-5 border-line/60 space-y-4">
        {/* Controls: Search & Category Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line/40">
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
                activeCategoryFilter === 'all'
                  ? 'bg-ink text-surface shadow-xs'
                  : 'bg-surface-muted text-ink-muted hover:text-ink'
              }`}
            >
              All ({accounts.length})
            </button>
            {(['spending', 'emergency', 'invest', 'locked'] as CashAccountCategory[]).map((catKey) => {
              const meta = CASH_CATEGORIES[catKey]
              const count = accounts.filter((a) => (a.category ?? inferCashCategory(a.name)) === catKey).length
              const isSelected = activeCategoryFilter === catKey
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setActiveCategoryFilter(catKey)}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand text-white shadow-xs font-semibold'
                      : 'bg-surface-muted text-ink-muted hover:text-ink'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.labelTh}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
            <input
              type="text"
              placeholder="ค้นหาชื่อบัญชี / สถาบัน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-line bg-surface-muted/40 pl-8 pr-3 text-[12.5px] font-medium text-ink outline-none placeholder:text-ink-muted/50 focus:border-brand focus:bg-surface"
            />
          </div>
        </div>

        {/* Semi-Table / Responsive Modern Table */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-line/60 text-[11px] font-bold uppercase tracking-wider text-ink-muted select-none">
                {/* Column 1: บัญชี / สถาบัน */}
                <th
                  onClick={() => handleSortToggle('name')}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>บัญชี / สถาบัน</span>
                    <span className={`text-[10px] ${sortField === 'name' ? 'text-brand font-black' : 'opacity-30'}`}>
                      {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>

                {/* Column 2: หมวดหมู่ */}
                <th
                  onClick={() => handleSortToggle('category')}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>หมวดหมู่</span>
                    <span className={`text-[10px] ${sortField === 'category' ? 'text-brand font-black' : 'opacity-30'}`}>
                      {sortField === 'category' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>

                {/* Column 3: ดอกเบี้ย / ผลตอบแทน */}
                <th
                  onClick={() => handleSortToggle('yield')}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ดอกเบี้ย & ผลตอบแทน</span>
                    <span className={`text-[10px] ${sortField === 'yield' ? 'text-brand font-black' : 'opacity-30'}`}>
                      {sortField === 'yield' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>

                {/* Column 4: ยอดคงเหลือ (Right aligned) */}
                <th
                  onClick={() => handleSortToggle('balance')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>ยอดคงเหลือ</span>
                    <span className={`text-[10px] ${sortField === 'balance' ? 'text-brand font-black' : 'opacity-30'}`}>
                      {sortField === 'balance' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>

                {/* Column 5: จัดการ (Actions) */}
                <th className="py-2.5 px-3 text-right w-24">
                  <span>จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/30 text-[13px]">
              {filteredAccounts.map((a) => {
                const preset = detectBankPreset(a.name)
                const cat = a.category ?? inferCashCategory(a.name)
                const isExpanded = expandedId === a.id

                const rateNum = a.interestRate ?? 0
                const capNum = a.maxEligibleBalance
                const eligibleBal = capNum && capNum > 0 ? Math.min(a.balance, capNum) : a.balance
                const eligibleThb = a.currency === 'USD' ? eligibleBal * rate : eligibleBal
                const annualEarned = rateNum > 0 && eligibleThb > 0 ? eligibleThb * (rateNum / 100) : 0

                return (
                  <Fragment key={a.id}>
                    <tr
                      className={`group transition-colors ${
                        isExpanded ? 'bg-surface-muted/60' : 'hover:bg-surface-muted/40'
                      }`}
                    >
                      {/* 1. บัญชี / สถาบัน */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {preset ? (
                            <div
                              className="h-8 w-8 rounded-lg text-[11px] font-black shrink-0 flex items-center justify-center select-none shadow-xs"
                              style={{ background: preset.bg, color: preset.color, border: `1px solid ${preset.color}35` }}
                              title={`สถาบัน: ${preset.name}`}
                            >
                              {preset.shortName}
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-surface-muted border border-line/50 text-ink-muted text-[11px] font-bold shrink-0 flex items-center justify-center">
                              <WalletIcon className="h-4 w-4 opacity-60" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-display font-bold text-[13.5px] text-ink block truncate group-hover:text-brand transition-colors">
                              {a.name || 'Untitled Account'}
                            </span>
                            {a.currency === 'USD' && a.balance > 0 && (
                              <span className="text-[10.5px] font-mono text-ink-muted block">
                                ≈ {thb(a.balance * rate)} (@{rate.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. หมวดหมู่ */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium bg-surface-muted border border-line/50">
                          <span>{CASH_CATEGORIES[cat]?.icon}</span>
                          <span>{CASH_CATEGORIES[cat]?.labelTh}</span>
                        </span>
                      </td>

                      {/* 3. ดอกเบี้ย & ผลตอบแทน */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {rateNum > 0 ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-[12px]">
                              <span>📈 {rateNum.toFixed(2)}%</span>
                              {capNum && capNum > 0 && (
                                <span className="text-[10px] opacity-75 font-normal">
                                  (สูงสุด {thb(capNum)})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-muted font-mono">
                              ≈ {thb(annualEarned)}/ปี{' '}
                              <span className="opacity-70 font-sans">
                                ({a.payoutSchedule === 'monthly' ? 'จ่ายทุกเดือน' : a.payoutSchedule === 'semi_annual' ? 'ปีละ 2 ครั้ง' : 'ปีละ 1 ครั้ง'})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-muted/50 text-[11.5px]">-</span>
                        )}
                      </td>

                      {/* 4. ยอดคงเหลือ (In-place compact input) */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end">
                          <div className="relative w-36 sm:w-40">
                            <button
                              type="button"
                              onClick={() => handleToggleCurrency(a.id)}
                              className={`absolute left-1 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                                a.currency === 'USD'
                                  ? 'bg-sky-500/15 text-sky-500 hover:bg-sky-500/25 ring-1 ring-sky-500/30'
                                  : 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30'
                              }`}
                              title="คลิกเพื่อสลับสกุลเงิน (THB / USD)"
                            >
                              {a.currency === 'USD' ? '$' : '฿'}
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="h-8 w-full rounded-lg border border-line bg-surface-muted/40 pl-8 pr-2 text-[13.5px] font-bold tnum text-ink outline-none transition-colors focus:border-brand focus:bg-surface text-right"
                              value={a.balance === 0 ? '' : formatWithCommas(a.balance)}
                              placeholder="0.00"
                              onChange={(e) => handleQuickBalanceChange(a.id, e.target.value)}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 5. จัดการ (Actions: ดินสอ / ถังขยะ / Expand) */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAccountToEdit(a)
                              setIsEditModalOpen(true)
                            }}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink transition-colors cursor-pointer"
                            title="แก้ไขข้อมูลบัญชี"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccountToDelete(a)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-loss-soft hover:text-loss transition-colors cursor-pointer"
                            title="ลบบัญชีนี้"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : a.id)}
                            className={`grid h-8 w-7 place-items-center rounded-lg transition-colors cursor-pointer ${
                              isExpanded ? 'bg-brand/10 text-brand' : 'text-ink-muted hover:bg-surface hover:text-ink'
                            }`}
                            title={isExpanded ? 'ย่อแถว' : 'ดูรายละเอียดเพิ่มเติม'}
                          >
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-brand' : 'text-ink-muted'}`}
                            >
                              <path d="M4 6l4 4 4-4" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable details row */}
                    {isExpanded && (
                      <tr className="bg-surface-muted/25 border-b border-line/40">
                        <td colSpan={5} className="py-2.5 px-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11.5px]">
                            <div className="p-2 rounded-lg bg-surface border border-line/40">
                              <span className="text-ink-muted block text-[10.5px]">วัตถุประสงค์:</span>
                              <span className="font-bold text-ink flex items-center gap-1 mt-0.5">
                                <span>{CASH_CATEGORIES[cat]?.icon}</span>
                                <span>{CASH_CATEGORIES[cat]?.labelTh}</span>
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-line/40">
                              <span className="text-ink-muted block text-[10.5px]">รอบการจ่ายดอกเบี้ย:</span>
                              <span className="font-bold text-ink mt-0.5 block">
                                {a.payoutSchedule === 'monthly'
                                  ? 'ทุกเดือน (12 ครั้ง/ปี)'
                                  : a.payoutSchedule === 'semi_annual'
                                  ? 'ปีละ 2 ครั้ง (มิ.ย. & ธ.ค.)'
                                  : a.payoutSchedule === 'annual'
                                  ? 'ปีละ 1 ครั้ง'
                                  : 'กำหนดเดือนเอง'}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-line/40">
                              <span className="text-ink-muted block text-[10.5px]">ประมาณการดอกเบี้ย:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                                {thb(annualEarned)} / ปี
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {filteredAccounts.length === 0 && (
            <div className="text-center py-12 text-ink-muted space-y-2">
              <p className="text-[14px] font-medium">ไม่พบบัญชีเงินสดที่ตรงกับเงื่อนไข</p>
              <Button onClick={handleOpenAddModal} variant="secondary" className="text-xs">
                + เพิ่มบัญชีใหม่
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ── Edit / Add Account Modal ── */}
      {isEditModalOpen && accountToEdit && (
        <EditAccountModal
          open={isEditModalOpen}
          initialAccount={accountToEdit}
          onClose={() => {
            setIsEditModalOpen(false)
            setAccountToEdit(null)
          }}
          onSave={handleSaveModalAccount}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {accountToDelete && (
        <ConfirmModal
          open={Boolean(accountToDelete)}
          title="ยืนยันการลบบัญชี"
          description={`คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี "${accountToDelete.name}"? ยอดเงินสดในพอร์ตจะถูกปรับลดลงทันที`}
          confirmText="ลบบัญชี"
          confirmVariant="danger"
          onConfirm={handleDeleteAccount}
          onClose={() => setAccountToDelete(null)}
        />
      )}
    </div>
  )
}

// ── Edit / Add Account Modal Component ──
interface EditAccountModalProps {
  open: boolean
  initialAccount: CashAccount
  onClose: () => void
  onSave: (acc: CashAccount) => void
}

function EditAccountModal({ open, initialAccount, onClose, onSave }: EditAccountModalProps) {
  const [name, setName] = useState(initialAccount.name)
  const [balance, setBalance] = useState(initialAccount.balance ? String(initialAccount.balance) : '')
  const [currency, setCurrency] = useState<'THB' | 'USD'>(initialAccount.currency ?? 'THB')
  const [category, setCategory] = useState<CashAccountCategory>(initialAccount.category ?? 'spending')
  const [interestRate, setInterestRate] = useState(initialAccount.interestRate ? String(initialAccount.interestRate) : '')
  const [maxEligibleBalance, setMaxEligibleBalance] = useState(
    initialAccount.maxEligibleBalance ? String(initialAccount.maxEligibleBalance) : ''
  )
  const [payoutSchedule, setPayoutSchedule] = useState<CashPayoutSchedule>(initialAccount.payoutSchedule ?? 'monthly')
  const [payoutMonths, setPayoutMonths] = useState<number[]>(
    initialAccount.payoutMonths && initialAccount.payoutMonths.length > 0
      ? initialAccount.payoutMonths
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const cleanBal = balance.replace(/[^0-9.]/g, '')
    const balNum = cleanBal === '' ? 0 : Number(cleanBal)
    const rateClean = interestRate.replace(/[^0-9.]/g, '')
    const rateNum = rateClean !== '' ? Number(rateClean) : undefined
    const capClean = maxEligibleBalance.replace(/[^0-9.]/g, '')
    const capNum = capClean !== '' ? Number(capClean) : undefined

    onSave({
      id: initialAccount.id,
      name: name.trim(),
      balance: balNum,
      currency,
      category,
      interestRate: rateNum && rateNum > 0 ? rateNum : undefined,
      maxEligibleBalance: capNum && capNum > 0 ? capNum : undefined,
      payoutSchedule,
      payoutMonths: payoutMonths && payoutMonths.length > 0 ? payoutMonths : undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialAccount.name ? 'แก้ไขข้อมูลบัญชีเงินสด' : 'เพิ่มบัญชีเงินสดใหม่'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Name */}
        <div>
          <label className="block text-[12px] font-bold text-ink mb-1">
            ชื่อบัญชี / สถาบันการเงิน <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="เช่น Kept, Dime, KBank, สหกรณ์ออมทรัพย์"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (category === 'spending') {
                setCategory(inferCashCategory(e.target.value))
              }
            }}
            className="h-10 w-full rounded-xl border border-line bg-surface-muted/40 px-3 text-[14px] font-medium text-ink outline-none focus:border-brand focus:bg-surface"
          />
        </div>

        {/* Balance & Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-bold text-ink mb-1">
              ยอดเงินคงเหลือ
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={formatWithCommas(balance)}
              onChange={(e) => setBalance(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface-muted/40 px-3 text-[14px] font-bold tnum text-ink outline-none focus:border-brand focus:bg-surface"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-ink mb-1">
              สกุลเงิน
            </label>
            <div className="grid grid-cols-2 gap-1.5 h-10">
              <button
                type="button"
                onClick={() => setCurrency('THB')}
                className={`rounded-xl font-bold text-xs transition-colors cursor-pointer border ${
                  currency === 'THB'
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-surface text-ink-muted border-line'
                }`}
              >
                THB (฿)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`rounded-xl font-bold text-xs transition-colors cursor-pointer border ${
                  currency === 'USD'
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-surface text-ink-muted border-line'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-[12px] font-bold text-ink mb-1.5">
            หมวดหมู่ / วัตถุประสงค์ (Liquidity Tier)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['spending', 'emergency', 'invest', 'locked'] as CashAccountCategory[]).map((catKey) => {
              const meta = CASH_CATEGORIES[catKey]
              const isCatActive = category === catKey
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setCategory(catKey)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all text-left cursor-pointer border ${
                    isCatActive
                      ? 'bg-brand text-white border-brand shadow-xs font-semibold'
                      : 'bg-surface text-ink-muted border-line/60 hover:text-ink hover:border-line'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span className="truncate">{meta.labelTh}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Yield Booster (Interest Rate + Cap) */}
        <div className="p-3 rounded-xl bg-surface-muted/40 border border-line/60 space-y-3">
          <span className="text-[12px] font-bold text-ink block">
            Yield Booster (ผลตอบแทนดอกเบี้ย)
          </span>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                อัตราดอกเบี้ยต่อปี (%)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="เช่น 1.50, 2.22, 5.50"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] font-bold tnum text-ink outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1" title="คิดดอกเบี้ยไม่เกินวงเงินนี้">
                เพดานเงินต้นสูงสุด
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="ไม่จำกัด"
                value={formatWithCommas(maxEligibleBalance)}
                onChange={(e) => setMaxEligibleBalance(e.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] font-bold tnum text-ink outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Payout Schedule */}
          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1.5">
              รอบดอกเบี้ยเข้าบัญชี
            </label>
            <div className="grid grid-cols-4 gap-1.5 text-[11.5px]">
              {[
                { key: 'monthly', label: 'ทุกเดือน' },
                { key: 'semi_annual', label: 'ปีละ 2 ครั้ง' },
                { key: 'annual', label: 'ปีละ 1 ครั้ง' },
                { key: 'custom', label: 'กำหนดเอง' },
              ].map((sch) => (
                <button
                  key={sch.key}
                  type="button"
                  onClick={() => {
                    setPayoutSchedule(sch.key as CashPayoutSchedule)
                    if (sch.key === 'monthly') setPayoutMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
                    if (sch.key === 'semi_annual') setPayoutMonths([6, 12])
                    if (sch.key === 'annual') setPayoutMonths([2])
                  }}
                  className={`py-1.5 rounded-lg border text-center font-semibold transition-all cursor-pointer ${
                    payoutSchedule === sch.key
                      ? 'bg-ink text-surface border-ink'
                      : 'bg-surface text-ink-muted border-line/60'
                  }`}
                >
                  {sch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Months Picker */}
          {payoutSchedule === 'custom' && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-ink-muted block">แตะเลือกเดือนที่ดอกเบี้ยเข้า:</span>
              <div className="grid grid-cols-6 gap-1 text-[11px]">
                {THAI_MONTHS_SHORT.map((mName, idx) => {
                  const mNum = idx + 1
                  const isSelected = payoutMonths.includes(mNum)
                  return (
                    <button
                      key={mNum}
                      type="button"
                      onClick={() => {
                        const next = isSelected
                          ? payoutMonths.filter((m) => m !== mNum)
                          : [...payoutMonths, mNum].sort((a, b) => a - b)
                        setPayoutMonths(next)
                      }}
                      className={`py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-2xs'
                          : 'bg-surface text-ink-muted border-line'
                      }`}
                    >
                      {mName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-line/50">
          <Button type="button" variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit">
            บันทึกบัญชี
          </Button>
        </div>
      </form>
    </Modal>
  )
}
