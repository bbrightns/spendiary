import React, { useRef, useState } from 'react'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressBar } from '../components/ui/ProgressBar'
import { AddButton } from '../components/ui/AddButton'
import { DcaForm } from '../components/forms/DcaForm'
import { ConfirmDcaBuyForm } from '../components/forms/ConfirmDcaBuyForm'
import { CheckIcon, DcaIcon, PencilIcon } from '../components/icons'
import { ASSET_META, dcaThisMonth, isConfirmedForPeriod, nextBuyDate, planBoughtThisMonth, planExecutionsThisMonth, shouldConfirmBuy } from '../lib/calc'
import type { DcaPlan } from '../lib/types'
import { daysUntil, ordinal, pct, thb } from '../lib/format'

export function DcaPlanner() {
  const { data, setMonthlyIncome, setMonthlyFixedCost } = useData()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DcaPlan | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState<DcaPlan | null>(null)
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryDraft, setSalaryDraft] = useState('')
  const salaryInputRef = useRef<HTMLInputElement>(null)
  const [editingFixed, setEditingFixed] = useState(false)
  const [fixedDraft, setFixedDraft] = useState('')
  const fixedInputRef = useRef<HTMLInputElement>(null)

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (p: DcaPlan) => {
    setEditing(p)
    setFormOpen(true)
  }

  const month = dcaThisMonth(data.dcaPlans)
  const fixedCost = data.monthlyFixedCost ?? 0
  const disposable = data.monthlyIncome > 0 ? data.monthlyIncome - fixedCost : 0
  const savingsRate = disposable > 0 ? (month.total / disposable) * 100 : null
  const remaining = data.monthlyIncome > 0 ? Math.max(0, data.monthlyIncome - fixedCost - month.total) : null

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

  function openFixedEdit() {
    setFixedDraft(fixedCost > 0 ? String(fixedCost) : '')
    setEditingFixed(true)
    setTimeout(() => fixedInputRef.current?.select(), 0)
  }

  function commitFixed() {
    const v = parseFloat(fixedDraft.replace(/,/g, ''))
    if (!isNaN(v) && v >= 0) setMonthlyFixedCost(v)
    setEditingFixed(false)
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
              <AddButton onClick={openAdd} label="Add DCA plan" />
            }
          />
        </Card>
        <DcaForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      </>
    )
  }

  // Sort: upcoming buys first (by next date), then already-bought.
  const plans = [...data.dcaPlans].sort((a, b) => {
    const aExec = planExecutionsThisMonth(a)
    const bExec = planExecutionsThisMonth(b)
    // Put plans with 0 executions (upcoming) first
    if ((aExec === 0) !== (bExec === 0)) return aExec === 0 ? -1 : 1
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

        {/* Salary + fixed cost + savings-rate strip */}
        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-5">
          {/* Salary */}
          <InlineEditStat
            label="Monthly Salary"
            value={data.monthlyIncome > 0 ? thb(data.monthlyIncome) : '—'}
            editing={editingSalary}
            draft={salaryDraft}
            inputRef={salaryInputRef}
            onOpen={openSalaryEdit}
            onDraftChange={setSalaryDraft}
            onCommit={commitSalary}
            onCancel={() => setEditingSalary(false)}
          />

          {/* Fixed cost */}
          <InlineEditStat
            label="Fixed Cost"
            value={fixedCost > 0 ? thb(fixedCost) : '—'}
            editing={editingFixed}
            draft={fixedDraft}
            inputRef={fixedInputRef}
            onOpen={openFixedEdit}
            onDraftChange={setFixedDraft}
            onCommit={commitFixed}
            onCancel={() => setEditingFixed(false)}
          />

          {/* Invest rate + remaining */}
          {savingsRate !== null && remaining !== null && (
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
                  {thb(remaining)}
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
                    {meta.label} · {freqLabel(p)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-display text-[16px] font-bold tnum text-ink">
                      {thb(p.monthlyAmount)}
                      <span className="ml-1 text-[11px] font-medium text-ink-faint">
                        /{(p.frequency ?? 'monthly') === 'daily' ? 'day' : (p.frequency ?? 'monthly') === 'weekly' ? 'wk' : 'mo'}
                      </span>
                    </p>
                    {isConfirmedForPeriod(p) ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-gain-soft px-2 py-0.5 text-[11.5px] font-semibold text-gain">
                        <CheckIcon className="h-3 w-3" strokeWidth={2.4} /> Confirmed
                      </span>
                    ) : bought ? (
                      <span className="mt-0.5 inline-block text-[11.5px] font-semibold text-ink-muted">
                        Due now
                      </span>
                    ) : (
                      <span className="mt-0.5 inline-block text-[11.5px] font-semibold text-ink-muted">
                        {days <= 0 ? 'Today' : `in ${days}d`}
                      </span>
                    )}
                  </div>
                  {shouldConfirmBuy(p) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirming(p); setConfirmOpen(true) }}
                      className="shrink-0 rounded-xl bg-brand px-3 py-2 text-[12px] font-bold text-white transition-colors hover:bg-brand-ink active:scale-95"
                    >
                      Confirm buy
                    </button>
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
      <ConfirmDcaBuyForm open={confirmOpen} plan={confirming} onClose={() => setConfirmOpen(false)} />
    </>
  )
}

const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function freqLabel(p: { frequency?: string; dayOfMonth: number }): string {
  const freq = p.frequency ?? 'monthly'
  if (freq === 'daily')   return 'Every day'
  if (freq === 'weekly')  return `Every ${WEEKDAY_NAMES[p.dayOfMonth] ?? 'week'}`
  return `Buys on the ${ordinal(p.dayOfMonth)}`
}

function InlineEditStat({
  label, value, editing, draft, inputRef, onOpen, onDraftChange, onCommit, onCancel,
}: {
  label: string
  value: string
  editing: boolean
  draft: string
  inputRef: React.RefObject<HTMLInputElement>
  onOpen: () => void
  onDraftChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[12.5px] font-medium text-ink-muted">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-ink-muted">฿</span>
          <input
            ref={inputRef}
            type="number"
            min="0"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommit()
              if (e.key === 'Escape') onCancel()
            }}
            className="w-32 rounded-lg border border-brand bg-white px-2.5 py-1 text-[14px] font-bold tnum text-ink outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      ) : (
        <button
          onClick={onOpen}
          className="group flex items-center gap-1.5 rounded-lg px-2 py-0.5 transition-colors hover:bg-surface-muted"
        >
          <span className="font-display text-[16px] font-bold tnum text-ink">{value}</span>
          <PencilIcon className="h-3.5 w-3.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
    </div>
  )
}
