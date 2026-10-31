import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../../components/ui/Card'
import type { FlowVerdict, MonthlyFlow } from '../../modules/spend/monthlyFlow'
import { thb } from '../../lib/format'

/** Bar fill: solid inside the salary, striped past it (that part is paid from cash) */
const stripes = (color: string) =>
  `repeating-linear-gradient(-45deg, ${color} 0px, ${color} 5px, color-mix(in srgb, ${color} 30%, transparent) 5px, color-mix(in srgb, ${color} 30%, transparent) 10px)`

interface Step {
  label: string
  note?: ReactNode
  amount: number
  /** Shown in place of the amount (the editable salary) */
  amountNode?: ReactNode
  /** Where the bar starts, in baht from the left */
  from: number
  color: string
  sign: '' | '−'
}

function StepRow({ step, scale, salary }: { step: Step; scale: number; salary: number }) {
  const pct = (v: number) => (scale > 0 ? (v / scale) * 100 : 0)
  const end = step.from + step.amount
  const solid = Math.max(0, Math.min(end, salary) - step.from)
  const over = step.amount - solid
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: step.color }} aria-hidden="true" />
          <span className="truncate text-sm font-semibold text-ink">{step.label}</span>
        </span>
        {step.amountNode ?? (
          <span className="shrink-0 font-display text-sm font-extrabold tnum text-ink">
            {step.sign}{thb(step.amount)}
          </span>
        )}
      </div>
      {step.note && <p className="mt-0.5 pl-[18px] text-xs text-ink-muted">{step.note}</p>}
      <div className="relative mt-2 h-2.5 rounded-full bg-surface-muted" aria-hidden="true">
        {step.amount > 0 && (
          <div
            className="absolute inset-y-0 flex overflow-hidden rounded-full transition-all duration-500"
            style={{ left: `${pct(step.from)}%`, width: `${pct(step.amount)}%` }}
          >
            {solid > 0 && <div className="h-full" style={{ width: `${(solid / step.amount) * 100}%`, background: step.color }} />}
            {over > 0 && <div className="h-full flex-1" style={{ background: stripes(step.color) }} />}
          </div>
        )}
        {/* Where the salary ends, once the plan goes past it */}
        {scale > salary && salary > 0 && (
          <div className="absolute -inset-y-1 w-0.5 rounded-full bg-ink-muted" style={{ left: `calc(${pct(salary)}% - 1px)` }} />
        )}
      </div>
    </li>
  )
}

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
      line = <>Your cash of <span className="font-semibold text-ink tnum">{thb(cash)}</span> covers the gap.</>
      break
    case 'low':
      label = 'Top up from cash this month'
      figure = thb(verdict.topUp)
      tone = 'text-warn-ink'
      chip = <span className={`${CHIP} bg-warn-soft text-warn-ink`}>Cash lasts only {months(verdict.runwayMonths)}</span>
      line = verdict.dcaNotEnough
        ? 'Bills and living alone are more than your salary, so cutting DCA won\'t close the gap.'
        : <>Cut DCA by <span className="font-semibold text-ink tnum">{thb(verdict.cut)}</span> a month to stop topping up.</>
      break
    case 'short':
      label = 'Cut DCA this month by'
      figure = thb(verdict.cut)
      tone = 'text-loss-ink'
      chip = <span className={`${CHIP} bg-loss-soft text-loss-ink`}>Cash can't cover {thb(verdict.topUp)}</span>
      line = verdict.dcaNotEnough
        ? 'Even with no DCA, bills and living are more than salary and cash.'
        : <>You have <span className="font-semibold text-ink tnum">{thb(Math.max(0, cash))}</span> in cash for a <span className="tnum">{thb(verdict.topUp)}</span> gap.</>
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

/** Salary at the top, each outflow as a step down, then what is left or what cash has to cover. */
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
  const { salary, fixed, living, invest } = flow
  const scale = Math.max(salary, flow.out)
  const steps: Step[] = [
    { label: 'Salary', note: salaryNote, amount: salary, amountNode: salaryAmount, from: 0, color: 'var(--color-gain)', sign: '' },
    { label: 'Fixed bills', note: 'Recurring bills in Spend', amount: fixed, from: 0, color: 'var(--color-loss)', sign: '−' },
    { label: 'Living', note: livingNote, amount: living, from: fixed, color: 'var(--color-warn)', sign: '−' },
    { label: 'Invest', note: 'Your DCA plans', amount: invest, from: fixed + living, color: 'var(--color-invest)', sign: '−' },
  ]
  const livingPct = living > 0 && livingThisMonth !== null ? Math.min(100, (livingThisMonth / living) * 100) : 0

  return (
    <Card className="animate-rise">
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
          <ul className="mt-1">
            {steps.map((s) => <StepRow key={s.label} step={s} scale={scale} salary={salary} />)}
          </ul>

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
