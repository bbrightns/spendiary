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

import { AssetLogo } from '../components/ui/AssetLogo'
import {
  ASSET_META, buyDayPassedThisPeriod, dcaThisMonth, isConfirmedForPeriod, isSkippedForPeriod,
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

function BudgetBar({ salary, fixed, savings }: { salary: number; fixed: number; savings: number }) {
  if (salary <= 0) return null
  const total = salary
  const remaining = Math.max(0, total - fixed - savings)

  const fixedPct   = Math.min((fixed   / total) * 100, 100)
  const savingsPct = Math.min((savings / total) * 100, Math.max(0, 100 - fixedPct))
  const freePct    = Math.max(0, (remaining / total) * 100)

  const segments = [
    { pct: fixedPct,   amount: fixed,     label: 'Fixed',   textColor: 'var(--color-loss)',      bg: 'var(--color-loss-soft)',      barColor: 'var(--color-loss)' },
    { pct: savingsPct, amount: savings,   label: 'Savings', textColor: 'var(--color-gain)',      bg: 'var(--color-gain-soft)',      barColor: 'var(--color-cash)' },
    { pct: freePct,    amount: remaining, label: 'Free',    textColor: 'var(--color-ink-faint)', bg: 'var(--color-surface-muted)', barColor: 'var(--color-ink-faint)' },
  ].filter((s) => s.pct > 0)

  return (
    <div className="mt-5">
      {/* Labels: each section has the same proportional width as its bar segment */}
      <div className="flex mb-2.5">
        {segments.map((seg) => (
          <div key={seg.label} style={{ width: `${seg.pct}%` }} className="flex justify-center">
            <div className="rounded-xl px-2.5 py-1.5 text-center" style={{ background: seg.bg }}>
              <p className="text-[10px] font-semibold leading-none" style={{ color: seg.textColor }}>{seg.label}</p>
              <p className="mt-1 font-display text-[13px] font-extrabold tnum leading-none" style={{ color: seg.textColor }}>{thb(seg.amount)}</p>
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
            style={{ width: `${seg.pct}%`, background: seg.barColor }}
          />
        ))}
      </div>
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
        <button onClick={() => onEdit(item)}
          aria-label={`Edit fixed cost ${item.name}`}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center">
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onDelete(item.id)}
          aria-label={`Delete fixed cost ${item.name}`}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-loss-soft hover:text-loss cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center">
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
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
              <div className="flex flex-wrap items-start justify-between gap-6">
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
                    className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors active:scale-95 cursor-pointer"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--color-loss) 35%, transparent)',
                      color: 'var(--color-loss)',
                      background: 'var(--color-loss-soft)',
                    }}
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
                      className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors active:scale-95 cursor-pointer"
                      style={{
                        borderColor: 'color-mix(in srgb, var(--color-gain) 35%, transparent)',
                        color: 'var(--color-gain)',
                        background: 'var(--color-gain-soft)',
                      }}
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
                            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors cursor-pointer"
                            style={{
                              borderColor: 'color-mix(in srgb, var(--color-gain) 35%, transparent)',
                              color: 'var(--color-gain)',
                              background: 'var(--color-gain-soft)',
                            }}
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
                        const bought = buyDayPassedThisPeriod(p)
                        const confirmed = isConfirmedForPeriod(p)
                        const skipped = isSkippedForPeriod(p)
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
                                  ) : bought && !confirmed && !skipped ? (
                                    <span className="inline-block text-[11px] font-bold text-loss">Overdue</span>
                                  ) : days < 3 ? (
                                    <span className="inline-block text-[11px] font-semibold text-warn">
                                      {days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`}
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
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#00de9b] px-3 py-1.5 text-[12px] font-bold text-[#052e21] transition-all hover:bg-[#38efb6] active:scale-95 cursor-pointer shadow-xs min-h-[36px]"
                                      >
                                        <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                                        <span>Confirm Buy</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          skipDcaBuy(p.id, localDateStr())
                                          showToast(`Skipped DCA buy for "${p.name}" this period`, 'info')
                                        }}
                                        aria-label={`Skip DCA buy for ${p.name} this period`}
                                        className="rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors active:scale-95 cursor-pointer text-ink-muted border-line hover:bg-surface-muted hover:text-ink min-h-[36px]"
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
                      <div className="flex flex-wrap items-center gap-6 border-t border-line py-4 px-5 bg-surface-muted/30">
                        <div>
                          <p className="text-[11.5px] text-ink-muted">Total savings</p>
                          <p className="font-display text-[17px] font-extrabold tnum text-ink">{thb(savingsTotal)}</p>
                        </div>
                        {salary > 0 && (
                          <>
                            <div className="h-7 w-px bg-line" />
                            <div>
                              <p className="text-[11.5px] text-ink-muted">Invest rate</p>
                              <p className="font-display text-[17px] font-extrabold tnum text-gain">
                                {Math.round((savingsTotal / salary) * 100)}%
                              </p>
                            </div>
                            <div className="h-7 w-px bg-line" />
                            <div>
                              <p className="text-[11.5px] text-ink-muted">Progress this month</p>
                              <p className="font-display text-[17px] font-extrabold tnum text-ink">
                                {Math.round(dcaMonth.pct)}%
                              </p>
                            </div>
                          </>
                        )}
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

