import { useState } from 'react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ChevronRightIcon } from '../../../components/icons'
import { localDateStr, thb } from '../../../lib/format'
import type { Liability, SpendRecurring } from '../../../lib/types'
import { useData } from '../../../store/DataContext'
import { RepeatIcon, getCategory } from '../categories'
import { fixedCostRecurring, frequencyLabel, nextOccurrence, perMonth } from '../logic'
import { RecurringSheet } from '../RecurringSheet'
import { RecurringDue, shortDay } from '../RecurringDue'
import { TONES } from '../tones'
import { useSpend } from '../useSpend'

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4)

/**
 * A debt that looks like the same payment (same monthly amount or a shared name word).
 * Informational only: Debts tracks the balance, the fixed cost covers the monthly payment.
 */
function lookalikeDebt(r: SpendRecurring, debts: Liability[]): Liability | undefined {
  const mine = words(r.name)
  return debts.find(
    (d) =>
      d.balance > 0 &&
      ((d.monthlyPayment !== undefined && Math.abs(d.monthlyPayment - r.amount) < 1) || words(d.name).some((w) => mine.includes(w))),
  )
}

export function SpendRecurringPage() {
  const { recurring, methods } = useSpend()
  const debts = useData().data.liabilities ?? []
  const [sheet, setSheet] = useState<{ open: boolean; rec?: SpendRecurring }>({ open: false })
  const today = localDateStr()
  const active = recurring.filter((r) => !r.paused)
  const out = active.filter((r) => r.type === 'expense').reduce((s, r) => s + perMonth(r), 0)
  const inc = active.filter((r) => r.type === 'income').reduce((s, r) => s + perMonth(r), 0)
  const fixedIds = new Set(fixedCostRecurring(recurring).map((r) => r.id))
  const fixed = fixedCostRecurring(recurring).reduce((s, r) => s + perMonth(r), 0)

  const sorted = [...recurring].sort((a, b) => {
    if (!!a.paused !== !!b.paused) return a.paused ? 1 : -1
    return (nextOccurrence(a, today) ?? '9999').localeCompare(nextOccurrence(b, today) ?? '9999')
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Spend"
        title="Recurring"
        subtitle="Bills and income that repeat. Each one waits for you to log or skip it."
        action={recurring.length > 0 ? <AddButton onClick={() => setSheet({ open: true })} label="Add" /> : undefined}
      />

      {recurring.length === 0 ? (
        <Card>
          <EmptyState
            icon={<RepeatIcon className="h-7 w-7" />}
            title="Add your first recurring bill"
            description="Rent, subscriptions, phone, insurance. You'll get a one-tap Log when each one is due."
            action={<AddButton onClick={() => setSheet({ open: true })} label="Add recurring" />}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            <Card className="p-3 sm:p-5 animate-rise" padded={false}>
              <p className="text-xs font-medium text-ink-muted">Bills per month</p>
              <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate text-ink">≈ {thb(out)}</p>
              <p className="mt-0.5 text-xs text-ink-muted tnum">Fixed costs ≈ {thb(fixed)}</p>
            </Card>
            <Card className="p-3 sm:p-5 animate-rise" padded={false}>
              <p className="text-xs font-medium text-ink-muted">Recurring income</p>
              <p className={`mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate ${inc > 0 ? 'text-gain' : 'text-ink'}`}>≈ {thb(inc)}</p>
            </Card>
          </div>

          <RecurringDue showManage={false} />

          <Card padded={false} className="divide-y divide-line">
            {sorted.map((r) => {
              const cat = getCategory(r.categoryId)
              const Icon = cat?.icon
              const next = r.paused ? undefined : nextOccurrence(r, today)
              const method = methods.find((m) => m.id === r.accountId)?.name
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSheet({ open: true, rec: r })}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-muted/50 cursor-pointer sm:px-5 ${r.paused ? 'opacity-60' : ''}`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[cat?.tone ?? 'slate'].chip}`}>
                    {Icon && <Icon className="h-[18px] w-[18px]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {r.name}
                      {r.paused && <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[11px] font-bold text-ink-muted">Paused</span>}
                      {fixedIds.has(r.id) && <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-ink">Fixed</span>}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {next ? `Next ${shortDay(next)} · ` : ''}
                      {frequencyLabel(r)}
                      {method && ` · ${method}`}
                    </span>
                    {fixedIds.has(r.id) && lookalikeDebt(r, debts) && (
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        Also in Debts: {lookalikeDebt(r, debts)!.name}
                      </span>
                    )}
                  </span>
                  <span className={`shrink-0 text-sm font-bold tnum ${r.type === 'income' ? 'text-gain' : 'text-ink'}`}>
                    {r.type === 'income' ? '+' : ''}
                    {thb(r.amount)}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-muted/50" strokeWidth={2} />
                </button>
              )
            })}
          </Card>
        </>
      )}

      <RecurringSheet
        open={sheet.open}
        rec={sheet.rec ? recurring.find((r) => r.id === sheet.rec!.id) : undefined}
        onClose={() => setSheet({ open: false })}
      />
    </div>
  )
}
