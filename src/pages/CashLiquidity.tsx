import { useState, useMemo, useEffect, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  getCashCategory,
  inferCashCategory,
  netWorth,
  sortCashAccounts,
  totalCash,
} from '../lib/calc'
import { thb } from '../lib/format'
import {
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
  WalletIcon,
} from '../components/icons'

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'category' | 'yield' | 'balance'>('balance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modals state
  const [accountToEdit, setAccountToEdit] = useState<CashAccount | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<CashAccount | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setAccountToEdit(null)
      setIsEditModalOpen(true)
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const rate = usdThb && usdThb > 0 ? usdThb : 35
  const accounts = data.cashAccounts ?? []

  // Net worth & total cash
  const currentNetWorth = useMemo(() => netWorth(data, usdThb), [data, usdThb])
  const totalCashThb = useMemo(() => totalCash(data, usdThb), [data, usdThb])

  // Multi-currency breakdown
  const usdOnlyTotal = useMemo(() => {
    return accounts.reduce((sum, a) => (a.currency === 'USD' ? sum + a.balance : sum), 0)
  }, [accounts])

  // Category Buckets
  const categoryBreakdown = useMemo(() => {
    const totals: Record<CashAccountCategory, number> = {
      spending: 0,
      locked: 0,
    }
    for (const a of accounts) {
      const cat = getCashCategory(a)
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

  const deployableAmount = categoryBreakdown.spending
  const deployablePct = totalCashThb > 0 ? (deployableAmount / totalCashThb) * 100 : 0
  const lockedAmount = categoryBreakdown.locked
  const lockedPct = totalCashThb > 0 ? (lockedAmount / totalCashThb) * 100 : 0

  // Filtering and Sorting
  const filteredAccounts = useMemo(() => {
    const list = accounts.filter((a) => {
      const matchesCategory = activeCategoryFilter === 'all' || getCashCategory(a) === activeCategoryFilter
      const matchesSearch = searchQuery.trim() === '' || a.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })

    return [...list].sort((a, b) => {
      let comparison = 0
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, 'th')
      } else if (sortField === 'category') {
        const catA = getCashCategory(a)
        const catB = getCashCategory(b)
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


  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title="Cash & Liquidity Hub"
        subtitle="ศูนย์บริหารจัดการพอร์ตเงินสด สภาพคล่องฉุกเฉิน กระสุนรอลงทุน และผลตอบแทนดอกเบี้ยเงินฝาก"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAutoSort}
            className="gap-1.5 text-xs sm:text-sm h-9 cursor-pointer"
            title="จัดเรียงบัญชีตามสถาบันการเงินและยอดคงเหลือ"
          >
            <SparklesIcon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
            <span>จัดเรียงสถาบัน</span>
          </Button>
        }
      />

      {/* ── Top KPI Grid (2x2 on Mobile, 4x1 on Desktop) ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Total Cash */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-xs font-medium text-ink-muted">Total Liquid Cash</p>
            <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold text-ink tnum truncate">
              {thb(totalCashThb)}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
            {currentNetWorth > 0 ? ((totalCashThb / currentNetWorth) * 100).toFixed(1) : 0}% of Net Worth
            {usdOnlyTotal > 0 ? ` · $${usdOnlyTotal.toLocaleString()} USD` : ''}
          </p>
        </Card>

        {/* Card 2: Annual Yield & APY */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-xs font-medium text-ink-muted">Est. Annual Yield</p>
            <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tnum truncate">
              {thb(totalAnnualYield)}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
            เฉลี่ย {thb(totalAnnualYield / 12)}/ด. · APY {effectiveApy.toFixed(2)}%
          </p>
        </Card>

        {/* Card 3: Deployable Cash */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-xs font-medium text-ink-muted">Deployable Cash</p>
            <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tnum truncate">
              {thb(deployableAmount)}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
            {deployablePct.toFixed(1)}% ของเงินสด · เงินสดที่คุณมีอิสระในการ deploy จริง ๆ
          </p>
        </Card>

        {/* Card 4: Committed / Locked Cash */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-xs font-medium text-ink-muted">Committed / Locked</p>
            <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold text-amber-500 tnum truncate">
              {thb(lockedAmount)}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
            {lockedPct.toFixed(1)}% ของเงินสด · Cash / assets ที่ไม่ควรแตะ
          </p>
        </Card>
      </div>

      {/* ── 2-Tier Liquidity Allocation Section ── */}
      <Card className="p-4 sm:p-5 border-line/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <span>📊 Liquidity Allocation (การจัดสรรสภาพคล่องเงินสด)</span>
            </h3>
            <p className="text-xs text-ink-muted">
              แยกเงินสดที่คุณมีอิสระในการ deploy กับเงินออมระยะยาวที่ไม่ควรแตะ
            </p>
          </div>
          <span className="text-xs font-semibold text-ink-muted">
            รวมเงินสด {thb(totalCashThb)}
          </span>
        </div>

        {/* Multi-tier Progress Bar */}
        <div className="h-3.5 w-full rounded-full bg-surface-muted overflow-hidden flex shadow-inner">
          {(['spending', 'locked'] as CashAccountCategory[]).map((catKey) => {
            const amount = categoryBreakdown[catKey]
            const pct = totalCashThb > 0 ? (amount / totalCashThb) * 100 : 0
            if (pct <= 0) return null

            const colors: Record<CashAccountCategory, string> = {
              spending: 'bg-emerald-500',
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

        {/* 2 Category Badges / Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(['spending', 'locked'] as CashAccountCategory[]).map((catKey) => {
            const meta = CASH_CATEGORIES[catKey]
            const amount = categoryBreakdown[catKey]
            const pct = totalCashThb > 0 ? (amount / totalCashThb) * 100 : 0
            const isSelected = activeCategoryFilter === catKey

            const badgeBorderColors: Record<CashAccountCategory, string> = {
              spending: 'border-emerald-500/30 hover:border-emerald-500/60',
              locked: 'border-amber-500/30 hover:border-amber-500/60',
            }

            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setActiveCategoryFilter(isSelected ? 'all' : catKey)}
                className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer min-w-0 overflow-hidden flex flex-col justify-between ${badgeBorderColors[catKey]} ${
                  isSelected ? 'ring-2 ring-brand bg-brand-soft/20' : 'bg-surface-muted/40 hover:bg-surface-muted/80'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 w-full">
                  <span className="shrink-0 text-sm">{meta.icon}</span>
                  <span className="text-xs font-semibold text-ink-muted truncate" title={meta.labelTh}>
                    {meta.labelTh}
                  </span>
                  <span className="text-xs text-ink-muted opacity-60 ml-auto">
                    {catKey === 'spending' ? 'อิสระ deploy' : 'ไม่ควรแตะ'}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-1 w-full min-w-0">
                  <span className="font-display font-black text-sm sm:text-base text-ink tnum truncate">
                    {thb(amount)}
                  </span>
                  <span className="font-mono text-xs font-bold text-ink-muted shrink-0">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* ── Cash Accounts Matrix & Filter Controls ── */}
      <Card className="p-4 sm:p-5 border-line/60 space-y-4">
        {/* Controls: Search & Category Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line/40">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
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
            {(['spending', 'locked'] as CashAccountCategory[]).map((catKey) => {
              const meta = CASH_CATEGORIES[catKey]
              const count = accounts.filter((a) => getCashCategory(a) === catKey).length
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
                  <span className="text-xs opacity-75">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Search box & Add Account Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                placeholder="ค้นหาชื่อบัญชี / สถาบัน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-line bg-surface-muted/40 pl-8 pr-3 text-xs font-medium text-ink outline-none placeholder:text-ink-muted/50 focus:border-brand focus:bg-surface"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              className="gap-1.5 text-xs sm:text-sm shrink-0 h-9 px-3.5 shadow-xs cursor-pointer font-semibold"
              title="เพิ่มบัญชีเงินสดใหม่"
            >
              <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
              <span>เพิ่มบัญชีใหม่</span>
            </Button>
          </div>
        </div>

        {/* ── Mobile View: Compact List Cards (md:hidden) ── */}
        <div className="md:hidden space-y-2">
          {/* Quick Sort Bar on Mobile */}
          {filteredAccounts.length > 1 && (
            <div className="flex items-center justify-between text-xs text-ink-muted px-1 pb-1 select-none border-b border-line/30">
              <span>{filteredAccounts.length} บัญชี</span>
              <div className="flex items-center gap-2">
                <span className="text-ink-muted">เรียง:</span>
                <button
                  type="button"
                  onClick={() => handleSortToggle('balance')}
                  className={`font-semibold cursor-pointer ${sortField === 'balance' ? 'text-brand font-bold' : 'hover:text-ink'}`}
                >
                  ยอดคงเหลือ {sortField === 'balance' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleSortToggle('yield')}
                  className={`font-semibold cursor-pointer ${sortField === 'yield' ? 'text-brand font-bold' : 'hover:text-ink'}`}
                >
                  ดอกเบี้ย {sortField === 'yield' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </button>
              </div>
            </div>
          )}

          {/* List of Mobile Cards */}
          <div className="divide-y divide-line/30">
            {filteredAccounts.map((a) => {
              const preset = detectBankPreset(a.name)
              const cat = getCashCategory(a)
              const catMeta = CASH_CATEGORIES[cat]

              const rateNum = a.interestRate ?? 0
              const capNum = a.maxEligibleBalance
              const eligibleBal = capNum && capNum > 0 ? Math.min(a.balance, capNum) : a.balance
              const eligibleThb = a.currency === 'USD' ? eligibleBal * rate : eligibleBal
              const annualEarned = rateNum > 0 && eligibleThb > 0 ? eligibleThb * (rateNum / 100) : 0

              return (
                <div
                  key={a.id}
                  className="py-2.5 px-0.5 flex items-center justify-between gap-2 transition-colors hover:bg-surface-muted/20"
                >
                  {/* Left: Logo + Name + Category / Rate Tag */}
                  <div
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      setAccountToEdit(a)
                      setIsEditModalOpen(true)
                    }}
                  >
                    {preset ? (
                      <div
                        className="h-8.5 w-8.5 rounded-lg text-xs font-black shrink-0 flex items-center justify-center select-none shadow-xs"
                        style={{ background: preset.bg, color: preset.color, border: `1px solid ${preset.color}35` }}
                      >
                        {preset.shortName}
                      </div>
                    ) : (
                      <div className="h-8.5 w-8.5 rounded-lg bg-surface-muted border border-line/50 text-ink-muted text-xs font-bold shrink-0 flex items-center justify-center">
                        <WalletIcon className="h-4 w-4 opacity-60" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-display font-bold text-sm text-ink truncate">
                          {a.name || 'Untitled'}
                        </span>
                        {a.currency === 'USD' && (
                          <span className="text-xs font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono shrink-0">
                            USD
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-ink-muted truncate">
                        <span className="truncate">{catMeta?.icon} {catMeta?.labelTh}</span>
                        {rateNum > 0 && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                              {rateNum}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Balance + Annual Interest + Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className="text-right cursor-pointer"
                      onClick={() => {
                        setAccountToEdit(a)
                        setIsEditModalOpen(true)
                      }}
                    >
                      <div className="font-display font-black text-sm text-ink tnum">
                        {a.currency === 'USD' ? `$${a.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : thb(a.balance)}
                      </div>
                      {annualEarned > 0 ? (
                        <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{thb(annualEarned)}/ปี
                        </div>
                      ) : a.currency === 'USD' && a.balance > 0 ? (
                        <div className="text-xs font-mono text-ink-muted">
                          ≈ {thb(a.balance * rate)}
                        </div>
                      ) : (
                        <div className="text-xs text-ink-muted/40">
                          -
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountToEdit(a)
                          setIsEditModalOpen(true)
                        }}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                        title="แก้ไขบัญชี"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountToDelete(a)}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="ลบบัญชี"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Desktop View: Responsive Modern Table (hidden md:block) ── */}
        <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-line/60 text-xs font-bold uppercase tracking-wider text-ink-muted select-none">
                {/* Column 1: บัญชี / สถาบัน */}
                <th
                  onClick={() => handleSortToggle('name')}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>บัญชี / สถาบัน</span>
                    <span className={`text-xs ${sortField === 'name' ? 'text-brand font-black' : 'opacity-30'}`}>
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
                    <span className={`text-xs ${sortField === 'category' ? 'text-brand font-black' : 'opacity-30'}`}>
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
                    <span className={`text-xs ${sortField === 'yield' ? 'text-brand font-black' : 'opacity-30'}`}>
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
                    <span className={`text-xs ${sortField === 'balance' ? 'text-brand font-black' : 'opacity-30'}`}>
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
            <tbody className="divide-y divide-line/30 text-sm">
              {filteredAccounts.map((a) => {
                const preset = detectBankPreset(a.name)
                const cat = getCashCategory(a)
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
                              className="h-8 w-8 rounded-lg text-xs font-black shrink-0 flex items-center justify-center select-none shadow-xs"
                              style={{ background: preset.bg, color: preset.color, border: `1px solid ${preset.color}35` }}
                              title={`สถาบัน: ${preset.name}`}
                            >
                              {preset.shortName}
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-surface-muted border border-line/50 text-ink-muted text-xs font-bold shrink-0 flex items-center justify-center">
                              <WalletIcon className="h-4 w-4 opacity-60" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-display font-bold text-sm text-ink block truncate group-hover:text-brand transition-colors">
                              {a.name || 'Untitled Account'}
                            </span>
                            {a.currency === 'USD' && a.balance > 0 && (
                              <span className="text-xs font-mono text-ink-muted block">
                                ≈ {thb(a.balance * rate)} (@{rate.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. หมวดหมู่ */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-surface-muted border border-line/50">
                          <span>{CASH_CATEGORIES[cat]?.icon}</span>
                          <span>{CASH_CATEGORIES[cat]?.labelTh}</span>
                        </span>
                      </td>

                      {/* 3. ดอกเบี้ย & ผลตอบแทน */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {rateNum > 0 ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                              <span>📈 {rateNum.toFixed(2)}%</span>
                              {capNum && capNum > 0 && (
                                <span className="text-xs opacity-75 font-normal">
                                  (สูงสุด {thb(capNum)})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-ink-muted font-mono">
                              ≈ {thb(annualEarned)}/ปี{' '}
                              <span className="opacity-70 font-sans">
                                ({a.payoutSchedule === 'monthly' ? 'จ่ายทุกเดือน' : a.payoutSchedule === 'semi_annual' ? 'ปีละ 2 ครั้ง' : 'ปีละ 1 ครั้ง'})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-muted/50 text-xs">-</span>
                        )}
                      </td>

                      {/* 4. ยอดคงเหลือ */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="font-display font-bold text-sm text-ink tnum">
                          {a.currency === 'USD'
                            ? `$${a.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : thb(a.balance)}
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
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div className="p-2 rounded-lg bg-surface border border-line/40">
                              <span className="text-ink-muted block text-xs">วัตถุประสงค์:</span>
                              <span className="font-bold text-ink flex items-center gap-1 mt-0.5">
                                <span>{CASH_CATEGORIES[cat]?.icon}</span>
                                <span>{CASH_CATEGORIES[cat]?.labelTh}</span>
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-line/40">
                              <span className="text-ink-muted block text-xs">รอบการจ่ายดอกเบี้ย:</span>
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
                              <span className="text-ink-muted block text-xs">ประมาณการดอกเบี้ย:</span>
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
        </div>

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12 text-ink-muted space-y-2">
            <p className="text-sm font-medium">ไม่พบบัญชีเงินสดที่ตรงกับเงื่อนไข</p>
            <Button onClick={handleOpenAddModal} variant="secondary" className="text-xs">
              + เพิ่มบัญชีใหม่
            </Button>
          </div>
        )}
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
  const [category, setCategory] = useState<CashAccountCategory>(initialAccount.category ? getCashCategory(initialAccount) : 'spending')
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
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" form="account-edit-form">
            บันทึกบัญชี
          </Button>
        </div>
      }
    >
      <form id="account-edit-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Name */}
        <div>
          <label className="block text-xs font-bold text-ink mb-1">
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
            className="h-10 w-full rounded-xl border border-line bg-surface-muted/40 px-3 text-sm font-medium text-ink outline-none focus:border-brand focus:bg-surface"
          />
        </div>

        {/* Balance & Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              ยอดเงินคงเหลือ
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={formatWithCommas(balance)}
              onChange={(e) => setBalance(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface-muted/40 px-3 text-sm font-bold tnum text-ink outline-none focus:border-brand focus:bg-surface"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
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
          <label className="block text-xs font-bold text-ink mb-1.5">
            หมวดหมู่ / วัตถุประสงค์ (Liquidity Tier)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['spending', 'locked'] as CashAccountCategory[]).map((catKey) => {
              const meta = CASH_CATEGORIES[catKey]
              const isCatActive = category === catKey
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setCategory(catKey)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer border ${
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
          <span className="text-xs font-bold text-ink block">
            Yield Booster (ผลตอบแทนดอกเบี้ย)
          </span>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                อัตราดอกเบี้ยต่อปี (%)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="เช่น 1.50, 2.22, 5.50"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm font-bold tnum text-ink outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1" title="คิดดอกเบี้ยไม่เกินวงเงินนี้">
                เพดานเงินต้นสูงสุด
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="ไม่จำกัด"
                value={formatWithCommas(maxEligibleBalance)}
                onChange={(e) => setMaxEligibleBalance(e.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm font-bold tnum text-ink outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Payout Schedule */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">
              รอบดอกเบี้ยเข้าบัญชี
            </label>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
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
              <span className="text-xs text-ink-muted block">แตะเลือกเดือนที่ดอกเบี้ยเข้า:</span>
              <div className="grid grid-cols-6 gap-1 text-xs">
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
      </form>
    </Modal>
  )
}
