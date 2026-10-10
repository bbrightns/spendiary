import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Modal } from '../../../components/ui/Modal'
import { PencilIcon, SettingsIcon, WalletIcon } from '../../../components/icons'
import { localDateStr, thb } from '../../../lib/format'
import { getCategory } from '../categories'
import { budgetState, daysLeftIn, inPeriod, periodFor, totalsFor } from '../logic'
import { RecurringDue } from '../RecurringDue'
import { MonthStepper } from '../MonthStepper'
import { BillReminders } from '../BillReminders'
import { openQuickAdd } from '../QuickAddSheet'
import { TxnRow } from '../TxnRow'
import { useSpend } from '../useSpend'
import { TONES } from '../tones'

export function SpendOverview() {
  const { transactions, methods, settings, setMonthlyBudget } = useSpend()
  const cycle = settings.cycle
  // Anchor on a date so the view follows along when the cycle setting changes
  const [anchor, setAnchor] = useState(localDateStr())
  const period = useMemo(() => periodFor(anchor, cycle), [anchor, cycle])
  const [budgetOpen, setBudgetOpen] = useState(false)

  const monthTxns = useMemo(() => transactions.filter((t) => inPeriod(period, t.date)), [transactions, period])
  const totals = useMemo(() => totalsFor(monthTxns), [monthTxns])

  // Every budgeted category shows (even at ฿0), plus the biggest unbudgeted ones
  const catBudgets = useMemo(() => settings.categoryBudgets ?? {}, [settings.categoryBudgets])
  const categoryRows = useMemo(() => {
    const spent = new Map(totals.byCategory.map((c) => [c.categoryId, c.amount]))
    const budgeted = Object.entries(catBudgets)
      .filter(([, b]) => b > 0)
      .map(([categoryId, budget]) => ({ categoryId, amount: spent.get(categoryId) ?? 0, budget }))
    const rest = totals.byCategory
      .filter((c) => !(catBudgets[c.categoryId] > 0))
      .slice(0, Math.max(0, 6 - budgeted.length))
      .map((c) => ({ ...c, budget: undefined as number | undefined }))
    return [...budgeted, ...rest].sort((a, b) => b.amount - a.amount)
  }, [totals.byCategory, catBudgets])

  const isCurrent = inPeriod(period, localDateStr())
  const budget = settings.monthlyBudget ?? 0
  const left = budget - totals.expense
  const daysLeft = isCurrent ? daysLeftIn(period) : 0
  const perDay = daysLeft > 0 ? left / daysLeft : 0
  const usedPct = budget > 0 ? Math.min(100, (totals.expense / budget) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Spend"
        title="Overview"
        subtitle={
          <div className="flex items-center gap-2">
            <MonthStepper value={period} cycle={cycle} onChange={(p) => setAnchor(p.start)} />
            <Link
              to="/spend/settings"
              aria-label="Spend settings: pay cycle and budget"
              title="Pay cycle and budget"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-xs hover:text-ink"
            >
              <SettingsIcon className="h-[18px] w-[18px]" />
            </Link>
          </div>
        }
        action={
          // Phones use the + in the bottom bar
          <div className="hidden lg:block">
            <AddButton onClick={() => openQuickAdd()} label="Add" />
          </div>
        }
      />

      <BillReminders />

      {/* ── Month totals ── */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          { label: 'Income', value: totals.income, className: totals.income > 0 ? 'text-gain' : 'text-ink' },
          { label: 'Spent', value: totals.expense, className: 'text-ink' },
          { label: 'Left', value: totals.net, className: totals.net < 0 ? 'text-loss' : 'text-ink' },
        ].map((s) => (
          <Card key={s.label} className="p-3 sm:p-5 animate-rise" padded={false}>
            <p className="text-xs font-medium text-ink-muted">{s.label}</p>
            <p className={`mt-1 font-display text-base sm:text-2xl font-extrabold tnum truncate ${s.className}`}>
              {s.label === 'Left' && s.value < 0 ? '−' : ''}
              {thb(Math.abs(s.value))}
            </p>
          </Card>
        ))}
      </div>

      {/* ── Budget ── */}
      <Card className="animate-rise">
        {budget > 0 ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-muted">
                  {isCurrent ? 'You can spend' : left >= 0 ? 'Under budget by' : 'Over budget by'}
                </p>
                <p className={`mt-1 font-display text-3xl sm:text-4xl font-extrabold tracking-tight tnum ${left < 0 ? 'text-loss' : 'text-ink'}`}>
                  {isCurrent ? (left > 0 ? thb(perDay) : '฿ 0') : thb(Math.abs(left))}
                  {isCurrent && <span className="ml-1 text-sm font-semibold text-ink-muted">/ day</span>}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {isCurrent
                    ? left >= 0
                      ? `${thb(left)} left for ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`
                      : `${thb(-left)} over this month's budget`
                    : `Budget ${thb(budget)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBudgetOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                {thb(budget)}
              </button>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              aria-valuenow={Math.round(usedPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Budget used"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${left < 0 ? 'bg-loss' : usedPct > 85 ? 'bg-warn' : 'bg-brand'}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted tnum">
              {thb(totals.expense)} of {thb(budget)} used
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">Set a monthly budget</p>
              <p className="text-xs text-ink-muted">See how much you can spend per day for the rest of the month.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setBudgetOpen(true)}>
              Set budget
            </Button>
          </div>
        )}
      </Card>

      {isCurrent && <RecurringDue />}

      {monthTxns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<WalletIcon className="h-7 w-7" />}
            title={isCurrent ? 'Log your first transaction' : 'No transactions this month'}
            description="Tap + to record what you spend or earn. Add #tags to the note to find things later."
            action={<AddButton onClick={() => openQuickAdd()} label="Add transaction" />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* ── Where it went ── */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-extrabold text-ink">Where it went</h2>
              <Link to="/spend/settings#category-budgets" className="text-sm font-semibold text-brand hover:underline">
                {Object.keys(catBudgets).length > 0 ? 'Budgets' : 'Set budgets'}
              </Link>
            </div>
            {categoryRows.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No spending yet this month.</p>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {categoryRows.map(({ categoryId, amount, budget: catBudget }) => {
                  const cat = getCategory(categoryId)
                  const share = totals.expense > 0 ? (amount / totals.expense) * 100 : 0
                  const Icon = cat?.icon
                  const tone = cat?.tone ?? 'slate'
                  const state = catBudget ? budgetState(amount, catBudget) : 'ok'
                  const bar = state === 'over' ? 'bg-loss' : state === 'near' ? 'bg-warn' : TONES[tone].bar
                  const width = catBudget ? Math.min(100, (amount / catBudget) * 100) : share
                  return (
                    <li key={categoryId}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                          {Icon && (
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONES[tone].chip}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                          )}
                          <span className="truncate">{cat?.label ?? 'Other'}</span>
                        </span>
                        <span className="shrink-0 tnum font-bold text-ink">
                          {thb(amount)}
                          {catBudget ? (
                            <span className="ml-1 text-xs font-semibold text-ink-muted">/ {thb(catBudget)}</span>
                          ) : (
                            <span className="ml-1.5 text-xs font-semibold text-ink-muted">{Math.round(share)}%</span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div className={`h-full rounded-full transition-[width] duration-500 ${bar}`} style={{ width: `${width}%` }} />
                      </div>
                      {catBudget ? (
                        <p className={`mt-1 text-xs tnum ${state === 'over' ? 'font-semibold text-loss' : state === 'near' ? 'font-semibold text-warn' : 'text-ink-muted'}`}>
                          {state === 'over' ? `Over by ${thb(amount - catBudget)}` : `${thb(catBudget - amount)} left`}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {/* ── Recent ── */}
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-ink">Recent</h2>
              <Link to="/spend/txns" className="text-sm font-semibold text-brand hover:underline">
                See all
              </Link>
            </div>
            <div className="mt-1 divide-y divide-line">
              {monthTxns.slice(0, 8).map((t) => (
                <TxnRow key={t.id} txn={t} methods={methods} />
              ))}
            </div>
          </Card>
        </div>
      )}

      <BudgetModal
        open={budgetOpen}
        initial={budget}
        onClose={() => setBudgetOpen(false)}
        onSave={(v) => {
          setMonthlyBudget(v > 0 ? v : undefined)
          setBudgetOpen(false)
        }}
      />
    </div>
  )
}

function BudgetModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: number
  onClose: () => void
  onSave: (v: number) => void
}) {
  const [value, setValue] = useState('')
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setValue(initial > 0 ? String(initial) : '')
  }
  const n = Number(value.replace(/,/g, ''))
  const valid = value === '' || (Number.isFinite(n) && n >= 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Monthly budget"
      description="What you plan to spend each month, excluding investing and transfers."
      size="sm"
      footer={
        <Button data-modal-submit className="w-full" disabled={!valid} onClick={() => onSave(value === '' ? 0 : n)}>
          Save
        </Button>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Budget per month</span>
        <div className="flex h-11 items-center rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
          <span className="mr-2 text-ink-muted">฿</span>
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="20,000"
            className="w-full bg-transparent text-base text-ink outline-none tnum placeholder:text-ink-faint"
          />
        </div>
        <span className="mt-1.5 block text-xs text-ink-muted">Leave empty to turn the budget off.</span>
      </label>
    </Modal>
  )
}
