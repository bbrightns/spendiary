import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Modal } from '../../../components/ui/Modal'
import { PencilIcon, WalletIcon } from '../../../components/icons'
import { localDateStr, thb } from '../../../lib/format'
import { dayAllowance, inPeriod, periodFor, shiftDate, type DayStatus } from '../logic'
import { BillReminders } from '../BillReminders'
import { LoanReminders } from '../LoanReminders'
import { RecurringDue } from '../RecurringDue'
import { openQuickAdd } from '../QuickAddSheet'
import { TxnRow } from '../TxnRow'
import { useSpend } from '../useSpend'
import { SPEND_ACCENT_TEXT } from '../tones'
import { HOME_CARDS, homeOrder, isDefaultOrder, moveCard, type HomeCardId } from '../homeLayout'
import { ArrangeButton, ReorderSheet } from '../ReorderSheet'

const STATUS: Record<DayStatus, { label: string; stroke: string; chip: string }> = {
  ok: { label: 'On track', stroke: 'stroke-emerald-500', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' },
  careful: { label: 'Careful', stroke: 'stroke-amber-500', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' },
  over: { label: 'Over today', stroke: 'stroke-rose-500', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300' },
}

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Half-circle gauge; `pct` 0–1 */
function Gauge({ pct, strokeClass }: { pct: number; strokeClass: string }) {
  const len = Math.PI * 50
  return (
    <svg viewBox="0 0 120 66" className="mx-auto h-28 w-52" aria-hidden="true">
      <path d="M10 60 A50 50 0 0 1 110 60" fill="none" className="stroke-surface-muted" strokeWidth="11" strokeLinecap="round" />
      <path
        d="M10 60 A50 50 0 0 1 110 60"
        fill="none"
        className={`${strokeClass} transition-[stroke-dashoffset] duration-700`}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - Math.min(1, Math.max(0, pct)))}
      />
    </svg>
  )
}

export function SpendOverview() {
  const { transactions, methods, settings, setMonthlyBudget, updateSettings } = useSpend()
  const today = localDateStr()
  const period = useMemo(() => periodFor(today, settings.cycle), [today, settings.cycle])
  const [day, setDay] = useState(today)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [arrangeOpen, setArrangeOpen] = useState(false)

  const budget = settings.monthlyBudget ?? 0
  const allowance = useMemo(() => dayAllowance(budget, period, transactions, today), [budget, period, transactions, today])
  const spentPeriod = useMemo(
    () => transactions.filter((t) => t.type === 'expense' && inPeriod(period, t.date)).reduce((s, t) => s + t.amount, 0),
    [transactions, period],
  )

  // Last 7 days ending today, with what was spent each day
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = shiftDate(today, i - 6)
        const spent = transactions.filter((t) => t.date === date && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        return { date, spent }
      }),
    [transactions, today],
  )
  const dayTxns = transactions.filter((t) => t.date === day)
  const st = STATUS[allowance.status]

  // The reorderable cards; Home shows them in the order saved in Spend settings
  const allowanceCard = (
    <>
      {/* ── Today's allowance ── */}
      <Card className="animate-rise relative text-center">
        {budget > 0 ? (
          <>
            <Gauge pct={allowance.allowance > 0 ? allowance.spentToday / allowance.allowance : 1} strokeClass={st.stroke} />
            <div className="-mt-12">
              <p className={`font-display text-4xl font-extrabold tracking-tight tnum ${allowance.leftToday < 0 ? 'text-loss' : 'text-ink'}`}>
                {allowance.leftToday < 0 ? '−' : ''}
                {thb(Math.abs(allowance.leftToday))}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted tnum">
                {allowance.leftToday < 0 ? 'over' : 'left'} today of {thb(allowance.allowance)}
              </p>
            </div>
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.chip}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {st.label}
            </span>
            <button
              type="button"
              onClick={() => setBudgetOpen(true)}
              className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer"
              aria-label="Edit monthly budget"
            >
              <PencilIcon className="h-3 w-3" />
              {thb(budget)}
            </button>
          </>
        ) : (
          <div className="py-2">
            <p className="text-sm text-ink-muted">Spent today</p>
            <p className="font-display text-4xl font-extrabold tracking-tight tnum text-ink">{thb(allowance.spentToday)}</p>
            <p className="mt-2 text-sm text-ink-muted">Set a monthly budget to see what you can spend each day.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setBudgetOpen(true)}>
              Set budget
            </Button>
          </div>
        )}
      </Card>
    </>
  )
  const monthCard = (
    <>
      {/* ── Month at a glance ── */}
      {budget > 0 && (
        <Link to="/spend/analysis" className="block">
          <Card className="py-3.5 hover:shadow-[var(--shadow-lift)] transition-shadow">
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">This month</span>
              <span className="font-bold text-ink tnum">
                {thb(spentPeriod)} <span className="font-semibold text-ink-muted">/ {thb(budget)}</span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${spentPeriod > budget ? 'bg-loss' : spentPeriod > budget * 0.85 ? 'bg-warn' : 'bg-brand'}`}
                style={{ width: `${Math.min(100, (spentPeriod / budget) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted tnum">
              {allowance.daysLeft} {allowance.daysLeft === 1 ? 'day' : 'days'} {settings.cycle?.mode === 'payday' ? 'to payday' : 'left this month'} · See analysis →
            </p>
          </Card>
        </Link>
      )}
    </>
  )
  const dayCard = (
    <>
      {/* ── Day strip + that day's list ── */}
      <Card>
        <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Pick a day">
          {days.map((d) => {
            const on = d.date === day
            const dt = parse(d.date)
            return (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setDay(d.date)}
                className={`flex flex-col items-center rounded-xl border py-1.5 transition-colors cursor-pointer ${
                  on ? 'border-ink bg-ink text-white dark:border-[#4f46e5] dark:bg-[#4f46e5]' : 'border-line text-ink-muted hover:bg-surface-muted/60'
                }`}
              >
                <span className="text-[11px] font-semibold">{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <span className={`text-base font-bold tnum ${on ? '' : 'text-ink'}`}>{dt.getDate()}</span>
                <span className={`h-1 w-1 rounded-full ${d.spent > 0 ? (on ? 'bg-white' : 'bg-brand') : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold text-ink">{day === today ? 'Today' : parse(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
          <span className="text-sm font-bold text-ink tnum">−{thb(days.find((d) => d.date === day)?.spent ?? 0, true)}</span>
        </div>
        {dayTxns.length === 0 ? (
          <EmptyState
            icon={<WalletIcon className="h-7 w-7" />}
            title={day === today ? 'Nothing logged today' : 'Nothing logged this day'}
            description="Tap + to record what you spend or earn."
            action={day === today ? <AddButton onClick={() => openQuickAdd()} label="Add transaction" /> : undefined}
          />
        ) : (
          <div className="mt-1 divide-y divide-line">
            {dayTxns.map((t) => (
              <TxnRow key={t.id} txn={t} methods={methods} />
            ))}
          </div>
        )}
      </Card>
    </>
  )
  const cards: Record<HomeCardId, ReactNode> = { allowance: allowanceCard, month: monthCard, recurring: <RecurringDue />, days: dayCard }
  const order = homeOrder(settings.homeOrder)

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className={`mb-1 text-xs font-semibold uppercase tracking-[0.08em] ${SPEND_ACCENT_TEXT}`}>Spend</p>
          <h1 className="font-display text-3xl font-extrabold leading-none tracking-tight text-ink">Today</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {parse(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <AddButton onClick={() => openQuickAdd()} label="Add" />
          </div>
          <ArrangeButton label="Arrange cards" onClick={() => setArrangeOpen(true)} />
        </div>
      </header>

      <BillReminders />
      <LoanReminders />

      {/* Cards in your order; on wide screens they flow down two columns */}
      <div className="flex flex-col gap-5 lg:block lg:columns-2 lg:gap-5">
        {order.map((id) => (
          <div key={id} className="break-inside-avoid empty:hidden lg:mb-5">
            {cards[id]}
          </div>
        ))}
      </div>

      <ArrangeSheet
        open={arrangeOpen}
        order={order}
        onChange={(next) => updateSettings({ homeOrder: isDefaultOrder(next) ? undefined : next })}
        onClose={() => setArrangeOpen(false)}
      />

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

function BudgetModal({ open, initial, onClose, onSave }: { open: boolean; initial: number; onClose: () => void; onSave: (v: number) => void }) {
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

/** Reorder Home's cards; each move is saved right away. */
function ArrangeSheet({ open, order, onChange, onClose }: { open: boolean; order: HomeCardId[]; onChange: (next: HomeCardId[]) => void; onClose: () => void }) {
  return (
    <ReorderSheet
      open={open}
      onClose={onClose}
      title="Arrange cards"
      description="Choose what comes first on Home. Card bill and loan reminders always stay on top."
      items={order.map((id) => ({ id, label: HOME_CARDS.find((c) => c.id === id)?.label ?? id }))}
      onMove={(id, delta) => onChange(moveCard(order, id as HomeCardId, delta))}
      canReset={!isDefaultOrder(order)}
      onReset={() => onChange(homeOrder())}
    />
  )
}
