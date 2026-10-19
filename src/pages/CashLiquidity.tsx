import { useState, useMemo, useEffect, Fragment } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import type { CashAccount, CashAccountCategory } from '../lib/types'
import {
  CASH_CATEGORIES,
  calculateMonthlyCashInterest,
  detectBankPreset,
  getCashCategory,
  netWorth,
  newCashAccount,
  sortCashAccounts,
  totalCash,
} from '../lib/calc'
import { money, thb } from '../lib/format'
import { rateOrZero } from '../lib/fx'
import { ListBulletIcon } from '../modules/spend/categories'
import { EditAccountModal } from '../components/forms/EditCashAccountModal'
import {
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
  WalletIcon,
} from '../components/icons'

/** The wallet icon Spend uses, tinted with the account's color (or its bank's); neutral when there's none */
function AccountIcon({ color, bank, className }: { color?: string; bank?: string; className: string }) {
  return (
    <div
      title={bank ? `Bank: ${bank}` : undefined}
      className={`${className} rounded-lg shrink-0 flex items-center justify-center ${color ? 'shadow-xs' : 'bg-surface-muted border border-line/50 text-ink-muted'}`}
      style={color ? { color, background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 21%, transparent)` } : undefined}
    >
      <WalletIcon className={`h-4 w-4 ${color ? '' : 'opacity-60'}`} />
    </div>
  )
}

export function CashLiquidity() {
  const { data, setCashAccounts, usdThb } = useData()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const openSpendTxns = (name: string) => navigate(`/spend/txns?q=${encodeURIComponent(name.toLowerCase())}`)

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

  // Real rate or 0: without one, USD balances stay out of THB totals (see the notice in Layout)
  const rate = rateOrZero(usdThb)
  // A USD account's yearly interest: in THB with a real rate, otherwise in USD (never ฿0)
  const yearlyInterest = (currency: string | undefined, interestInOwnCurrency: number, annualEarnedThb: number) =>
    currency === 'USD' && rate <= 0 ? money(interestInOwnCurrency, 'USD') : thb(annualEarnedThb)
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

  const pctOfCash = (v: number) => (totalCashThb > 0 ? (v / totalCashThb) * 100 : 0)
  const split = [
    { key: 'spending' as const, label: 'Everyday', hint: 'free to use', bar: 'bg-emerald-500', amount: categoryBreakdown.spending, pct: pctOfCash(categoryBreakdown.spending) },
    { key: 'locked' as const, label: 'Savings', hint: 'leave alone', bar: 'bg-amber-500', amount: categoryBreakdown.locked, pct: pctOfCash(categoryBreakdown.locked) },
  ]

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
    showToast('Accounts sorted by bank and balance', 'success')
  }

  const handleOpenAddModal = () => {
    setAccountToEdit(newCashAccount())
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
    showToast(`Saved account "${savedAcc.name}"`, 'success')
  }

  const handleDeleteAccount = () => {
    if (!accountToDelete) return
    const updated = accounts.filter((a) => a.id !== accountToDelete.id)
    setCashAccounts(updated)
    setAccountToDelete(null)
    showToast(`Deleted account "${accountToDelete.name}"`, 'info')
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        eyebrow="Plan"
        title="Cash & Liquidity Hub"
        subtitle="Your cash accounts, emergency savings, money ready to invest, and the interest you earn"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAutoSort}
            className="gap-1.5 text-xs sm:text-sm h-9 cursor-pointer"
            title="Sort accounts by bank and balance"
          >
            <SparklesIcon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
            <span>Sort by bank</span>
          </Button>
        }
      />

      {/* ── Summary: one total, how it splits (each half filters the list), and what it earns ── */}
      <Card className="p-4 sm:p-6 animate-rise" padded={false}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-muted">Total cash</p>
            <p className="mt-1 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink tnum truncate">{thb(totalCashThb)}</p>
            <p className="mt-1 text-xs text-ink-muted tnum">
              {currentNetWorth > 0 ? `${((totalCashThb / currentNetWorth) * 100).toFixed(0)}% of net worth` : 'Part of your net worth'}
              {usdOnlyTotal > 0 && (rate > 0 ? ` · includes $${usdOnlyTotal.toLocaleString()}` : ` · plus $${usdOnlyTotal.toLocaleString()} not converted`)}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-medium text-ink-muted">Interest a year</p>
            {totalAnnualYield > 0 ? (
              <>
                <p className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-ink tnum">{thb(totalAnnualYield)}</p>
                <p className="mt-0.5 text-xs text-ink-muted tnum">
                  ≈ {thb(totalAnnualYield / 12)}/month · {effectiveApy.toFixed(2)}% average
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">Add rates to your accounts to see it</p>
            )}
          </div>
        </div>

        {/* Split bar */}
        <div className="mt-5 flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          {split.map((g) => g.pct > 0 && <div key={g.key} className={`${g.bar} rounded-full`} style={{ width: `${g.pct}%` }} />)}
        </div>

        {/* Legend; tap a side to show only those accounts below */}
        <div className="-mx-3 mt-2 grid grid-cols-2 gap-2">
          {split.map((g) => {
            const on = activeCategoryFilter === g.key
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setActiveCategoryFilter(on ? 'all' : g.key)}
                aria-pressed={on}
                title={on ? 'Show all accounts' : `Show only ${g.label.toLowerCase()} accounts`}
                className={`min-w-0 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  on ? 'bg-surface-muted ring-1 ring-line-strong' : 'hover:bg-surface-muted/60'
                } ${g.key === 'locked' ? 'sm:text-right' : ''}`}
              >
                <span className={`flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-ink-soft ${g.key === 'locked' ? 'sm:justify-end' : ''}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${g.bar}`} />
                  {g.label}
                  <span className="font-normal text-ink-muted">· {g.hint}</span>
                </span>
                <span className="mt-1 block truncate font-display text-base sm:text-lg font-extrabold text-ink tnum">
                  {thb(g.amount)} <span className="text-xs font-semibold text-ink-muted">{g.pct.toFixed(0)}%</span>
                </span>
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
                placeholder="Search…"
                title="Search by account or bank name"
                aria-label="Search accounts"
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
              title="Add a new cash account"
            >
              <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
              <span>Add account</span>
            </Button>
          </div>
        </div>

        {/* ── Mobile View: Compact List Cards (md:hidden) ── */}
        <div className="md:hidden space-y-2">
          {/* Quick Sort Bar on Mobile */}
          {filteredAccounts.length > 1 && (
            <div className="flex items-center justify-between text-xs text-ink-muted px-1 pb-1 select-none border-b border-line/30">
              <span>{filteredAccounts.length} {filteredAccounts.length === 1 ? 'account' : 'accounts'}</span>
              <div className="flex items-center gap-2">
                <span className="text-ink-muted">Sort:</span>
                <button
                  type="button"
                  onClick={() => handleSortToggle('balance')}
                  className={`font-semibold cursor-pointer ${sortField === 'balance' ? 'text-brand font-bold' : 'hover:text-ink'}`}
                >
                  Balance {sortField === 'balance' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleSortToggle('yield')}
                  className={`font-semibold cursor-pointer ${sortField === 'yield' ? 'text-brand font-bold' : 'hover:text-ink'}`}
                >
                  Interest {sortField === 'yield' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
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
                // The whole row opens the edit sheet; delete and Spend history live there, so phones get the full width
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAccountToEdit(a)
                    setIsEditModalOpen(true)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-0.5 py-2.5 text-left transition-colors cursor-pointer hover:bg-surface-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <AccountIcon color={a.color ?? preset?.color} bank={preset?.name} className="h-8.5 w-8.5" />
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
                  <div className="shrink-0 text-right">
                    <div className="font-display font-black text-sm text-ink tnum">
                      {a.currency === 'USD' ? `$${a.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : thb(a.balance, true)}
                    </div>
                    {annualEarned > 0 || (a.currency === 'USD' && rate <= 0 && rateNum > 0 && eligibleBal > 0) ? (
                      <div className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 tnum">
                        +{yearlyInterest(a.currency, eligibleBal * (rateNum / 100), annualEarned)}/yr
                      </div>
                    ) : a.currency === 'USD' && a.balance > 0 && rate > 0 ? (
                      <div className="text-2xs text-ink-muted tnum">
                        ≈ {thb(a.balance * rate)}
                      </div>
                    ) : (
                      <div className="text-xs text-ink-muted/40">
                        -
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Desktop View: Responsive Modern Table (hidden md:block) ── */}
        <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-line/60 text-xs font-bold uppercase tracking-wider text-ink-muted select-none">
                {/* Column 1: Account */}
                <th
                  onClick={() => handleSortToggle('name')}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Account / bank</span>
                    <span className={`text-xs ${sortField === 'name' ? 'text-brand font-black' : 'opacity-30'}`}>
                      {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>

                {/* Column 2: Category */}
                <th
                  onClick={() => handleSortToggle('category')}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Category</span>
                    <span className={`text-xs ${sortField === 'category' ? 'text-brand font-black' : 'opacity-30'}`}>
                      {sortField === 'category' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>

                {/* Column 3: Interest */}
                <th
                  onClick={() => handleSortToggle('yield')}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Interest</span>
                    <span className={`text-xs ${sortField === 'yield' ? 'text-brand font-black' : 'opacity-30'}`}>
                      {sortField === 'yield' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>

                {/* Column 4: Balance (right aligned) */}
                <th
                  onClick={() => handleSortToggle('balance')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-ink transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Balance</span>
                    <span className={`text-xs ${sortField === 'balance' ? 'text-brand font-black' : 'opacity-30'}`}>
                      {sortField === 'balance' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>

                {/* Column 5: Actions */}
                <th className="py-2.5 px-3 text-right w-px whitespace-nowrap">
                  <span>Actions</span>
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
                      {/* 1. Account — long names truncate (full name on hover) so the table fits without scrolling */}
                      <td className="py-2 px-3 max-w-[18rem]" title={a.name}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AccountIcon color={a.color ?? preset?.color} bank={preset?.name} className="h-8 w-8" />
                          <div className="min-w-0">
                            <span className="font-display font-bold text-sm text-ink block truncate group-hover:text-brand transition-colors">
                              {a.name || 'Untitled Account'}
                            </span>
                            {a.currency === 'USD' && a.balance > 0 && rate > 0 && (
                              <span className="text-xs font-mono text-ink-muted block">
                                ≈ {thb(a.balance * rate)} (@{rate.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Category */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-surface-muted border border-line/50">
                          <span>{CASH_CATEGORIES[cat]?.icon}</span>
                          <span>{CASH_CATEGORIES[cat]?.labelTh}</span>
                        </span>
                      </td>

                      {/* 3. Interest */}
                      <td className="py-2 px-3">
                        {rateNum > 0 ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                              <span>📈 {rateNum.toFixed(2)}%</span>
                              {capNum && capNum > 0 && (
                                <span className="text-xs opacity-75 font-normal">
                                  (up to {thb(capNum)})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-ink-muted font-mono">
                              ≈ {yearlyInterest(a.currency, eligibleBal * (rateNum / 100), annualEarned)}/year{' '}
                              <span className="opacity-70 font-sans">
                                ({a.payoutSchedule === 'monthly' ? 'paid monthly' : a.payoutSchedule === 'semi_annual' ? 'paid twice a year' : 'paid once a year'})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-muted/50 text-xs">-</span>
                        )}
                      </td>

                      {/* 4. Balance */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="font-display font-bold text-sm text-ink tnum">
                          {a.currency === 'USD'
                            ? `$${a.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : thb(a.balance, true)}
                        </div>
                      </td>

                      {/* 5. Actions (edit / delete / expand) */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {(a.currency ?? 'THB') === 'THB' ? (
                            <button
                              type="button"
                              onClick={() => openSpendTxns(a.name)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink transition-colors cursor-pointer"
                              title="See transactions in Spend"
                              aria-label={`See ${a.name} transactions`}
                            >
                              <ListBulletIcon className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="h-8 w-8 shrink-0" aria-hidden />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setAccountToEdit(a)
                              setIsEditModalOpen(true)
                            }}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink transition-colors cursor-pointer"
                            title="Edit account details"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccountToDelete(a)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-loss-soft hover:text-loss transition-colors cursor-pointer"
                            title="Delete this account"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : a.id)}
                            className={`grid h-8 w-7 place-items-center rounded-lg transition-colors cursor-pointer ${
                              isExpanded ? 'bg-brand/10 text-brand' : 'text-ink-muted hover:bg-surface hover:text-ink'
                            }`}
                            title={isExpanded ? 'Collapse' : 'Show more details'}
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
                              <span className="text-ink-muted block text-xs">Purpose:</span>
                              <span className="font-bold text-ink flex items-center gap-1 mt-0.5">
                                <span>{CASH_CATEGORIES[cat]?.icon}</span>
                                <span>{CASH_CATEGORIES[cat]?.labelTh}</span>
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-line/40">
                              <span className="text-ink-muted block text-xs">Interest paid:</span>
                              <span className="font-bold text-ink mt-0.5 block">
                                {a.payoutSchedule === 'monthly'
                                  ? 'Every month (12 times a year)'
                                  : a.payoutSchedule === 'semi_annual'
                                  ? 'Twice a year (Jun & Dec)'
                                  : a.payoutSchedule === 'annual'
                                  ? 'Once a year'
                                  : 'Custom months'}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-line/40">
                              <span className="text-ink-muted block text-xs">Estimated interest:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                                {thb(annualEarned)} / year
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
            <p className="text-sm font-medium">No cash accounts match your search</p>
            <Button onClick={handleOpenAddModal} variant="secondary" className="text-xs">
              + Add account
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
          onDelete={
            accounts.some((x) => x.id === accountToEdit.id)
              ? () => {
                  setIsEditModalOpen(false)
                  setAccountToDelete(accountToEdit)
                  setAccountToEdit(null)
                }
              : undefined
          }
          onShowTxns={
            accounts.some((x) => x.id === accountToEdit.id) && (accountToEdit.currency ?? 'THB') === 'THB'
              ? () => openSpendTxns(accountToEdit.name)
              : undefined
          }
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {accountToDelete && (
        <ConfirmModal
          open={Boolean(accountToDelete)}
          title="Delete this account?"
          description={`Are you sure you want to delete "${accountToDelete.name}"? Your total cash will go down right away.`}
          confirmText="Delete account"
          confirmVariant="danger"
          onConfirm={handleDeleteAccount}
          onClose={() => setAccountToDelete(null)}
        />
      )}
    </div>
  )
}
