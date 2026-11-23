import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../../components/ui/Card'
import type { FlowVerdict, MonthlyFlow } from '../../modules/spend/monthlyFlow'
import { thb } from '../../lib/format'

/** Cash taken from savings: a neutral grey, so it reads as "not income" next to the green salary */
const CASH = 'color-mix(in srgb, var(--color-ink-muted) 55%, transparent)'

interface Part {
  label: string
  note?: ReactNode
  amount: number
  color: string
}

/** One labelled bar; In and Out share `scale`, so their lengths compare directly */
function StackBar({ label, parts, scale }: { label: string; parts: Part[]; scale: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-xs font-semibold text-ink-muted">{label}</span>
      <div className="flex h-3 flex-1 gap-0.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        {parts.filter((p) => p.amount > 0).map((p) => (
          <div
            key={p.label}
            className="h-full transition-all duration-500"
            style={{ width: `${scale > 0 ? (p.amount / scale) * 100 : 0}%`, background: p.color }}
          />
        ))}
      </div>
    </div>
  )
}

function Row({ dot, label, note, amount }: { dot: ReactNode; label: string; note?: ReactNode; amount: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 py-1.5">
      <span className="flex min-w-0 gap-2">
        <span className="flex h-5 w-2.5 shrink-0 items-center justify-center">{dot}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{label}</span>
          {note && <span className="block text-xs text-ink-muted">{note}</span>}
        </span>
      </span>
      <span className="shrink-0 pt-px">{amount}</span>
    </li>
  )
}

const money = (v: ReactNode) => <span className="font-display text-sm font-extrabold tnum text-ink">{v}</span>

const months = (n: number) => {
  if (n < 1) return 'less than a month'
  const shown = n < 10 ? Number(n.toFixed(1)) : Math.round(n)
  return `${shown} ${shown === 1 ? 'month' : 'months'}`
}

const CHIP = 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold'

/** The answer first: how much to top up this month, and whether DCA has to come down */
function Verdict({ verdict, cash }: { verdict: FlowVerdict; cash: number }) {
  let label: string, figure: string, tone: string, chip: ReactNode, line: ReactNode
  switch (verdict.kind) {
    case 'covered':
      label = 'Left over this month'
      figure = thb(verdict.leftover)
      tone = 'text-gain-ink'
      chip = <span className={`${CHIP} bg-gain-soft text-gain-ink`}>Salary covers everything</span>
      line = verdict.leftover > 0 ? 'Add it to a DCA plan or keep it as a buffer.' : null
      break
    case 'topUp':
      label = 'Top up from cash this month'
      figure = thb(verdict.topUp)
      tone = 'text-ink'
      chip = <span className={`${CHIP} bg-gain-soft text-gain-ink`}>DCA can stay · cash lasts {months(verdict.runwayMonths)}</span>
      line = <>Your spendable cash of <span className="font-semibold text-ink tnum">{thb(cash)}</span> covers the gap.</>
      break
    case 'low':
      label = 'Top up from cash this month'
      figure = thb(verdict.topUp)
      tone = 'text-warn-ink'
      chip = <span className={`${CHIP} bg-warn-soft text-warn-ink`}>Cash lasts only {months(verdict.runwayMonths)}</span>
      line = verdict.dcaNotEnough
        ? <>Stopping all DCA (<span className="tnum">{thb(verdict.cut)}</span>) still leaves <span className="font-semibold text-ink tnum">{thb(verdict.topUp - verdict.cut)}</span> a month to top up: bills and living are more than your salary.</>
        : <>Cut DCA by <span className="font-semibold text-ink tnum">{thb(verdict.cut)}</span> a month to stop topping up.</>
      break
    case 'short':
      label = 'Cut DCA this month by'
      figure = thb(verdict.cut)
      tone = 'text-loss-ink'
      chip = <span className={`${CHIP} bg-loss-soft text-loss-ink`}>Cash can't cover {thb(verdict.topUp)}</span>
      line = verdict.dcaNotEnough
        ? <>Stopping all DCA (<span className="tnum">{thb(verdict.cut)}</span>) still isn't enough: bills and living are more than your salary and cash.</>
        : <>You have <span className="font-semibold text-ink tnum">{thb(Math.max(0, cash))}</span> in spendable cash for a <span className="tnum">{thb(verdict.topUp)}</span> gap.</>
      break
  }
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className={`mt-1 font-display text-4xl font-extrabold tracking-tight tnum ${tone}`}>{figure}</p>
      <div className="mt-2">{chip}</div>
      {line && <p className="mt-2 text-xs text-ink-muted">{line}</p>}
    </div>
  )
}

/** The verdict, then money in (salary + cash) vs. money out on two bars of the same scale, with the numbers listed underneath. */
export function MonthlyFlowCard({ flow, verdict, salaryAmount, salaryNote, onAddSalary, livingNote, cash, livingThisMonth, periodName }: {
  flow: MonthlyFlow
  verdict: FlowVerdict
  /** The salary figure, editable */
  salaryAmount: ReactNode
  salaryNote?: ReactNode
  onAddSalary: () => void
  livingNote: ReactNode
  cash: number
  livingThisMonth: number | null
  periodName: string
}) {
  const { salary, fixed, living, invest, out, net } = flow
  const scale = Math.max(salary, out)
  const inParts: Part[] = [
    { label: 'Salary', note: salaryNote, amount: salary, color: 'var(--color-gain)' },
    ...(net < 0 ? [{ label: 'From cash', note: 'Spendable cash covers the rest', amount: -net, color: CASH }] : []),
  ]
  /** Set amounts first; Living last, as it is the one that moves during the month */
  const parts: Part[] = [
    { label: 'Fixed bills', note: <Link to="/spend/recurring" className="font-semibold text-link hover:underline">Recurring bills in Spend</Link>, amount: fixed, color: 'var(--color-loss)' },
    { label: 'Invest', note: 'Your DCA plans', amount: invest, color: 'var(--color-invest)' },
    {
      label: 'Living',
      note: livingThisMonth !== null && living > 0 ? (
        <>
          <span className="tnum">{thb(livingThisMonth)}</span> spent so far in {periodName}
          <br />
          {livingNote}
        </>
      ) : livingNote,
      amount: living,
      color: livingThisMonth !== null && livingThisMonth > living ? 'var(--color-loss)' : 'var(--color-warn)',
    },
  ]

  return (
    <Card className="card-bleed-mobile animate-rise">
      <CardHeader title="This month" />
      {salary <= 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-muted">Monthly salary</span>
            {salaryAmount}
          </div>
          <button onClick={onAddSalary} className="mt-1 text-sm font-semibold text-link hover:underline cursor-pointer">
            Add your salary to see where it goes
          </button>
        </div>
      ) : (
        <>
          <Verdict verdict={verdict} cash={cash} />

          <p className="mt-5 border-t border-line pt-4 text-xs font-semibold text-ink-muted">Money in and out</p>
          <div className="mt-3 space-y-2">
            <StackBar label="In" parts={inParts} scale={scale} />
            <StackBar label="Out" parts={parts} scale={scale} />
          </div>
          <ul className="mt-3">
            {inParts.map((p) => (
              <Row
                key={p.label}
                dot={<span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />}
                label={p.label}
                note={p.note}
                amount={p.label === 'Salary' ? salaryAmount : money(thb(p.amount))}
              />
            ))}
          </ul>
          <ul className="mt-1 border-t border-line pt-1">
            {parts.map((p) => (
              <Row
                key={p.label}
                dot={<span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />}
                label={p.label}
                note={p.note}
                amount={money(<>−{thb(p.amount)}</>)}
              />
            ))}
          </ul>
          {net > 0 && (
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
              <span className="text-sm font-semibold text-ink">Left over</span>
              <span className="font-display text-sm font-extrabold tnum text-gain-ink">{thb(net)}</span>
            </div>
          )}

        </>
      )}
    </Card>
  )
}
