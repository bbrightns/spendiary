import { CreditCardIcon } from '../../components/icons'
import { thb } from '../../lib/format'
import { dueText, openPayBill } from './PayBillSheet'
import { useSpend } from './useSpend'

/** Cards whose bill is due soon or overdue, each with a one-tap Pay. */
export function BillReminders() {
  const { reminders } = useSpend()
  if (reminders.length === 0) return null

  return (
    <div className="space-y-2" role="region" aria-label="Card bills due">
      {reminders.map((b) => {
        const overdue = b.status === 'overdue'
        return (
          <button
            key={b.card.id}
            type="button"
            onClick={() => openPayBill(b.card.id)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer animate-rise ${
              overdue ? 'border-loss/30 bg-loss-soft hover:bg-loss-soft/70' : 'border-warn/30 bg-warn-soft hover:bg-warn-soft/70'
            }`}
          >
            <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg text-white" style={{ background: b.card.color ?? '#0f172a' }}>
              <CreditCardIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{b.card.name} bill</span>
              <span className={`block text-xs font-semibold ${overdue ? 'text-loss' : 'text-warn'}`}>
                {thb(b.amountDue)} {dueText(b.daysToDue)}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white dark:bg-[#4f46e5]">Pay</span>
          </button>
        )
      })}
    </div>
  )
}
