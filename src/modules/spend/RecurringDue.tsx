import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../../components/ui/Card'
import { TextLink } from '../../components/ui/TextLink'
import { CheckIcon } from '../../components/icons'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb, thbExact } from '../../lib/format'
import type { SpendRecurring } from '../../lib/types'
import { RepeatIcon, TransferIcon, getCategory } from './categories'
import { doneWord, nextOccurrence, recurringSign } from './logic'
import { paidDetail } from './billPaid'
import { openQuickAdd } from './QuickAddSheet'
import { TONES } from './tones'
import { recurringInput, useSpend } from './useSpend'

const UPCOMING_DAYS = 7

export const shortDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Icon and color for a recurring item: its category's, or the transfer look */
export function recurringLook(rec: Pick<SpendRecurring, 'type' | 'categoryId'>) {
  if (rec.type === 'transfer') return { Icon: TransferIcon, tone: TONES.sky.chip }
  const cat = getCategory(rec.categoryId)
  return { Icon: cat?.icon ?? RepeatIcon, tone: TONES[cat?.tone ?? 'slate'].chip }
}

/** Amount color for a recurring item */
export const recurringAmountClass = (type: SpendRecurring['type']) => (type === 'income' ? 'text-gain-ink' : type === 'transfer' ? 'text-ink-muted' : 'text-ink')

const daysFrom = (today: string, iso: string) => {
  const p = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  return Math.round((p(iso) - p(today)) / 86_400_000)
}

/** Recurring items waiting for a confirm, plus what's coming in the next week. */
export function RecurringDue({ showManage = true }: { showManage?: boolean }) {
  const { recurring, accountName, dueRecurring, confirmRecurring, skipRecurring, unskipRecurring, removeTransaction } = useSpend()
  const { showToast } = useToast()
  const today = localDateStr()

  const upcoming = useMemo(
    () =>
      recurring
        .filter((r) => !r.paused)
        .map((rec) => ({ rec, date: nextOccurrence(rec, today) }))
        .filter((x): x is { rec: typeof x.rec; date: string } => !!x.date && daysFrom(today, x.date) <= UPCOMING_DAYS)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [recurring, today],
  )

  // Same-day items under one date, with what goes out and comes in that day
  const upcomingByDay = useMemo(() => {
    const days: { date: string; items: typeof recurring; out: number; inflow: number }[] = []
    for (const { rec, date } of upcoming) {
      let day = days[days.length - 1]
      if (day?.date !== date) days.push((day = { date, items: [], out: 0, inflow: 0 }))
      day.items.push(rec)
      // A transfer only moves money between your own wallets
      if (rec.type === 'income') day.inflow += rec.amount
      else if (rec.type === 'expense') day.out += rec.amount
    }
    return days
  }, [upcoming])

  if (recurring.length === 0) {
    // On the Bills page its own empty state takes over; on Home, keep a way in so new users find it
    if (!showManage) return null
    return (
      <Card>
        <h2 className="font-display text-lg font-extrabold text-ink">Bills and recurring</h2>
        <Link
          to="/spend/recurring?new=1"
          className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-line-strong p-3 transition-colors hover:bg-surface-muted/60"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink-muted">
            <RepeatIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Set up bills that repeat</span>
            <span className="block text-xs text-ink-muted">Rent, phone, subscriptions, salary. Log each one with one tap when it's due.</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-link">Add →</span>
        </Link>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title="Bills and recurring" action={showManage && <TextLink to="/spend/recurring">Manage</TextLink>} />

      {dueRecurring.length === 0 && upcoming.length === 0 && (
        <p className="mt-2 text-sm text-ink-muted">Nothing due this week.</p>
      )}

      {dueRecurring.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {dueRecurring.map(({ rec, date }) => {
            const { Icon, tone } = recurringLook(rec)
            const late = daysFrom(today, date)
            const done = doneWord(rec.type)
            return (
              <li key={`${rec.id}-${date}`} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => openQuickAdd({ prefill: recurringInput(rec), recurring: { id: rec.id, date, name: rec.name } })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                  aria-label={`Review ${rec.name} and adjust the amount`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{rec.name}</span>
                    <span className="block text-xs font-semibold text-warn-ink">
                      {late === 0 ? 'Due today' : `Due ${shortDay(date)}`} · {thb(rec.amount)}
                    </span>
                    {rec.type === 'transfer' && (
                      <span className="block truncate text-xs text-ink-muted">
                        {accountName(rec.accountId) ?? '—'} → {accountName(rec.toAccountId) ?? '—'}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    skipRecurring(rec.id, date)
                    showToast(`Skipped ${rec.name}`, 'info', { label: 'Undo', onClick: () => unskipRecurring(rec.id, date) })
                  }}
                  className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink cursor-pointer"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const txn = confirmRecurring(rec, date)
                    // Undo deletes the logged transaction, which puts the bill back as due
                    showToast(
                      `${recurringSign(rec.type)}${thbExact(rec.amount)} · ${rec.name}`,
                      'success',
                      { label: 'Undo', onClick: () => removeTransaction(txn.id) },
                      {
                        popup: true,
                        title: done,
                        detail: paidDetail({
                          rec,
                          date,
                          name: rec.name,
                          amount: rec.amount,
                          accountName:
                            rec.type === 'transfer' ? `${accountName(rec.accountId) ?? '—'} → ${accountName(rec.toAccountId) ?? '—'}` : accountName(rec.accountId),
                          categoryId: rec.categoryId,
                          subcategory: rec.subcategory,
                        }),
                      },
                    )
                  }}
                  aria-label={`Mark ${rec.name} ${done.toLowerCase()}, ${thb(rec.amount)}`}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white cursor-pointer hover:bg-primary-hover"
                >
                  <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                  {done}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {upcoming.length > 0 && (
        <div className={dueRecurring.length > 0 ? 'mt-2 border-t border-line pt-3' : 'mt-3'}>
          <p className="mb-2 text-xs font-semibold text-ink-muted">Coming up</p>
          {/* One block per day, headed by the date and that day's total, like the day list on Home */}
          <div className="space-y-4">
            {upcomingByDay.map(({ date, items, out, inflow }) => {
              const inDays = daysFrom(today, date)
              return (
                <section key={date} aria-label={shortDay(date)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm">
                      <span className="font-bold text-ink">{shortDay(date)}</span>
                      <span className="text-ink-muted"> · {inDays === 1 ? 'Tomorrow' : `In ${inDays} days`}</span>
                    </p>
                    {items.length > 1 && (
                      <p className="shrink-0 text-xs font-semibold text-ink-muted tnum">
                        {/* Labelled, so the day's total doesn't read as one more bill */}
                        {inflow > 0 && <span className="text-gain-ink">+{thb(inflow)}{out > 0 ? ' in' : ' total'}</span>}
                        {inflow > 0 && out > 0 && ' · '}
                        {out > 0 && `${thb(out)}${inflow > 0 ? ' out' : ' total'}`}
                      </p>
                    )}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {items.map((rec) => {
                      const { Icon, tone } = recurringLook(rec)
                      return (
                        <li key={rec.id} className="flex items-center gap-2.5 text-sm">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-ink-soft">{rec.name}</span>
                          <span className={`shrink-0 font-semibold tnum ${recurringAmountClass(rec.type)}`}>
                            {rec.type === 'income' ? '+' : ''}
                            {thb(rec.amount)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
