import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { FilterChip } from '../components/ui/FilterChip'
import { AddButton } from '../components/ui/AddButton'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Modal } from '../components/ui/Modal'
import { LiabilitiesModal } from '../components/forms/LiabilitiesModal'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import type { DebtCategory, HoldingLog, Liability } from '../lib/types'
import { DEBT_CATEGORIES, getLiabilityDueStatus } from '../lib/calc'
import { thb } from '../lib/format'
import { openQuickAdd } from '../modules/spend/QuickAddSheet'
import { DebtCategoryIcon } from '../modules/spend/DebtCategoryIcon'
import { loanPaymentAmount } from '../modules/spend/loans'
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  PencilIcon,
  PlusIcon,
  ShoppingBagIcon,
  TrashIcon,
} from '../components/icons'

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  try {
    const parts = dateStr.slice(0, 10).split('-')
    if (parts.length < 3) return dateStr
    const y = Number(parts[0])
    const m = Number(parts[1]) - 1
    const d = Number(parts[2])
    const year = y > 2400 ? y - 543 : y
    return `${d} ${MONTHS_SHORT[m] || ''} ${year}`
  } catch {
    return dateStr
  }
}

function getEstimatedPayoffDate(dueDay: number | undefined, remainingTerms: number): { dateStr: string; relativeStr: string } {
  if (remainingTerms <= 0) return { dateStr: 'Fully paid 🎉', relativeStr: '0 months' }
  const now = new Date()
  const dDay = dueDay || 25
  const isNextMonthStart = now.getDate() > dDay
  const monthsToAdd = isNextMonthStart ? remainingTerms : Math.max(0, remainingTerms - 1)
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthsToAdd, dDay)
  const d = targetDate.getDate()
  const m = targetDate.getMonth()
  const year = targetDate.getFullYear()
  return {
    dateStr: `${d} ${MONTHS_SHORT[m]} ${year}`,
    relativeStr: `${remainingTerms} ${remainingTerms === 1 ? 'month' : 'months'} to go`,
  }
}

export function Debts() {
  const { data, payLiabilityInstallment, undoLiabilityPayment, removeLiability } = useData()
  const { showToast } = useToast()

  const [statusTab, setStatusTab] = useState<'active' | 'completed' | 'all'>('active')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<DebtCategory | 'all'>('all')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    const set = new Set<string>()
    if (data.liabilities && data.liabilities.length > 1) {
      // Keep only the first debt expanded by default; collapse the rest to save screen space
      data.liabilities.slice(1).forEach((l) => set.add(l.id))
    }
    return set
  })
  const [liabilitiesModalOpen, setLiabilitiesModalOpen] = useState(false)
  const [editingLiabilityId, setEditingLiabilityId] = useState<string | null>(null)
  const [historyModalLiability, setHistoryModalLiability] = useState<Liability | null>(null)
  const [itemToDelete, setItemToDelete] = useState<Liability | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setEditingLiabilityId(null)
      setLiabilitiesModalOpen(true)
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const [search, setSearch] = useState('')
  const liabilities = data.liabilities ?? []

  // Metrics
  const activeDebts = useMemo(() => {
    return liabilities.filter((l) => {
      if (l.balance <= 0) return false
      if (l.isInstallment && l.totalInstallments && (l.paidInstallments ?? 0) >= l.totalInstallments) return false
      return true
    })
  }, [liabilities])

  const completedDebts = useMemo(() => {
    return liabilities.filter((l) => {
      if (l.balance <= 0) return true
      if (l.isInstallment && l.totalInstallments && (l.paidInstallments ?? 0) >= l.totalInstallments) return true
      return false
    })
  }, [liabilities])

  const totalOutstanding = useMemo(() => {
    return activeDebts.reduce((sum, l) => sum + (Number(l.balance) || 0), 0)
  }, [activeDebts])

  const totalMonthlyPayment = useMemo(() => {
    return activeDebts.reduce((sum, l) => sum + (Number(l.monthlyPayment) || 0), 0)
  }, [activeDebts])

  const totalOriginalDebt = useMemo(() => {
    return liabilities.reduce((sum, l) => sum + (l.originalBalance ?? l.balance ?? 0), 0)
  }, [liabilities])

  const totalPaidOffAmount = Math.max(0, totalOriginalDebt - totalOutstanding)

  // Max payoff estimation among all active installment debts
  const overallDebtFreeEstimation = useMemo(() => {
    let maxRemainingMonths = 0
    let latestDueDay = 25

    activeDebts.forEach((l) => {
      if (l.isInstallment && l.totalInstallments) {
        const remaining = Math.max(0, l.totalInstallments - (l.paidInstallments ?? 0))
        if (remaining > maxRemainingMonths) {
          maxRemainingMonths = remaining
          latestDueDay = l.dueDay || 25
        }
      }
    })

    if (maxRemainingMonths === 0) return null
    return getEstimatedPayoffDate(latestDueDay, maxRemainingMonths)
  }, [activeDebts])

  // Filtered list
  const filteredDebts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return liabilities.filter((l) => {
      const isCompleted = l.balance <= 0 || (l.isInstallment && l.totalInstallments && (l.paidInstallments ?? 0) >= l.totalInstallments)
      if (statusTab === 'active' && isCompleted) return false
      if (statusTab === 'completed' && !isCompleted) return false
      if (activeCategoryFilter !== 'all' && l.category !== activeCategoryFilter) return false
      if (q) {
        const nameMatch = l.name.toLowerCase().includes(q)
        const lenderMatch = l.lender ? l.lender.toLowerCase().includes(q) : false
        const catMeta = DEBT_CATEGORIES[l.category]
        const catMatch = catMeta ? catMeta.label.toLowerCase().includes(q) : false
        if (!nameMatch && !lenderMatch && !catMatch) return false
      }
      return true
    })
  }, [liabilities, statusTab, activeCategoryFilter, search])

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePay = (l: Liability) => {
    // Same amount the payment takes off the balance
    const amount = loanPaymentAmount(l)
    const n = (l.paidInstallments ?? 0) + 1
    payLiabilityInstallment(l.id)
    // Offer to log it as spending, so the wallet it came from goes down too
    if (amount > 0) {
      openQuickAdd({
        hint: 'Log this payment in Spend and pick the wallet it came from, or close to skip.',
        draft: {
          type: 'expense',
          amount,
          categoryId: 'bills',
          note: `${l.name} payment${l.isInstallment && l.totalInstallments ? ` ${n}/${l.totalInstallments}` : ''}`,
        },
      })
    }
    showToast(`Marked "${l.name}" as paid this month`, 'success', {
      label: 'Undo',
      onClick: () => undoLiabilityPayment(l.id),
    })
  }

  const handleUndo = (l: Liability) => {
    undoLiabilityPayment(l.id)
    showToast(`Payment for "${l.name}" undone`, 'info')
  }

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      removeLiability(itemToDelete.id)
      showToast(`Deleted "${itemToDelete.name}"`, 'info')
      setItemToDelete(null)
    }
  }

  // Related logs for history modal
  const historyLogs = useMemo(() => {
    if (!historyModalLiability) return []
    return (data.holdingLogs ?? []).filter((log: HoldingLog) => {
      return (
        log.holdingName === `Liability: ${historyModalLiability.name}` ||
        log.note.includes(historyModalLiability.name)
      )
    })
  }, [historyModalLiability, data.holdingLogs])

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        eyebrow="Plan"
        title="Debts & Installments"
        subtitle="Track your loans, 0% installments and card payments, and plan how to become debt-free"
      />

      {/* ── Top Summary Bento (Compact 2x2 on Mobile, 4x1 on Desktop like Dividends) ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Total Outstanding */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-xs font-medium text-ink-muted truncate">Total owed</p>
            <p className={`mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate ${totalOutstanding > 0 ? 'text-ink dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {totalOutstanding > 0 ? `-${thb(totalOutstanding)}` : '฿0'}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
            {totalOutstanding > 0 ? `${activeDebts.length} active ${activeDebts.length === 1 ? 'debt' : 'debts'}` : '🎉 Debt free!'}
          </p>
        </Card>

        {/* Card 2: Total Monthly Payment */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-xs font-medium text-ink-muted truncate">Monthly payments</p>
            <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum text-ink dark:text-white truncate">
              {totalMonthlyPayment > 0 ? thb(totalMonthlyPayment) : '฿0'}
              <span className="text-xs font-semibold text-ink-muted ml-0.5">/mo</span>
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
            {activeDebts.filter((l) => l.monthlyPayment).length} with a monthly payment
          </p>
        </Card>

        {/* Card 3: Paid Off Progress */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-xs font-medium text-ink-muted truncate">Paid off</p>
            <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum text-emerald-600 dark:text-emerald-400 truncate">
              +{thb(totalPaidOffAmount)}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
            {completedDebts.length > 0 ? `${completedDebts.length} cleared 🎉` : 'Nothing cleared yet'}
          </p>
        </Card>

        {/* Card 4: Estimated Debt-Free Date */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-xs font-medium text-brand truncate">Expected debt-free</p>
            <p className="mt-1 font-display text-base sm:text-xl font-extrabold text-ink dark:text-white tnum truncate">
              {overallDebtFreeEstimation ? overallDebtFreeEstimation.dateStr : 'No debts 🎉'}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs text-ink-muted truncate">
            {overallDebtFreeEstimation ? overallDebtFreeEstimation.relativeStr : 'Fully debt free'}
          </p>
        </Card>
      </div>

      {/* ── Main Debts Hub Card (Aligned with Portfolio Holdings Card) ── */}
      <Card className="animate-rise card-bleed-mobile" padded={false}>
        <div className="pt-5">
          <div className="px-4 sm:px-5">
            {/* Header: Title + Positions Count + View/Status Switcher + Add Button */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  Debts & installments
                </h3>
                <p className="text-xs text-ink-muted">
                  Showing {filteredDebts.length} of {liabilities.length}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Switcher: Segmented Pill with Glider */}
                <SegmentedControl
                  shape="pill"
                  size="xs"
                  fullWidth={false}
                  value={statusTab}
                  onChange={setStatusTab}
                  options={[
                    { value: 'active', label: `Active (${activeDebts.length})` },
                    { value: 'completed', label: `Paid off (${completedDebts.length})` },
                    { value: 'all', label: `All (${liabilities.length})` },
                  ]}
                  ariaLabel="Choose debt status"
                />

                <AddButton
                  onClick={() => {
                    setEditingLiabilityId(null)
                    setLiabilitiesModalOpen(true)
                  }}
                  label="Add debt"
                />
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-3">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}
              >
                <circle cx={6.5} cy={6.5} r={4.5} />
                <path d="M10.5 10.5l3 3" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search debts, cards, loans or lenders…"
                className="w-full rounded-xl border border-line bg-surface-muted py-2 pl-9 pr-8 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-faint hover:text-ink cursor-pointer"
                >
                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="mb-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 -my-1.5">
              <FilterChip
                active={activeCategoryFilter === 'all'}
                onClick={() => setActiveCategoryFilter('all')}
                aria-label="Show debts in every category"
              >
                All categories
              </FilterChip>

              {(['installment', 'credit_card', 'mortgage', 'auto_loan', 'personal_loan', 'student_loan', 'other'] as DebtCategory[]).map((catKey) => {
                const meta = DEBT_CATEGORIES[catKey]
                const count = liabilities.filter((l) => l.category === catKey).length
                if (count === 0 && activeCategoryFilter !== catKey) return null
                const isSelected = activeCategoryFilter === catKey
                return (
                  <FilterChip
                    key={catKey}
                    active={isSelected}
                    onClick={() => setActiveCategoryFilter(catKey)}
                    count={count}
                    aria-label={`Filter debts by category ${meta.label}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <DebtCategoryIcon category={catKey} className="h-3.5 w-3.5 shrink-0" />
                      <span>{meta.label}</span>
                    </span>
                  </FilterChip>
                )
              })}
            </div>
          </div>

          {/* ── Debts List Items inside Card ── */}
          <div className="px-4 pb-5 sm:px-5">
            {filteredDebts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-10 text-center">
                <div className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand dark:text-brand-ink mb-3">
                  <ShoppingBagIcon className="h-7 w-7" />
                </div>
                <h3 className="font-display text-base font-bold text-ink dark:text-white">
                  {statusTab === 'active'
                    ? 'No active debts (Debt free 🎉)'
                    : statusTab === 'completed'
                    ? 'Nothing paid off yet'
                    : 'No debts yet'}
                </h3>
                <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">
                  {statusTab === 'active'
                    ? 'You have nothing left to pay, or add a new debt to start tracking.'
                    : 'Add 0% installments, home or car loans and other borrowing to see everything in one place.'}
                </p>
                <Button
                  onClick={() => {
                    setEditingLiabilityId(null)
                    setLiabilitiesModalOpen(true)
                  }}
                  variant="primary"
                  size="sm"
                  className="mt-4 h-9 gap-1.5 text-xs sm:text-sm cursor-pointer shadow-xs"
                >
                  <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
                  <span>Add debt</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDebts.map((l) => {
                  const meta = DEBT_CATEGORIES[l.category] ?? DEBT_CATEGORIES.other
                  const isInst = l.isInstallment || l.category === 'installment'
                  const totalInst = l.totalInstallments ?? (isInst ? 10 : 0)
                  const paidInst = l.paidInstallments ?? 0
                  const remainingInst = Math.max(0, totalInst - paidInst)
                  const isCompleted = l.balance <= 0 || (isInst && totalInst > 0 && paidInst >= totalInst)
                  const percent = totalInst > 0 ? Math.min(100, Math.round((paidInst / totalInst) * 100)) : (isCompleted ? 100 : 0)
                  const isCollapsed = collapsedIds.has(l.id)

                  const originalBal = l.originalBalance ?? (isInst && l.monthlyPayment && totalInst > 0 ? l.monthlyPayment * totalInst : l.balance)
                  const paidAmount = Math.max(0, originalBal - l.balance)
                  const dueInfo = getLiabilityDueStatus(l)
                  const payoff = getEstimatedPayoffDate(l.dueDay, remainingInst)

                  // Monthly amount for each installment pill
                  const pillAmount = l.monthlyPayment && l.monthlyPayment > 0
                    ? l.monthlyPayment
                    : (totalInst > 0 ? Math.round(originalBal / totalInst) : 0)

                  return (
                    <div
                      key={l.id}
                      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xs hover:border-line-strong transition-all"
                    >
                      {/* ── Item Header ── */}
                      <div
                        onClick={() => toggleCollapse(l.id)}
                        className="p-3 sm:p-4 flex items-center justify-between gap-3 bg-surface hover:bg-surface-muted/50 transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl shrink-0 ${meta.bgClass} ${meta.textClass}`}>
                            <DebtCategoryIcon category={l.category} className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm sm:text-base text-ink dark:text-white truncate">
                                {l.name}
                              </h4>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${dueInfo.badgeClass}`}>
                                {dueInfo.label}
                              </span>
                            </div>
                            <p className="text-xs text-ink-muted truncate mt-0.5">
                              {meta.label} {l.dueDay ? `· due on the ${l.dueDay} each month` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Header Right: Balance & Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-display font-bold text-sm sm:text-base text-ink dark:text-white tnum">
                            -{thb(l.balance)}
                          </span>

                          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLiabilityId(l.id)
                                setLiabilitiesModalOpen(true)
                              }}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted dark:hover:bg-white/10 transition-colors cursor-pointer"
                              title="Edit this debt"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setItemToDelete(l)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete this debt"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="p-0.5 text-ink-muted">
                            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} />
                          </div>
                        </div>
                      </div>

                      {/* ── Item Body (Collapsible) ── */}
                      {!isCollapsed && (
                        <div className="p-3 sm:p-4 space-y-3 border-t border-line/60 bg-surface-muted/20">
                          {/* 1. Summary numbers grid */}
                          <div className="rounded-xl bg-surface p-2.5 sm:p-3 border border-line/60 text-center shadow-2xs">
                            <div className="grid grid-cols-3 gap-1.5 pb-2.5 border-b border-line/50">
                              <div>
                                <span className="text-xs font-medium text-ink-muted block">Paid so far</span>
                                <p className="font-display font-bold text-xs sm:text-sm tnum text-emerald-600 dark:text-emerald-400 truncate">
                                  {thb(paidAmount)}
                                </p>
                              </div>

                              <div>
                                <span className="text-xs font-medium text-ink-muted block">Remaining</span>
                                <p className={`font-display font-extrabold text-xs sm:text-sm tnum truncate ${l.balance > 0 ? 'text-ink dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {l.balance > 0 ? `-${thb(l.balance)}` : '฿0'}
                                </p>
                              </div>

                              <div>
                                <span className="text-xs font-medium text-ink-muted block">Original amount</span>
                                <p className="font-display font-bold text-xs sm:text-sm tnum text-ink dark:text-white truncate">
                                  {thb(originalBal)}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 pt-2.5">
                              <div>
                                <span className="text-xs font-medium text-ink-muted block">Monthly payment</span>
                                <p className="font-display font-bold text-xs sm:text-sm tnum text-ink dark:text-white truncate">
                                  {l.monthlyPayment ? thb(l.monthlyPayment) : '-'}
                                </p>
                              </div>

                              <div>
                                <span className="text-xs font-medium text-ink-muted block">Last paid</span>
                                <p className="font-display font-semibold text-xs text-ink dark:text-white truncate">
                                  {formatDate(l.lastPaidDate)}
                                </p>
                              </div>

                              <div>
                                <span className="text-xs font-medium text-ink-muted block">Lender</span>
                                <p className="font-display font-semibold text-xs text-ink dark:text-white truncate">
                                  {l.lender || '-'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* 2. Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
                              <span>Progress ({percent}%)</span>
                              <span>{isCompleted ? 'All payments done 🎉' : `${thb(l.balance)} left`}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  percent >= 100 ? 'bg-emerald-500' : 'bg-brand dark:bg-[#4f46e5]'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          {/* 3. Installment pills */}
                          {totalInst > 0 && (
                            <div className="space-y-1.5 pt-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-ink dark:text-white">Payment schedule</span>
                                <span className="text-ink-muted font-medium text-xs">
                                  {paidInst}/{totalInst} ({remainingInst} left)
                                </span>
                              </div>

                              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                                {Array.from({ length: totalInst }, (_, i) => {
                                  const termNum = i + 1
                                  const isPaid = termNum <= paidInst
                                  const isNext = termNum === paidInst + 1

                                  return (
                                    <button
                                      key={termNum}
                                      type="button"
                                      onClick={() => {
                                        if (isPaid && termNum === paidInst) {
                                          handleUndo(l)
                                        } else if (isNext) {
                                          handlePay(l)
                                        }
                                      }}
                                      title={
                                        isPaid
                                          ? `Payment ${termNum} (paid, click to undo)`
                                          : isNext
                                          ? `Payment ${termNum} (next, click to mark paid)`
                                          : `Payment ${termNum} (not due yet)`
                                      }
                                      className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-xs font-bold border transition-all cursor-pointer select-none ${
                                        isPaid
                                          ? 'bg-[#b3cf82]/40 dark:bg-[#b3cf82]/25 border-[#9abf60]/60 text-[#2a4512] dark:text-[#d3ebb0] hover:brightness-95'
                                          : isNext
                                          ? 'bg-amber-400/25 dark:bg-amber-400/15 border-amber-500 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/40'
                                          : 'bg-surface-muted/50 border-line text-ink-muted'
                                      }`}
                                    >
                                      <span
                                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-xs font-extrabold shrink-0 ${
                                          isPaid
                                            ? 'bg-[#7a9d3e] text-white'
                                            : isNext
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-surface-muted text-ink-faint'
                                        }`}
                                      >
                                        {isPaid ? '✓' : termNum}
                                      </span>
                                      <span className="tnum font-semibold text-xs truncate">
                                        {pillAmount > 0 ? (pillAmount >= 1000 ? `${(pillAmount / 1000).toFixed(pillAmount % 1000 === 0 ? 0 : 1)}k` : pillAmount) : '0'}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* 4. Estimated Payoff Date */}
                          {isInst && !isCompleted && (
                            <div className="rounded-xl bg-surface px-3 py-1.5 text-xs text-ink-muted border border-line/60 flex items-center justify-between">
                              <span>Expected last payment:</span>
                              <strong className="text-ink dark:text-white font-bold">{payoff.dateStr}</strong>
                            </div>
                          )}

                          {/* 5. Action Footer Buttons */}
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line/50">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setHistoryModalLiability(l)}
                              className="w-full text-xs font-semibold py-1.5"
                            >
                              <ClockIcon className="h-3.5 w-3.5 mr-1 text-ink-muted" />
                              Payment history
                            </Button>

                            {isCompleted ? (
                              <div className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs py-1.5">
                                <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                                <span>Paid off 🎉</span>
                              </div>
                            ) : dueInfo.status === 'paid' ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleUndo(l)}
                                className="w-full text-xs font-semibold py-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              >
                                <CheckIcon className="h-3.5 w-3.5 mr-1" strokeWidth={2.4} />
                                Paid (Undo)
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handlePay(l)}
                                className="w-full text-xs font-bold py-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950 shadow-xs"
                              >
                                <CheckIcon className="h-3.5 w-3.5 mr-1" strokeWidth={2.4} />
                                Mark as paid {l.monthlyPayment ? `(${thb(l.monthlyPayment)})` : ''}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Payment History Modal ── */}
      <Modal
        open={historyModalLiability !== null}
        onClose={() => setHistoryModalLiability(null)}
        title={historyModalLiability ? `Payment history: ${historyModalLiability.name}` : 'Payment history'}
        description="Payments recorded for this debt in your Activity Logs"
        size="lg"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button variant="secondary" onClick={() => setHistoryModalLiability(null)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          {historyLogs.length === 0 ? (
            <div className="py-8 text-center text-ink-muted text-sm">
              No payment history for this debt yet
            </div>
          ) : (
            <div className="divide-y divide-line/60 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
              {historyLogs.map((log: HoldingLog) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-ink dark:text-white">{log.note}</p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {new Date(log.timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-surface-muted text-ink-muted uppercase">
                    {log.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        title="Delete this debt?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setItemToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-muted py-2">
          Are you sure you want to delete &ldquo;<strong className="text-ink dark:text-white">{itemToDelete?.name}</strong>&rdquo;? This cannot be undone.
        </p>
      </Modal>

      {/* ── Add / Edit Liabilities Modal ── */}
      <LiabilitiesModal
        open={liabilitiesModalOpen}
        onClose={() => {
          setLiabilitiesModalOpen(false)
          setEditingLiabilityId(null)
        }}
        initialLiabilityId={editingLiabilityId}
      />
    </div>
  )
}
