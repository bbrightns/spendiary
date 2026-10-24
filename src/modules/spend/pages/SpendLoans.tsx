import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ChevronDownIcon, DebtIcon } from '../../../components/icons'
import { DEBT_CATEGORIES, getLiabilityDueStatus, isLiabilityActionableThisMonth } from '../../../lib/calc'
import { thb } from '../../../lib/format'
import type { Liability } from '../../../lib/types'
import { useData } from '../../../store/DataContext'
import { DebtCategoryIcon } from '../DebtCategoryIcon'
import { isLoanDone, loanProgress } from '../loans'
import { openPayLoan } from '../PayLoanSheet'
import { LoanSheet } from '../LoanSheet'

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

/** Short status for a row: the Invest side's labels are written for a wide table. */
function shortStatus(l: Liability): { text: string; tone: string } {
  if (isLoanDone(l)) return { text: 'Paid off', tone: 'text-gain-ink' }
  const s = getLiabilityDueStatus(l)
  const day = l.dueDay ? ordinal(l.dueDay) : ''
  switch (s.status) {
    case 'paid':
      return { text: 'Paid this month', tone: 'text-gain-ink' }
    case 'overdue':
      return { text: `Overdue · due ${day}`, tone: 'text-loss-ink' }
    case 'due_today':
      return { text: 'Due today', tone: 'text-warn-ink' }
    case 'due_soon':
      return { text: `Due in ${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'}`, tone: 'text-warn-ink' }
    default:
      return { text: day ? `Due ${day}` : 'No due day', tone: 'text-ink-muted' }
  }
}

/** Loans and installments, with this month's payments one tap away. */
export function SpendLoansPage() {
  const { data } = useData()
  const [sheet, setSheet] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [showDone, setShowDone] = useState(false)
  // ?action=new (search "Record debt", old Debts links) opens the add sheet straight away
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (params.get('action') !== 'new') return
    setSheet({ open: true, id: null })
    setParams({}, { replace: true })
  }, [params, setParams])

  const all = useMemo(() => data.liabilities ?? [], [data.liabilities])
  const active = all.filter((l) => !isLoanDone(l))
  const done = all.filter(isLoanDone)
  const owed = active.reduce((s, l) => s + (Number(l.balance) || 0), 0)
  const perMonth = active.reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0)
  // The last installment plan to finish sets the debt-free month
  const monthsLeft = Math.max(0, ...active.filter((l) => l.isInstallment && l.totalInstallments).map((l) => l.totalInstallments! - (l.paidInstallments ?? 0)))

  const row = (l: Liability) => {
    const status = shortStatus(l)
    const progress = loanProgress(l)
    const canPay = isLiabilityActionableThisMonth(l)
    const steps = l.isInstallment && l.totalInstallments ? `${l.paidInstallments ?? 0}/${l.totalInstallments}` : null
    const cat = DEBT_CATEGORIES[l.category]
    return (
      <li key={l.id} className="flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={() => setSheet({ open: true, id: l.id })}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${cat?.bgClass ?? 'bg-surface-muted'} ${cat?.textClass ?? 'text-ink-muted'}`}>
            <DebtCategoryIcon category={l.category} className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            {/* Name gets the whole first line; amounts sit on the second so phones don't cut the name */}
            <span className="block truncate text-sm font-semibold text-ink">{l.name}</span>
            <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                <span className={status.tone}>{status.text}</span>
                {(l.monthlyPayment ?? 0) > 0 && <span className="text-ink-muted tnum"> · {thb(l.monthlyPayment!)}/mo</span>}
              </span>
              <span className="shrink-0 font-bold text-ink tnum">{thb(l.balance)}</span>
            </span>
            {(steps || progress > 0) && (
              <span className="mt-1.5 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
                </span>
                {steps && <span className="shrink-0 text-2xs font-semibold text-ink-muted tnum">{steps}</span>}
              </span>
            )}
          </span>
        </button>
        {canPay && (
          <button
            type="button"
            onClick={() => openPayLoan(l.id)}
            className="shrink-0 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-transform cursor-pointer active:scale-95"
          >
            Pay
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Spend"
        title="Loans & installments"
        subtitle="What you owe and pay back each month. Pay takes it from a wallet and updates the loan in one go."
        action={all.length > 0 ? <AddButton onClick={() => setSheet({ open: true, id: null })} label="Add" /> : undefined}
      />

      {all.length === 0 ? (
        <Card>
          <EmptyState
            icon={<DebtIcon className="h-7 w-7" />}
            title="No loans or installments"
            description="Add a 0% phone plan, car loan or mortgage to see what's left and get a one-tap Pay each month."
            action={<AddButton onClick={() => setSheet({ open: true, id: null })} label="Add loan" />}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            <Card compact>
              <p className="text-xs font-medium text-ink-muted">Still owed</p>
              <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate text-ink">{thb(owed)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {active.length} {active.length === 1 ? 'loan' : 'loans'}
              </p>
            </Card>
            <Card compact>
              <p className="text-xs font-medium text-ink-muted">Each month</p>
              <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate text-ink">{thb(perMonth)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {monthsLeft > 0 ? `Installments done in ${monthsLeft} ${monthsLeft === 1 ? 'month' : 'months'}` : 'in payments'}
              </p>
            </Card>
          </div>

          {active.length > 0 && (
            <Card list>
              <ul className="divide-y divide-line">{active.map(row)}</ul>
            </Card>
          )}

          {done.length > 0 && (
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-muted hover:text-ink cursor-pointer"
              >
                Paid off ({done.length})
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${showDone ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>
              {showDone && (
                <Card list className="opacity-80">
                  <ul className="divide-y divide-line">{done.map(row)}</ul>
                </Card>
              )}
            </section>
          )}
        </>
      )}

      <LoanSheet open={sheet.open} loanId={sheet.id} onClose={() => setSheet({ open: false, id: null })} />
    </div>
  )
}
