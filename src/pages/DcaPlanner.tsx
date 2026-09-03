import React, { useRef, useState } from 'react'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { DcaForm } from '../components/forms/DcaForm'
import { ConfirmDcaBuyForm } from '../components/forms/ConfirmDcaBuyForm'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { CheckCircleIcon, CheckIcon, DcaIcon, PencilIcon, TrashIcon } from '../components/icons'
import { IconButton } from '../components/ui/IconButton'
import { AssetLogo } from '../components/ui/AssetLogo'
import {
  ASSET_META, dcaThisMonth, isBuyDayOverdue, isBuyDayToday, isConfirmedForPeriod, isSkippedForPeriod,
  nextBuyDate, shouldConfirmBuy, sortDcaPlans,
} from '../lib/calc'
import type { DcaPlan, FixedCostItem } from '../lib/types'
import { daysUntil, localDateStr, ordinal, thb } from '../lib/format'

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

// ─── Budget Bar ──────────────────────────────────────────────────────────────

interface BudgetSegment {
  pct: number
  amount: number
  label: string
  textColor: string
  bg: string
  barColor: string
  isStriped?: boolean
}

function BudgetBar({ salary, fixed, savings }: { salary: number; fixed: number; savings: number }) {
  if (salary <= 0) return null

  const totalAllocated = fixed + savings
  const isOverflow = totalAllocated > salary
  const cashDrawdown = isOverflow ? totalAllocated - salary : 0

  // Dual-Source Bar:
  // If isOverflow: total bar scale = totalAllocated (100% of planned deployment)
  // If not: total bar scale = salary
  const barScale = isOverflow ? totalAllocated : salary
  const salaryPct = Math.min(100, (salary / barScale) * 100)

  // Breakdowns from salary
  const fixedFromSalary = Math.min(fixed, salary)
  const savingsFromSalary = Math.max(0, Math.min(savings, salary - fixedFromSalary))
  const remainingSalary = Math.max(0, salary - fixedFromSalary - savingsFromSalary)

  // Striped pattern for cash reserve injection (high contrast in both light & dark mode)
  const cashBarColor =
    'repeating-linear-gradient(-45deg, var(--color-brand) 0px, var(--color-brand) 6px, color-mix(in srgb, var(--color-brand) 35%, white) 6px, color-mix(in srgb, var(--color-brand) 35%, white) 12px)'

  const segments: BudgetSegment[] = isOverflow
    ? [
        {
          pct: (fixed / totalAllocated) * 100,
          amount: fixed,
          label: 'Fixed',
          textColor: 'var(--color-loss)',
          bg: 'var(--color-loss-soft)',
          barColor: 'var(--color-loss)',
        },
        {
          pct: (savingsFromSalary / totalAllocated) * 100,
          amount: savingsFromSalary,
          label: 'Savings (Salary)',
          textColor: 'var(--color-gain)',
          bg: 'var(--color-gain-soft)',
          barColor: 'var(--color-cash)',
        },
        {
          pct: (cashDrawdown / totalAllocated) * 100,
          amount: cashDrawdown,
          label: 'From Cash',
          textColor: 'var(--color-brand-ink)',
          bg: 'var(--color-brand-soft)',
          barColor: cashBarColor,
          isStriped: true,
        },
      ].filter((s) => s.pct > 0)
    : [
        {
          pct: (fixed / salary) * 100,
          amount: fixed,
          label: 'Fixed',
          textColor: 'var(--color-loss)',
          bg: 'var(--color-loss-soft)',
          barColor: 'var(--color-loss)',
        },
        {
          pct: (savings / salary) * 100,
          amount: savings,
          label: 'Savings',
          textColor: 'var(--color-gain)',
          bg: 'var(--color-gain-soft)',
          barColor: 'var(--color-cash)',
        },
        {
          pct: (remainingSalary / salary) * 100,
          amount: remainingSalary,
          label: 'Free',
          textColor: 'var(--color-ink-faint)',
          bg: 'var(--color-surface-muted)',
          barColor: 'var(--color-ink-faint)',
        },
      ].filter((s) => s.pct > 0)

  return (
    <div className="mt-5">
      {/* Labels: each section has the same proportional width as its bar segment */}
      <div className="flex mb-2.5">
        {segments.map((seg) => (
          <div key={seg.label} style={{ width: `${seg.pct}%` }} className="flex justify-center min-w-0">
            <div
              className="rounded-xl px-2 py-1.5 text-center min-h-[46px] flex flex-col justify-center max-w-full overflow-hidden"
              style={{ background: seg.bg }}
            >
              <p className="text-[10px] font-semibold leading-none truncate" style={{ color: seg.textColor }}>
                {seg.label}
              </p>
              <p className="mt-1 font-display text-[13px] font-extrabold tnum leading-none" style={{ color: seg.textColor }}>
                {seg.isStriped ? `+${thb(seg.amount)}` : thb(seg.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bar */}
      <div className="flex h-4 overflow-hidden rounded-full bg-surface-muted gap-0.5">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${seg.pct}%`,
              background: seg.barColor,
            }}
          />
        ))}
      </div>

      {/* Salary boundary bracket (Idea 1: Monthly Salary span) */}
      {isOverflow && (
        <div className="mt-2 text-[11px] text-ink-muted">
          <div
            style={{ width: `${salaryPct}%` }}
            className="border-b-2 border-l border-r border-line-strong rounded-b-md pt-1 pb-0.5 text-center transition-all duration-500"
          >
            <span className="font-semibold text-ink-soft">Monthly Salary ({thb(salary)})</span>
          </div>
        </div>
      )}

      {/* Explanatory summary note */}
      {isOverflow && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2 text-[12px] text-ink-muted">
          <span className="text-[13px] mt-0.5">💡</span>
          <p className="leading-snug">
            <span className="font-semibold text-ink">Total planned: {thb(totalAllocated)}</span>
            {' '}— includes <span className="font-semibold text-gain">{thb(savings)}</span> in savings/investments
            (<span className="text-gain">{thb(savingsFromSalary)} from salary</span> + <span className="font-semibold text-brand dark:text-brand-ink">+{thb(cashDrawdown)} from cash</span>).
          </p>
        </div>
      )}
    </div>
  )
}


// ─── Inline edit stat (salary) ────────────────────────────────────────────────

function InlineEditStat({ label, value, editing, draft, inputRef, onOpen, onDraftChange, onCommit, onCancel, hint }: {
  label: string; value: string; editing: boolean; draft: string
  inputRef: React.RefObject<HTMLInputElement>
  onOpen: () => void; onDraftChange: (v: string) => void
  onCommit: () => void; onCancel: () => void; hint?: string
}) {
  return (
    <div>
      <p className="text-[12px] font-medium text-ink-muted">{label}</p>
      {editing ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-ink-muted">฿</span>
          <input
            ref={inputRef} type="number" min="0" value={draft}
            aria-label={label}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
            className="w-36 rounded-lg border border-brand bg-surface px-2.5 py-1 text-[15px] font-bold tnum text-ink outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      ) : (
        <button
          onClick={onOpen}
          aria-label={`Edit ${label}`}
          className="group mt-1 flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors hover:bg-surface-muted min-h-[40px]"
        >
          <span className="font-display text-[22px] font-extrabold tnum text-ink leading-none">{value}</span>
          <PencilIcon className="h-3.5 w-3.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
      {hint && !editing && <p className="mt-0.5 text-[11.5px] text-ink-faint">{hint}</p>}
    </div>
  )
}


// ─── Fixed cost item row ──────────────────────────────────────────────────────

function FixedCostRow({ item, onEdit, onDelete }: {
  item: FixedCostItem; onEdit: (item: FixedCostItem) => void; onDelete: (id: string) => void
}) {
  return (
    <div className="group flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="text-[14px] font-medium text-ink">{item.name}</span>
      </div>
      <span className="font-display text-[14px] font-bold tnum text-ink">{thb(item.amount)}</span>
      <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
        <IconButton
          icon={<PencilIcon className="h-3.5 w-3.5" />}
          label={`Edit fixed cost ${item.name}`}
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item)}
        />
        <IconButton
          icon={<TrashIcon className="h-3.5 w-3.5" />}
          label={`Delete fixed cost ${item.name}`}
          variant="danger"
          size="sm"
          onClick={() => onDelete(item.id)}
        />
      </div>
    </div>
  )
}

// ─── Fixed cost inline form ───────────────────────────────────────────────────

function FixedCostForm({ initial, onSave, onCancel }: {
  initial?: FixedCostItem; onSave: (name: string, amount: number) => void; onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '')
  const nameRef = useRef<HTMLInputElement>(null)
  React.useEffect(() => { nameRef.current?.focus() }, [])

  function submit() {
    const a = parseFloat(amount)
    if (!name.trim() || isNaN(a) || a <= 0) return
    onSave(name.trim(), a)
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5">
      <input
        ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Name (e.g. Rent)"
        className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-ink-faint"
      />
      <div className="flex items-center gap-1">
        <span className="text-[12px] text-ink-muted">฿</span>
        <input
          type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
          placeholder="0"
          className="w-24 bg-transparent text-right text-[13px] font-bold tnum text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
      <button onClick={submit}
        className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-bold text-white dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] transition-colors hover:bg-brand-ink active:scale-95">
        Save
      </button>
      <button onClick={onCancel}
        className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-line">
        Cancel
      </button>
    </div>
  )
}

// ─── Section header with toggle ───────────────────────────────────────────────

function SectionHeader({ label, total, open, onToggle, action }: {
  label: string; total: number; open: boolean; onToggle: () => void; action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onToggle}
        aria-label={`Toggle ${label} section, total ${thb(total)}`}
        aria-expanded={open}
        className="flex items-center gap-2 group cursor-pointer"
      >
        <div className="text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
          <p className="mt-0.5 font-display text-[20px] font-extrabold tnum text-ink leading-none">
            {thb(total)}
          </p>
        </div>
        <ChevronIcon open={open} />
      </button>
      {action}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DcaPlanner() {
  const {
    steps,
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  } = usePageGuide('dca')
  const {
    data, setMonthlyIncome,
    upsertFixedCostItem, removeFixedCostItem,
    skipDcaBuy,
  } = useData()
  const { showToast } = useToast()

  // Salary edit
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryDraft, setSalaryDraft] = useState('')
  const salaryRef = useRef<HTMLInputElement>(null)

  // Section expand state — default collapsed
  const [fixedOpen, setFixedOpen] = useState(false)
  const [savingsOpen, setSavingsOpen] = useState(true)

  // Fixed cost item editing
  const [editingItem, setEditingItem] = useState<FixedCostItem | null>(null)
  const [addingItem, setAddingItem] = useState(false)

  // DCA form
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DcaPlan | null>(null)

  // Confirm buy form
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState<DcaPlan | null>(null)

  const fixedItems = [...(data.fixedCostItems ?? [])].sort((a, b) => b.amount - a.amount)
  const fixedTotal = fixedItems.reduce((s, x) => s + x.amount, 0)
  const dcaMonth   = dcaThisMonth(data.dcaPlans)
  const savingsTotal = dcaMonth.total
  const salary = data.monthlyIncome

  // DCA plans sorted by: 1. Overdue / near to the due, 2. Value
  const plans = sortDcaPlans(data.dcaPlans)

  // ── Salary handlers ──
  function openSalaryEdit() {
    setSalaryDraft(salary > 0 ? String(salary) : '')
    setEditingSalary(true)
    setTimeout(() => salaryRef.current?.select(), 0)
  }
  function commitSalary() {
    const v = parseFloat(salaryDraft.replace(/,/g, ''))
    if (!isNaN(v) && v >= 0) setMonthlyIncome(v)
    setEditingSalary(false)
  }

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (p: DcaPlan) => { setEditing(p); setFormOpen(true) }

  return (
    <>
      <PageHeader
        eyebrow="Strategy"
        title="Planner"
        subtitle="Your monthly money breakdown."
        onStartGuide={startTour}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Salary Budget & Fixed Costs */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* ── Income + Budget Bar ── */}
          <div id="guide-dca-summary">
            <Card className="animate-rise">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <InlineEditStat
                  label="Monthly Salary"
                  value={salary > 0 ? thb(salary) : '-'}
                  editing={editingSalary}
                  draft={salaryDraft}
                  inputRef={salaryRef}
                  onOpen={openSalaryEdit}
                  onDraftChange={setSalaryDraft}
                  onCommit={commitSalary}
                  onCancel={() => setEditingSalary(false)}
                  hint={salary <= 0 ? 'Tap to set your salary' : undefined}
                />
                {salary > 0 && fixedTotal + savingsTotal > salary && (
                  <div className="text-right">
                    <p className="text-[12px] font-medium text-ink-muted">Total Planned</p>
                    <p className="mt-1 font-display text-[22px] font-extrabold tnum text-ink leading-none">
                      {thb(fixedTotal + savingsTotal)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] font-semibold text-brand dark:text-brand-ink">
                      +{thb(fixedTotal + savingsTotal - salary)} from Cash
                    </p>
                  </div>
                )}
              </div>
              {salary > 0 && <BudgetBar salary={salary} fixed={fixedTotal} savings={savingsTotal} />}
              {salary <= 0 && (
                <button onClick={openSalaryEdit} className="mt-4 text-[13px] font-semibold text-brand hover:underline cursor-pointer">
                  + Add monthly salary to see breakdown
                </button>
              )}
            </Card>
          </div>

          {/* ── Fixed Costs ── */}
          <div id="guide-dca-transfers">
            <Card className="animate-rise">
            <SectionHeader
              label="Fixed Costs"
              total={fixedTotal}
              open={fixedOpen}
              onToggle={() => setFixedOpen((v) => !v)}
              action={
                fixedOpen && !addingItem && !editingItem ? (
                  <button
                    onClick={() => setAddingItem(true)}
                    aria-label="Add fixed expense"
                    className="inline-flex items-center gap-1.5 rounded-full border border-loss/30 bg-loss-soft px-3 py-1.5 text-[12px] font-semibold text-loss transition-colors hover:bg-loss/20 active:scale-95 cursor-pointer"
                  >
                    + Add expense
                  </button>
                ) : null
              }
            />

            {fixedOpen && (
              <div className="mt-4">
                {fixedItems.length === 0 && !addingItem && (
                  <p className="text-[13px] text-ink-muted">No fixed costs yet. Add things like rent, bills, or family support.</p>
                )}

                {fixedItems.length > 0 && (
                  <div className="divide-y divide-line">
                    {fixedItems.map((item) =>
                      editingItem?.id === item.id ? (
                        <div key={item.id} className="py-2">
                          <FixedCostForm
                            initial={item}
                            onSave={(name, amount) => {
                              upsertFixedCostItem({ id: item.id, name, amount })
                              showToast(`Updated "${name}"`, 'success')
                              setEditingItem(null)
                            }}
                            onCancel={() => setEditingItem(null)}
                          />
                        </div>
                      ) : (
                        <FixedCostRow
                          key={item.id}
                          item={item}
                          onEdit={setEditingItem}
                          onDelete={(id) => {
                            removeFixedCostItem(id)
                            showToast(`Removed "${item.name}"`, 'info')
                          }}
                        />
                      )
                    )}
                  </div>
                )}

                {addingItem && (
                  <div className="mt-3">
                    <FixedCostForm
                      onSave={(name, amount) => {
                        upsertFixedCostItem({ name, amount })
                        showToast(`Added "${name}"`, 'success')
                        setAddingItem(false)
                      }}
                      onCancel={() => setAddingItem(false)}
                    />
                  </div>
                )}

                {fixedItems.length > 0 && (
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <span className="text-[12.5px] font-semibold text-ink-muted">Total fixed</span>
                    <span className="font-display text-[15px] font-extrabold tnum text-ink">{thb(fixedTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Right Column (7 cols): Savings & Invest / DCA Plans */}
      <div id="guide-dca-plans" className="lg:col-span-7 xl:col-span-8 space-y-6">
        {/* ── Savings & Invest ── */}
        <Card className="animate-rise overflow-hidden" padded={false}>
            <div className="p-5">
              <SectionHeader
                label="Savings & Invest"
                total={savingsTotal}
                open={savingsOpen}
                onToggle={() => setSavingsOpen((v) => !v)}
                action={
                  savingsOpen ? (
                    <button
                      onClick={openAdd}
                      aria-label="Add DCA investment plan"
                      className="inline-flex items-center gap-1.5 rounded-full border border-gain/30 bg-gain-soft px-3 py-1.5 text-[12px] font-semibold text-gain transition-colors hover:bg-gain/20 active:scale-95 cursor-pointer"
                    >
                      + Add plan
                    </button>
                  ) : null
                }
              />
            </div>

            {savingsOpen && (
              <div className="border-t border-line">
                  {plans.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        icon={<DcaIcon className="h-6 w-6" />}
                        title="No invest plans yet"
                        description="Add recurring buys to track your dollar-cost averaging."
                        accent="var(--color-brand)"
                        action={
                          <button
                            onClick={openAdd}
                            className="inline-flex items-center gap-1.5 rounded-full border border-gain/30 bg-gain-soft px-3.5 py-1.5 text-[12.5px] font-semibold text-gain transition-colors hover:bg-gain/20 cursor-pointer"
                          >
                            + Add plan
                          </button>
                        }
                      />
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {plans.map((p) => {
                        const meta = ASSET_META[p.assetClass]
                        const confirmed = isConfirmedForPeriod(p)
                        const skipped = isSkippedForPeriod(p)
                        const isOverdue = isBuyDayOverdue(p) && !confirmed && !skipped
                        const isToday = isBuyDayToday(p) && !confirmed && !skipped
                        const needsAction = shouldConfirmBuy(p)
                        const next = nextBuyDate(p)
                        const days = daysUntil(localDateStr(next))

                        const isRecent = (dates: string[] | undefined) => {
                          if (!dates || dates.length === 0) return false
                          const latestStr = dates[0]
                          let latestMs = 0
                          if (latestStr.includes('T') || latestStr.includes(':')) {
                            latestMs = new Date(latestStr).getTime()
                          } else {
                            const [y, m, d] = latestStr.split('-').map(Number)
                            latestMs = new Date(y, m - 1, d).getTime()
                          }
                          const diffMs = Date.now() - latestMs
                          return diffMs > 0 && diffMs <= 3600000
                        }
                        const showConfirmed = confirmed && isRecent(p.confirmedDates)

                        return (
                          <li key={p.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => openEdit(p)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(p) } }}
                              aria-label={`Edit ${p.name}`}
                              className="flex cursor-pointer items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            >
                              <AssetLogo
                                name={p.name}
                                assetClass={p.assetClass}
                                size="md"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-[14.5px] font-semibold text-ink">{p.name}</p>
                                  <p className="shrink-0 font-display text-[15px] font-extrabold tnum text-ink">
                                    {thb(p.monthlyAmount)}
                                  </p>
                                </div>
                                  <div className="mt-1 flex items-center justify-between gap-2 text-[12px]">
                                    <span className="text-ink-muted">
                                      {meta.label} · {freqLabel(p)}
                                    </span>
                                  {showConfirmed && !skipped ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-gain-soft px-2 py-0.5 text-[11px] font-semibold text-gain">
                                      <CheckIcon className="h-3 w-3" strokeWidth={2.4} /> Confirmed
                                    </span>
                                  ) : isOverdue ? (
                                    <span className="inline-block text-[11px] font-bold text-loss">Overdue</span>
                                  ) : isToday || days <= 0 ? (
                                    <span className="inline-block text-[11px] font-bold text-warn">Today</span>
                                  ) : days < 3 ? (
                                    <span className="inline-block text-[11px] font-semibold text-warn">
                                      {days === 1 ? 'Tomorrow' : `in ${days} days`}
                                    </span>
                                  ) : (
                                    <span className="inline-block text-[11px] font-semibold text-stocks">in {days} days</span>
                                  )}
                                  </div>
                                  {needsAction && (
                                    <div id="guide-dca-confirm" className="mt-2 flex items-center gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setConfirming(p); setConfirmOpen(true) }}
                                        aria-label={`Confirm DCA buy for ${p.name}`}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-[#00de9b] hover:bg-[#00c58a] text-[#052e21] px-3.5 py-1.5 text-[12px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer min-h-[34px]"
                                      >
                                        <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                                        <span>{p.assetClass === 'cash' ? 'Confirm Deposit' : 'Confirm Buy'}</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          skipDcaBuy(p.id, localDateStr())
                                          showToast(`Skipped DCA buy for "${p.name}" this period`, 'info')
                                        }}
                                        aria-label={`Skip DCA buy for ${p.name} this period`}
                                        className="inline-flex items-center rounded-full border border-line-strong bg-surface hover:bg-surface-muted text-ink-muted hover:text-ink px-3.5 py-1.5 text-[12px] font-semibold active:scale-95 transition-all cursor-pointer min-h-[34px]"
                                      >
                                        Skip
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    {/* Footer */}
                    {plans.length > 0 && (
                      <div className="flex items-center border-t border-line py-4 px-5 bg-surface-muted/30">
                        <div>
                          <p className="text-[11.5px] text-ink-muted">Invest rate</p>
                          <p className="font-display text-[17px] font-extrabold tnum leading-tight mt-0.5">
                            {salary > 0 ? (
                              <>
                                <span className="text-gain">{Math.round((savingsTotal / salary) * 100)}%</span>
                                <span className="text-[13px] font-medium text-ink dark:text-white ml-1.5">
                                  of Monthly Income
                                </span>
                              </>
                            ) : (
                              <span className="text-[13px] text-ink-muted font-normal">
                                Set monthly income above to see invest rate
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
              )}
            </Card>
          </div>
        </div>

        <DcaForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
        <ConfirmDcaBuyForm
          open={confirmOpen}
          plan={confirming}
          onClose={() => setConfirmOpen(false)}
        />

        <GuideTour
          isOpen={isRunning}
          steps={steps}
          currentStepIndex={currentStepIndex}
          onNext={nextStep}
          onPrev={prevStep}
          onClose={endTour}
          onFinish={finishTour}
        />
      </>
    )
  }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function freqLabel(p: { frequency?: string; dayOfMonth: number }): string {
  const freq = p.frequency ?? 'monthly'
  if (freq === 'daily')  return 'Every day'
  if (freq === 'weekly') return `Every ${WEEKDAY_NAMES[p.dayOfMonth] ?? 'week'}`
  return `Buys on the ${ordinal(p.dayOfMonth)}`
}

