import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { CheckIcon } from '../../components/icons'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb } from '../../lib/format'
import { RepeatIcon, getCategory } from './categories'
import { nextOccurrence } from './logic'
import { paidDetail } from './billPaid'
import { openQuickAdd } from './QuickAddSheet'
import { TONES } from './tones'
import { recurringInput, useSpend } from './useSpend'

const UPCOMING_DAYS = 7

export const shortDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const daysFrom = (today: string, iso: string) => {
  const p = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  return Math.round((p(iso) - p(today)) / 86_400_000)
}

/** Recurring items waiting for a confirm, plus what's coming in the next week. */
export function RecurringDue({ showManage = true }: { showManage?: boolean }) {
  const { recurring, methods, dueRecurring, confirmRecurring, skipRecurring, unskipRecurring, removeTransaction } = useSpend()
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
          <span className="shrink-0 text-sm font-semibold text-brand">Add →</span>
        </Link>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold text-ink">Bills and recurring</h2>
        {showManage && (
          <Link to="/spend/recurring" className="text-sm font-semibold text-brand hover:underline">
            Manage
          </Link>
        )}
      </div>

      {dueRecurring.length === 0 && upcoming.length === 0 && (
        <p className="mt-2 text-sm text-ink-muted">Nothing due this week.</p>
      )}

      {dueRecurring.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {dueRecurring.map(({ rec, date }) => {
            const cat = getCategory(rec.categoryId)
            const Icon = cat?.icon
            const late = daysFrom(today, date)
            return (
              <li key={`${rec.id}-${date}`} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => openQuickAdd({ prefill: recurringInput(rec), recurring: { id: rec.id, date, name: rec.name } })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                  aria-label={`Review ${rec.name} and adjust the amount`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[cat?.tone ?? 'slate'].chip}`}>
                    {Icon && <Icon className="h-[18px] w-[18px]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{rec.name}</span>
                    <span className="block text-xs font-semibold text-warn">
                      {late === 0 ? 'Due today' : `Due ${shortDay(date)}`} · {thb(rec.amount)}
                    </span>
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
                      `${rec.type === 'income' ? '+' : '−'}${thb(rec.amount)} · ${rec.name}`,
                      'success',
                      { label: 'Undo', onClick: () => removeTransaction(txn.id) },
                      {
                        popup: true,
                        title: rec.type === 'income' ? 'Received' : 'Paid',
                        detail: paidDetail({
                          rec,
                          date,
                          name: rec.name,
                          amount: rec.amount,
                          accountName: methods.find((m) => m.id === rec.accountId)?.name,
                          categoryId: rec.categoryId,
                          subcategory: rec.subcategory,
                        }),
                      },
                    )
                  }}
                  aria-label={`Mark ${rec.name} ${rec.type === 'income' ? 'received' : 'paid'}, ${thb(rec.amount)}`}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white cursor-pointer dark:bg-[#4f46e5]"
                >
                  <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                  {rec.type === 'income' ? 'Received' : 'Paid'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {upcoming.length > 0 && (
        <div className={dueRecurring.length > 0 ? 'mt-2 border-t border-line pt-3' : 'mt-3'}>
          <p className="mb-1.5 text-xs font-semibold text-ink-muted">Coming up</p>
          <ul className="space-y-1.5">
            {upcoming.map(({ rec, date }) => (
              <li key={rec.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-soft">
                  <span className="font-semibold text-ink">{shortDay(date)}</span> · {rec.name}
                </span>
                <span className={`shrink-0 font-semibold tnum ${rec.type === 'income' ? 'text-gain' : 'text-ink'}`}>
                  {rec.type === 'income' ? '+' : ''}
                  {thb(rec.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
