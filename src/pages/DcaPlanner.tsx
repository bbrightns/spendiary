import { useRef, useState } from 'react'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressBar } from '../components/ui/ProgressBar'
import { AddButton } from '../components/ui/AddButton'
import { DcaForm } from '../components/forms/DcaForm'
import { CheckIcon, DcaIcon, PencilIcon, SparkleIcon } from '../components/icons'
import { ASSET_META, dcaThisMonth, nextBuyDate, planBoughtThisMonth } from '../lib/calc'
import type { DcaPlan } from '../lib/types'
import { daysUntil, ordinal, pct, thb } from '../lib/format'

export function DcaPlanner() {
  const { data, loadSample, setMonthlyIncome } = useData()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DcaPlan | null>(null)
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryDraft, setSalaryDraft] = useState('')
  const salaryInputRef = useRef<HTMLInputElement>(null)

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (p: DcaPlan) => {
    setEditing(p)
    setFormOpen(true)
  }

  const month = dcaThisMonth(data.dcaPlans)
  const savingsRate = data.monthlyIncome > 0 ? (month.total / data.monthlyIncome) * 100 : null

  function openSalaryEdit() {
    setSalaryDraft(data.monthlyIncome > 0 ? String(data.monthlyIncome) : '')
    setEditingSalary(true)
    setTimeout(() => salaryInputRef.current?.select(), 0)
  }

  function commitSalary() {
    const v = parseFloat(salaryDraft.replace(/,/g, ''))
    if (!isNaN(v) && v >= 0) setMonthlyIncome(v)
    setEditingSalary(false)
  }

  if (data.dcaPlans.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Strategy" title="DCA Planner" />
        <Card>
          <EmptyState
            icon={<DcaIcon className="h-7 w-7" />}
            title="No DCA plans yet"
            description="Add your recurring monthly buys to see everything you're dollar-cost-averaging into, and the total per month."
            accent="var(--color-brand)"
            action={
              <div className="flex flex-col items-center gap-3">
                <AddButton onClick={openAdd} label="Add DCA plan" />
                <button
                  onClick={loadSample}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
                >
                  <SparkleIcon className="h-4 w-4" />
                  or load sample plan
                </button>
              </div>
            }
          />
        </Card>
        <DcaForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      </>
    )
  }

  // Sort: upcoming buys first (by next date), then already-bought.
  const plans = [...data.dcaPlans].sort((a, b) => {
    const aDone = planBoughtThisMonth(a)
    const bDone = planBoughtThisMonth(b)
    if (aDone !== bDone) return aDone ? 1 : -1
    return a.dayOfMonth - b.dayOfMonth
  })

  return (
    <>
      <PageHeader
        eyebrow="Strategy"
        title="DCA Planner"
        subtitle="Everything you buy on autopilot each month."
        action={<AddButton onClick={openAdd} label="Add plan" />}
      />

      {/* Monthly total hero */}
      <Card className="animate-rise">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[13px] font-medium text-ink-muted">Total DCA / month</p>
            <p className="mt-2 font-display text-[34px] font-extrabold leading-none tracking-tight tnum text-ink sm:text-[40px]">
              {thb(month.total)}
            </p>
            <p className="mt-2 text-[13px] text-ink-muted">
              across {month.count} plan{month.count > 1 ? 's' : ''}
            </p>
          </div>
          <div className="min-w-[180px] flex-1 sm:max-w-[260px]">
            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
              <span className="font-medium text-ink-soft">Bought this month</span>
              <span className="font-semibold tnum text-ink">{pct(month.pct, 0)}</span>
            </div>
            <ProgressBar value={month.pct} />
            <div className="mt-2 flex items-center justify-between text-[12.5px] text-ink-muted">
              <span className="tnum">{thb(month.invested)} done</span>
              <span className="tnum">{thb(month.upcoming)} upcoming</span>
            </div>
          </div>
        </div>

        {/* Salary + savings-rate strip */}
        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-5">
          {/* Salary */}
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] font-medium text-ink-muted">Monthly Salary</p>
            {editingSalary ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-ink-muted">฿</span>
                <input
                  ref={salaryInputRef}
                  type="number"
                  min="0"
                  aria-label="Monthly salary in THB"
                  value={salaryDraft}
                  onChange={(e) => setSalaryDraft(e.target.value)}
                  onBlur={commitSalary}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitSalary()
                    if (e.key === 'Escape') setEditingSalary(false)
                  }}
                  className="w-32 rounded-lg border border-brand bg-white px-2.5 py-1 text-[14px] font-bold tnum text-ink outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            ) : (
              <button
                onClick={openSalaryEdit}
                className="group flex items-center gap-1.5 rounded-lg px-2 py-0.5 transition-colors hover:bg-surface-muted"
              >
                <span className="font-display text-[16px] font-bold tnum text-ink">
                  {data.monthlyIncome > 0 ? thb(data.monthlyIncome) : '—'}
                </span>
                <PencilIcon className="h-3.5 w-3.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
          </div>

          {/* Savings rate */}
          {savingsRate !== null && (
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[12.5px] font-medium text-ink-muted">Invest Rate</p>
                <p className="mt-0.5 font-display text-[22px] font-extrabold tnum text-ink leading-none">
                  {pct(savingsRate, 1)}
                </p>
              </div>
              <div className="h-10 w-px bg-line" />
              <div>
                <p className="text-[12.5px] font-medium text-ink-muted">Remaining</p>
                <p className="mt-0.5 font-display text-[22px] font-extrabold tnum text-ink-soft leading-none">
                  {thb(Math.max(0, data.monthlyIncome - month.total))}
                </p>
              </div>
            </div>
          )}

          {savingsRate === null && (
            <button
              onClick={openSalaryEdit}
              className="text-[13px] font-semibold text-brand hover:underline"
            >
              Add monthly salary to track invest rate
            </button>
          )}
        </div>
      </Card>

      {/* Plan list */}
      <Card className="mt-5 animate-rise" padded={false}>
        <ul className="divide-y divide-line">
          {plans.map((p) => {
            const meta = ASSET_META[p.assetClass]
            const bought = planBoughtThisMonth(p)
            const next = nextBuyDate(p)
            const days = daysUntil(next.toISOString().slice(0, 10))
            return (
              <li
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => openEdit(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openEdit(p)
                  }
                }}
                className="flex cursor-pointer items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-6"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, white)` }}
                >
                  <DcaIcon className="h-[19px] w-[19px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{p.name}</p>
                  <p className="text-[12.5px] text-ink-muted">
                    {meta.label} · buys on the {ordinal(p.dayOfMonth)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-[16px] font-bold tnum text-ink">{thb(p.monthlyAmount)}</p>
                  {bought ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-gain-soft px-2 py-0.5 text-[11.5px] font-semibold text-gain">
                      <CheckIcon className="h-3 w-3" strokeWidth={2.4} /> Bought
                    </span>
                  ) : (
                    <span className="mt-0.5 inline-block text-[11.5px] font-semibold text-ink-muted">
                      {days <= 0 ? 'Today' : `in ${days}d`}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-line px-5 py-4 sm:px-6">
          <span className="text-[14px] font-semibold text-ink">Total committed</span>
          <span className="font-display text-[18px] font-extrabold tnum text-ink">
            {thb(month.total)}
            <span className="text-[13px] font-medium text-ink-muted"> / mo</span>
          </span>
        </div>
      </Card>

      <DcaForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
    </>
  )
}
