import { DebtIcon } from '../../components/icons'
import { getLiabilityDueStatus, isLiabilityActionableThisMonth } from '../../lib/calc'
import { thb } from '../../lib/format'
import { useData } from '../../store/DataContext'
import { openPayLoan } from './PayLoanSheet'
import { DEFAULT_BILL_REMINDER_DAYS } from './logic'
import { useSpend } from './useSpend'

/**
 * Loans and installments due soon or overdue, each with a one-tap Pay (same look as card bills).
 * They use the same reminder window as card bills, so a payment weeks away doesn't crowd Home.
 */
export function LoanReminders() {
  const remindDays = useSpend().settings.billReminderDays ?? DEFAULT_BILL_REMINDER_DAYS
  const due = (useData().data.liabilities ?? []).filter((l) => {
    if (!isLiabilityActionableThisMonth(l)) return false
    const s = getLiabilityDueStatus(l)
    return s.status === 'overdue' || s.status === 'due_today' || (s.daysLeft !== undefined && s.daysLeft <= remindDays)
  })
  if (due.length === 0) return null

  return (
    <div className="space-y-2" role="region" aria-label="Loan payments due">
      {due.map((l) => {
        const s = getLiabilityDueStatus(l)
        const overdue = s.status === 'overdue'
        const when =
          s.status === 'overdue'
            ? `overdue · was due on the ${l.dueDay}`
            : s.status === 'due_today'
              ? 'due today'
              : s.daysLeft !== undefined
                ? `due in ${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'}`
                : 'due this month'
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => openPayLoan(l.id)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer animate-rise ${
              overdue ? 'border-loss/30 bg-loss-soft hover:bg-loss-soft/70' : 'border-warn/30 bg-warn-soft hover:bg-warn-soft/70'
            }`}
          >
            <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-ink text-white dark:bg-surface-muted dark:text-ink">
              <DebtIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{l.name}</span>
              <span className={`block text-xs font-semibold tnum ${overdue ? 'text-loss' : 'text-warn'}`}>
                {thb(l.monthlyPayment ?? l.balance)} {when}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white dark:bg-[#4f46e5]">Pay</span>
          </button>
        )
      })}
    </div>
  )
}
