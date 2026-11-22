import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../../components/ui/Card'
import type { FlowVerdict, MonthlyFlow } from '../../modules/spend/monthlyFlow'
import { thb } from '../../lib/format'

/** Segment fill past the salary line (that part is paid from cash) */
const stripes = (color: string) =>
  `repeating-linear-gradient(-45deg, ${color} 0px, ${color} 5px, color-mix(in srgb, ${color} 30%, transparent) 5px, color-mix(in srgb, ${color} 30%, transparent) 10px)`

interface Part {
  label: string
  note?: ReactNode
  amount: number
  color: string
}

/** Salary vs. outflows on one bar: fixed, living and invest stacked from the left, a line where the salary ends. */
function FlowBar({ parts, salary }: { parts: Part[]; salary: number }) {
  const out = parts.reduce((s, p) => s + p.amount, 0)
  const scale = Math.max(salary, out)
  const pct = (v: number) => (scale > 0 ? (v / scale) * 100 : 0)
  let from = 0
  return (
    <div className="relative mt-3 h-3 rounded-full bg-surface-muted" aria-hidden="true">
      <div className="absolute inset-0 flex overflow-hidden rounded-full">
        {parts.map((p) => {
          const start = from
          from += p.amount
          const solid = Math.max(0, Math.min(from, salary) - start)
          if (p.amount <= 0) return null
          return (
            <div key={p.label} className="flex h-full transition-all duration-500" style={{ width: `${pct(p.amount)}%` }}>
              {solid > 0 && <div className="h-full" style={{ width: `${(solid / p.amount) * 100}%`, background: p.color }} />}
              {p.amount - solid > 0 && <div className="h-full flex-1" style={{ background: stripes(p.color) }} />}
            </div>
          )
        })}
      </div>
      {out > salary && (
        <div className="absolute -inset-y-1 w-0.5 rounded-full bg-ink" style={{ left: `calc(${pct(salary)}% - 1px)` }} />
      )}
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

/** The verdict, then salary vs. outflows on one stacked bar, with the numbers listed underneath. */
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
  const { salary, fixed, living, invest, net } = flow
  const parts: Part[] = [
    { label: 'Fixed bills', note: 'Recurring bills in Spend', amount: fixed, color: 'var(--color-loss)' },
    { label: 'Living', note: livingNote, amount: living, color: 'var(--color-warn)' },
    { label: 'Invest', note: 'Your DCA plans', amount: invest, color: 'var(--color-invest)' },
  ]
  const livingPct = living > 0 && livingThisMonth !== null ? Math.min(100, (livingThisMonth / living) * 100) : 0

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

          <p className="mt-5 border-t border-line pt-4 text-xs font-semibold text-ink-muted">Where your salary goes</p>
          <FlowBar parts={parts} salary={salary} />
          {net < 0 && (
            <p className="mt-2 text-xs text-ink-muted">The line is your salary. Striped = paid from cash.</p>
          )}
          <ul className="mt-2">
            <Row
              dot={<span className="h-3.5 w-0.5 rounded-full bg-ink" />}
              label="Salary"
              note={salaryNote}
              amount={salaryAmount}
            />
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
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
            <span className="text-sm font-semibold text-ink">{net < 0 ? 'From cash' : 'Left over'}</span>
            <span className={`font-display text-sm font-extrabold tnum ${net < 0 ? 'text-ink' : 'text-gain-ink'}`}>{thb(Math.abs(net))}</span>
          </div>

          {livingThisMonth !== null && living > 0 && (
            <Link to="/spend/analysis" className="mt-3 block rounded-2xl border border-line p-3 transition-colors hover:bg-surface-muted/60">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-ink-muted">Living · {periodName}</span>
                <span className="shrink-0 text-sm font-semibold text-link">Spend →</span>
              </span>
              <span className="mt-1 block text-sm text-ink tnum">
                <span className="font-display font-extrabold">{thb(livingThisMonth)}</span>
                <span className="text-ink-muted"> of {thb(living)}</span>
              </span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                <span
                  className="block h-full rounded-full transition-all duration-500"
                  style={{ width: `${livingPct}%`, background: livingThisMonth > living ? 'var(--color-loss)' : 'var(--color-warn)' }}
                />
              </span>
            </Link>
          )}
        </>
      )}
    </Card>
  )
}
