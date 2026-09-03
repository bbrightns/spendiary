import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { DragHandleIcon, PlusIcon, TrashIcon, WalletIcon } from '../icons'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { CashAccount, CashAccountCategory, CashPayoutSchedule } from '../../lib/types'
import {
  CASH_CATEGORIES,
  calculateMonthlyCashInterest,
  detectBankPreset,
  inferCashCategory,
} from '../../lib/calc'
import { thb } from '../../lib/format'

interface Props {
  open: boolean
  onClose: () => void
  initialAccountId?: string | null
}

interface Draft {
  id: string
  name: string
  balance: string
  currency: 'THB' | 'USD'
  category: CashAccountCategory
  interestRate: string
  payoutSchedule: CashPayoutSchedule
  payoutMonths: number[]
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const QUICK_PRESETS = [
  { name: 'Kept', rate: '2.22', category: 'emergency' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'Click', rate: '1.50', category: 'emergency' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'Dime THB', rate: '3.00', category: 'invest' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'Dime USD', currency: 'USD' as const, category: 'invest' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [] },
  { name: 'TrueMoney', category: 'spending' as CashAccountCategory, schedule: 'monthly' as CashPayoutSchedule, months: [] },
  { name: 'KBank', category: 'spending' as CashAccountCategory, schedule: 'semi_annual' as CashPayoutSchedule, months: [6, 12] },
  { name: 'SCB', category: 'spending' as CashAccountCategory, schedule: 'semi_annual' as CashPayoutSchedule, months: [6, 12] },
  { name: 'ออมทรัพย์ หุ้น (สหกรณ์)', rate: '5.50', category: 'locked' as CashAccountCategory, schedule: 'annual' as CashPayoutSchedule, months: [2] },
  { name: 'กองทุนสำรองเลี้ยงชีพ', category: 'locked' as CashAccountCategory, schedule: 'annual' as CashPayoutSchedule, months: [] },
]

function tempId(): string {
  return `tmp-${Math.random().toString(36).slice(2, 9)}`
}

function formatWithCommas(value: string | number): string {
  const s = String(value)
  let clean = s.replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('')
  }
  const cleanParts = clean.split('.')
  const integerPart = cleanParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (cleanParts.length > 1) {
    return `${integerPart}.${cleanParts[1].slice(0, 2)}`
  }
  return integerPart
}

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180 text-brand' : 'text-ink-muted'}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

export function CashAccountsForm({ open, onClose, initialAccountId }: Props) {
  const { data, setCashAccounts, usdThb } = useData()
  const { showToast } = useToast()
  const [rows, setRows] = useState<Draft[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<CashAccountCategory | 'all'>('all')
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const balanceInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  useEffect(() => {
    if (!open) {
      setHighlightedId(null)
      setExpandedId(null)
      setActiveCategoryFilter('all')
      return
    }
    setRows(
      data.cashAccounts.length > 0
        ? data.cashAccounts.map((a) => {
            const inferred = inferCashCategory(a.name)
            const cat = a.category ?? inferred
            const schedule = a.payoutSchedule ?? (a.payoutMonths && a.payoutMonths.length > 0 ? 'custom' : 'monthly')
            const months = a.payoutMonths && a.payoutMonths.length > 0
              ? a.payoutMonths
              : schedule === 'semi_annual'
                ? [6, 12]
                : schedule === 'annual'
                  ? [2]
                  : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
            return {
              id: a.id,
              name: a.name,
              balance: formatWithCommas(a.balance),
              currency: a.currency ?? 'THB',
              category: cat,
              interestRate: a.interestRate !== undefined ? String(a.interestRate) : '',
              payoutSchedule: schedule,
              payoutMonths: months,
            }
          })
        : [{
            id: tempId(),
            name: '',
            balance: '',
            currency: 'THB',
            category: 'spending',
            interestRate: '',
            payoutSchedule: 'monthly',
            payoutMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          }],
    )

    if (initialAccountId) {
      setHighlightedId(initialAccountId)
      const timer = setTimeout(() => {
        const input = balanceInputRefs.current.get(initialAccountId)
        if (input) {
          input.focus()
          input.select()
          input.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 80)
      const clearTimer = setTimeout(() => {
        setHighlightedId(null)
      }, 2200)
      return () => {
        clearTimeout(timer)
        clearTimeout(clearTimer)
      }
    }
  }, [open, data.cashAccounts, initialAccountId])

  const rate = usdThb && usdThb > 0 ? usdThb : 35

  const totalThb = rows.reduce((sum, r) => {
    const clean = r.balance.replace(/[^0-9.]/g, '')
    const val = clean === '' ? 0 : Number(clean)
    return sum + (r.currency === 'USD' ? val * rate : val)
  }, 0)

  // Multi-currency sub-totals
  const thbOnlyTotal = rows.reduce((sum, r) => {
    if (r.currency !== 'THB') return sum
    const clean = r.balance.replace(/[^0-9.]/g, '')
    return sum + (clean === '' ? 0 : Number(clean))
  }, 0)

  const usdOnlyTotal = rows.reduce((sum, r) => {
    if (r.currency !== 'USD') return sum
    const clean = r.balance.replace(/[^0-9.]/g, '')
    return sum + (clean === '' ? 0 : Number(clean))
  }, 0)

  // Liquidity breakdown
  const categoryTotals: Record<CashAccountCategory, number> = {
    spending: 0,
    emergency: 0,
    invest: 0,
    locked: 0,
  }
  for (const r of rows) {
    const clean = r.balance.replace(/[^0-9.]/g, '')
    const val = clean === '' ? 0 : Number(clean)
    const thbVal = r.currency === 'USD' ? val * rate : val
    categoryTotals[r.category] = (categoryTotals[r.category] ?? 0) + thbVal
  }

  // Monthly yield calculations for all rows
  const simulatedAccounts: CashAccount[] = rows.map((r) => {
    const clean = r.balance.replace(/[^0-9.]/g, '')
    const rateNum = r.interestRate.trim() !== '' ? Number(r.interestRate) : undefined
    return {
      id: r.id,
      name: r.name,
      balance: clean === '' ? 0 : Number(clean),
      currency: r.currency,
      category: r.category,
      interestRate: rateNum !== undefined && !isNaN(rateNum) && rateNum > 0 ? rateNum : undefined,
      payoutSchedule: r.payoutSchedule,
      payoutMonths: r.payoutMonths,
    }
  })

  const interestSummary = calculateMonthlyCashInterest(simulatedAccounts, usdThb)
  const hasAnyInterest = interestSummary.totalAnnual > 0

  const update = (id: string, patch: Partial<Draft>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const add = () => {
    const id = tempId()
    setRows((rs) => [
      ...rs,
      {
        id,
        name: '',
        balance: '',
        currency: 'THB',
        category: 'spending',
        interestRate: '',
        payoutSchedule: 'monthly',
        payoutMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
    ])
    setTimeout(() => {
      const nameInput = nameInputRefs.current.get(id)
      if (nameInput) {
        nameInput.focus()
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 50)
  }

  const addPreset = (p: (typeof QUICK_PRESETS)[0]) => {
    const id = tempId()
    const newDraft: Draft = {
      id,
      name: p.name,
      balance: '',
      currency: p.currency ?? 'THB',
      category: p.category,
      interestRate: p.rate ?? '',
      payoutSchedule: p.schedule ?? 'monthly',
      payoutMonths: p.months && p.months.length > 0 ? p.months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    }
    setRows((rs) => [...rs, newDraft])
    setExpandedId(id)
    setTimeout(() => {
      const balanceInput = balanceInputRefs.current.get(id)
      if (balanceInput) {
        balanceInput.focus()
        balanceInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 60)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const pos = e.clientY < midY ? 'top' : 'bottom'

    if (dragOverIdx !== index || dropPosition !== pos) {
      setDragOverIdx(index)
      setDropPosition(pos)
    }
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIdx === null) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      setDropPosition(null)
      return
    }

    let insertIndex = targetIndex
    if (dropPosition === 'bottom') {
      insertIndex += 1
    }
    if (draggedIdx < insertIndex) {
      insertIndex -= 1
    }

    if (draggedIdx !== insertIndex) {
      setRows((prev) => {
        const next = [...prev]
        const [moved] = next.splice(draggedIdx, 1)
        next.splice(insertIndex, 0, moved)
        return next
      })
    }

    setDraggedIdx(null)
    setDragOverIdx(null)
    setDropPosition(null)
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
    setDragOverIdx(null)
    setDropPosition(null)
  }

  function save() {
    const cleaned: CashAccount[] = rows
      .filter((r) => r.name.trim() !== '')
      .map((r) => {
        const clean = r.balance.replace(/[^0-9.]/g, '')
        const rateNum = r.interestRate.trim() !== '' ? Number(r.interestRate) : undefined
        return {
          id: r.id.startsWith('tmp-') ? tempId().replace('tmp-', 'cash-') : r.id,
          name: r.name.trim(),
          balance: clean === '' ? 0 : Number(clean),
          currency: r.currency,
          category: r.category,
          interestRate: rateNum !== undefined && !isNaN(rateNum) && rateNum > 0 ? rateNum : undefined,
          payoutSchedule: r.payoutSchedule,
          payoutMonths: r.payoutMonths && r.payoutMonths.length > 0 ? r.payoutMonths : undefined,
        }
      })
    setCashAccounts(cleaned)
    showToast('Cash accounts updated', 'success')
    onClose()
  }

  const filteredRows = activeCategoryFilter === 'all'
    ? rows
    : rows.filter((r) => r.category === activeCategoryFilter)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Cash & Liquidity Accounts"
      description="Track cash balances, interest yields, and organize liquidity buckets."
      footer={
        <div className="space-y-3">
          {/* Dual Currency & Total Summary */}
          <div className="rounded-xl bg-surface-muted p-3 border border-line/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
                <WalletIcon className="h-[17px] w-[17px] text-cash" />
                Total Cash
              </span>
              <span className="font-display text-[18px] font-extrabold tnum text-ink">{thb(totalThb)}</span>
            </div>

            {/* Currency Subtotals if both THB and USD exist */}
            {usdOnlyTotal > 0 && (
              <div className="flex items-center justify-between text-[11.5px] text-ink-muted border-t border-line/40 pt-1.5">
                <span>Currency Breakdown</span>
                <span className="tnum font-medium">
                  THB: {thb(thbOnlyTotal)} • USD: ${usdOnlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (≈ {thb(usdOnlyTotal * rate)})
                </span>
              </div>
            )}

            {/* Liquidity Tiers Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
              {(['spending', 'emergency', 'invest', 'locked'] as CashAccountCategory[]).map((catKey) => {
                const meta = CASH_CATEGORIES[catKey]
                const val = categoryTotals[catKey]
                return (
                  <div key={catKey} className="flex flex-col rounded-lg bg-surface/70 px-2 py-1 border border-line/30">
                    <span className="text-ink-muted flex items-center gap-1 truncate font-medium">
                      <span>{meta.icon}</span>
                      <span className="truncate">{meta.labelTh}</span>
                    </span>
                    <span className="font-display font-bold tnum text-ink text-[12px] mt-0.5">
                      {thb(val)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Passive Yield Forecast Pill */}
            {hasAnyInterest && (
              <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 space-y-1 text-[12px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>💰</span>
                    <span>ดอกเบี้ยรับรวมคาดการณ์: <strong>{thb(interestSummary.totalAnnual)} / ปี</strong></span>
                    <span className="text-[11px] opacity-75 font-normal">(เฉลี่ยเดือนละ {thb(interestSummary.totalAnnual / 12)})</span>
                  </span>
                  {interestSummary.totalCompounded > interestSummary.totalAnnual + 1 && (
                    <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md self-start sm:self-auto">
                      ทบต้นเพิ่ม ≈ +{thb(interestSummary.totalCompounded - interestSummary.totalAnnual)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1 border-t border-emerald-500/15 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                  <span>💡 ดอกเบี้ยจะถูกทบเข้าเป็นเงินต้นในบัญชีให้อัตโนมัติ</span>
                  {/* Mini monthly payout indicators */}
                  <div className="flex items-center gap-1">
                    {THAI_MONTHS_SHORT.map((mName, idx) => {
                      const mNum = idx + 1
                      const payoutThisMonth = interestSummary.byMonth[mNum] ?? 0
                      const hasPayout = payoutThisMonth > 0
                      return (
                        <div
                          key={mNum}
                          title={`${mName}: ${hasPayout ? thb(payoutThisMonth) : 'ไม่มีดอกเบี้ยเข้า'}`}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-all ${
                            hasPayout
                              ? 'bg-emerald-500 text-white shadow-2xs'
                              : 'bg-surface-muted text-ink-muted/40'
                          }`}
                        >
                          {mName.slice(0, 1)}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button onClick={save} className="w-full">
            Save accounts
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pb-1 text-[12px]">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
              activeCategoryFilter === 'all'
                ? 'bg-ink text-surface shadow-xs'
                : 'bg-surface-muted text-ink-muted hover:text-ink'
            }`}
          >
            All ({rows.length})
          </button>
          {(['spending', 'emergency', 'invest', 'locked'] as CashAccountCategory[]).map((catKey) => {
            const meta = CASH_CATEGORIES[catKey]
            const count = rows.filter((r) => r.category === catKey).length
            const isSelected = activeCategoryFilter === catKey
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setActiveCategoryFilter(catKey)}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-brand text-white shadow-xs font-semibold'
                    : 'bg-surface-muted text-ink-muted hover:text-ink'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.labelTh}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Account Rows List */}
        {filteredRows.map((r) => {
          const index = rows.findIndex((item) => item.id === r.id)
          const isDragging = draggedIdx === index
          const isOver = dragOverIdx === index
          const showTopLine = isOver && dropPosition === 'top' && !isDragging
          const showBottomLine = isOver && dropPosition === 'bottom' && !isDragging
          const isHighlighted = highlightedId === r.id
          const isExpanded = expandedId === r.id

          const preset = detectBankPreset(r.name)
          const cleanBal = r.balance.replace(/[^0-9.]/g, '')
          const balNum = cleanBal === '' ? 0 : Number(cleanBal)
          const rateNum = r.interestRate.trim() !== '' ? Number(r.interestRate) : 0
          const thbEquivalent = r.currency === 'USD' ? balNum * rate : balNum
          const annualEarned = (rateNum > 0 && thbEquivalent > 0) ? (thbEquivalent * (rateNum / 100)) : 0

          return (
            <div
              key={r.id}
              draggable={activeCategoryFilter === 'all'}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative rounded-xl border border-line/60 bg-surface transition-all duration-200 ${
                isDragging ? 'opacity-30 scale-[0.98]' : ''
              } ${
                isHighlighted
                  ? 'ring-2 ring-brand/70 bg-brand-soft/40 shadow-xs'
                  : 'hover:border-line-strong'
              }`}
            >
              {/* Insertion lines for drag */}
              {showTopLine && (
                <div className="absolute -top-2 left-0 right-0 z-10 flex items-center">
                  <div className="h-2 w-2 rounded-full bg-brand" />
                  <div className="h-0.5 flex-1 bg-brand" />
                  <div className="h-2 w-2 rounded-full bg-brand" />
                </div>
              )}
              {showBottomLine && (
                <div className="absolute -bottom-2 left-0 right-0 z-10 flex items-center">
                  <div className="h-2 w-2 rounded-full bg-brand" />
                  <div className="h-0.5 flex-1 bg-brand" />
                  <div className="h-2 w-2 rounded-full bg-brand" />
                </div>
              )}

              {/* Main row card content */}
              <div className="p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  {/* Drag handle */}
                  {activeCategoryFilter === 'all' && (
                    <div
                      className="grid h-10 w-5 shrink-0 cursor-grab active:cursor-grabbing place-items-center text-ink-muted hover:text-ink select-none"
                      title="Drag to reorder"
                    >
                      <DragHandleIcon className="h-4 w-4" />
                    </div>
                  )}

                  {/* Institution brand avatar / icon */}
                  {preset ? (
                    <div
                      title={`สถาบัน: ${preset.name}`}
                      className="h-8 w-8 rounded-xl text-[11px] font-extrabold shrink-0 flex items-center justify-center select-none shadow-2xs"
                      style={{ background: preset.bg, color: preset.color, border: `1px solid ${preset.color}35` }}
                    >
                      {preset.shortName}
                    </div>
                  ) : (
                    <div
                      title="บัญชีทั่วไป"
                      className="h-8 w-8 rounded-xl bg-surface-muted border border-line/50 text-ink-muted text-[11px] font-bold shrink-0 flex items-center justify-center"
                    >
                      <WalletIcon className="h-4 w-4 opacity-50" />
                    </div>
                  )}

                  {/* Name input */}
                  <input
                    ref={(el) => {
                      if (el) nameInputRefs.current.set(r.id, el)
                      else nameInputRefs.current.delete(r.id)
                    }}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-muted/40 px-3 text-[14.5px] font-semibold text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/15"
                    placeholder="ชื่อบัญชี / สถาบัน"
                    value={r.name}
                    onChange={(e) => {
                      const newName = e.target.value
                      const patch: Partial<Draft> = { name: newName }
                      if (!r.category || r.category === 'spending') {
                        patch.category = inferCashCategory(newName)
                      }
                      update(r.id, patch)
                    }}
                  />

                  {/* Balance input with currency toggle */}
                  <div className="relative w-[130px] sm:w-[160px] shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        update(r.id, { currency: r.currency === 'USD' ? 'THB' : 'USD' })
                      }
                      aria-label={`Toggle currency for ${r.name || 'account'}, currently ${r.currency}`}
                      className={`absolute left-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-[12px] font-extrabold transition-all select-none cursor-pointer ${
                        r.currency === 'USD'
                          ? 'bg-sky-500/15 text-sky-500 hover:bg-sky-500/25 ring-1 ring-sky-500/30'
                          : 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30'
                      }`}
                      title="คลิกเพื่อสลับสกุลเงิน (THB / USD)"
                    >
                      {r.currency === 'USD' ? '$' : '฿'}
                    </button>
                    <input
                      ref={(el) => {
                        if (el) balanceInputRefs.current.set(r.id, el)
                        else balanceInputRefs.current.delete(r.id)
                      }}
                      type="text"
                      inputMode="decimal"
                      className="h-10 w-full rounded-xl border border-line bg-surface-muted/40 pl-9 pr-2.5 text-[14px] font-bold tnum text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/15"
                      placeholder="0.00"
                      value={r.balance}
                      onChange={(e) =>
                        update(r.id, { balance: formatWithCommas(e.target.value) })
                      }
                    />
                  </div>

                  {/* Expand / Details Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    aria-label={`Toggle yield settings for ${r.name || 'account'}`}
                    className={`grid h-10 w-8 shrink-0 place-items-center rounded-xl transition-colors cursor-pointer ${
                      isExpanded ? 'bg-brand/10 text-brand' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                    }`}
                    title="Configure Category & Yield / Payout Schedule"
                  >
                    <CaretIcon open={isExpanded} />
                  </button>

                  {/* Trash delete button */}
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    aria-label={`Remove account ${r.name || ''}`}
                    className="grid h-10 w-8 shrink-0 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-loss-soft hover:text-loss cursor-pointer"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Subtitle Information Bar */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-[11.5px] text-ink-muted">
                  <div className="flex items-center gap-2">
                    {/* Category pill */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(r.id)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium transition-colors hover:bg-surface-muted border border-line/40 cursor-pointer"
                    >
                      <span>{CASH_CATEGORIES[r.category]?.icon}</span>
                      <span>{CASH_CATEGORIES[r.category]?.labelTh}</span>
                    </button>

                    {/* Yield / Interest snippet */}
                    {rateNum > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        <span>📈 {rateNum.toFixed(2)}%</span>
                        <span>• ≈ {thb(annualEarned)}/yr</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpandedId(r.id)}
                        className="text-[11px] text-ink-muted/70 hover:text-brand hover:underline cursor-pointer"
                      >
                        + Add interest rate
                      </button>
                    )}
                  </div>

                  {/* USD FX live conversion note */}
                  {r.currency === 'USD' && balNum > 0 && (
                    <span className="font-mono text-ink-muted text-[11px]">
                      ≈ {thb(balNum * rate)} <span className="opacity-60">(@{rate.toFixed(2)})</span>
                    </span>
                  )}
                </div>

                {/* ── EXPANDED DRAWER: Yield & Category Settings ── */}
                {isExpanded && (
                  <div className="mt-2 pt-2.5 border-t border-line/40 space-y-3 bg-surface-muted/30 rounded-xl p-3">
                    {/* 1. Category Selection */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block mb-1.5">
                        หมวดหมู่ / วัตถุประสงค์
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(['spending', 'emergency', 'invest', 'locked'] as CashAccountCategory[]).map((catKey) => {
                          const meta = CASH_CATEGORIES[catKey]
                          const isCatActive = r.category === catKey
                          return (
                            <button
                              key={catKey}
                              type="button"
                              onClick={() => update(r.id, { category: catKey })}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all text-left cursor-pointer border ${
                                isCatActive
                                  ? 'bg-brand text-white border-brand shadow-xs font-semibold'
                                  : 'bg-surface text-ink-muted border-line/60 hover:text-ink hover:border-line'
                              }`}
                            >
                              <span className="text-base">{meta.icon}</span>
                              <span className="truncate">{meta.labelTh}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* 2. Yield Booster & Payout Schedule */}
                    <div className="space-y-2.5 pt-1 border-t border-line/30">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[12.5px] font-bold text-ink">
                            Yield Booster (อัตราดอกเบี้ย & รอบการจ่าย)
                          </span>
                          <p className="text-[11px] text-ink-muted">
                            คำนวณผลตอบแทนและปฏิทินกระแสเงินสดดอกเบี้ยรับ
                          </p>
                        </div>

                        {/* Interest Rate % Input */}
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`rate-${r.id}`} className="text-[12px] font-medium text-ink-muted">
                            อัตราดอกเบี้ย:
                          </label>
                          <div className="relative w-24">
                            <input
                              id={`rate-${r.id}`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={r.interestRate}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, '')
                                update(r.id, { interestRate: clean })
                              }}
                              className="h-8 w-full rounded-lg border border-line bg-surface px-2.5 pr-6 text-[13px] font-bold tnum text-ink outline-none focus:border-brand"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink-muted pointer-events-none">
                              %
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Payout Schedule Presets (No Parentheses) */}
                      <div>
                        <span className="text-[11px] font-semibold text-ink-muted block mb-1">
                          รอบดอกเบี้ยเข้าบัญชี:
                        </span>
                        <div className="flex flex-wrap gap-1.5 text-[12px]">
                          <button
                            type="button"
                            onClick={() =>
                              update(r.id, {
                                payoutSchedule: 'monthly',
                                payoutMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                              r.payoutSchedule === 'monthly'
                                ? 'bg-ink text-surface border-ink font-bold shadow-2xs'
                                : 'bg-surface text-ink-muted border-line/60 hover:text-ink hover:border-line'
                            }`}
                          >
                            ทุกเดือน
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              update(r.id, {
                                payoutSchedule: 'semi_annual',
                                payoutMonths: [6, 12],
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                              r.payoutSchedule === 'semi_annual'
                                ? 'bg-ink text-surface border-ink font-bold shadow-2xs'
                                : 'bg-surface text-ink-muted border-line/60 hover:text-ink hover:border-line'
                            }`}
                          >
                            ปีละ 2 ครั้ง
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              update(r.id, {
                                payoutSchedule: 'annual',
                                payoutMonths: r.payoutMonths.length > 0 ? [r.payoutMonths[0]] : [2],
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                              r.payoutSchedule === 'annual'
                                ? 'bg-ink text-surface border-ink font-bold shadow-2xs'
                                : 'bg-surface text-ink-muted border-line/60 hover:text-ink hover:border-line'
                            }`}
                          >
                            ปีละ 1 ครั้ง
                          </button>
                          <button
                            type="button"
                            onClick={() => update(r.id, { payoutSchedule: 'custom' })}
                            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                              r.payoutSchedule === 'custom'
                                ? 'bg-ink text-surface border-ink font-bold shadow-2xs'
                                : 'bg-surface text-ink-muted border-line/60 hover:text-ink hover:border-line'
                            }`}
                          >
                            กำหนดเอง
                          </button>
                        </div>
                      </div>

                      {/* Interactive Month Selection Pills (Replaces unreadable dropdown) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11.5px] text-ink-muted">
                          <span>
                            {r.payoutSchedule === 'annual'
                              ? 'แตะเลือกเดือนที่ดอกเบี้ยเข้า:'
                              : r.payoutSchedule === 'semi_annual'
                              ? 'ดอกเบี้ยเข้าเดือน มิ.ย. และ ธ.ค.:'
                              : r.payoutSchedule === 'monthly'
                              ? 'ดอกเบี้ยเข้าทุกเดือน (ม.ค. - ธ.ค.):'
                              : 'แตะเลือกเดือนที่ดอกเบี้ยเข้า (เลือกได้หลายเดือน):'}
                          </span>
                          {r.payoutSchedule === 'annual' && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {THAI_MONTHS_SHORT[(r.payoutMonths[0] ?? 2) - 1]}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-[11px]">
                          {THAI_MONTHS_SHORT.map((mName, idx) => {
                            const mNum = idx + 1
                            const isSelected = r.payoutMonths.includes(mNum)
                            const isInteractive = r.payoutSchedule === 'annual' || r.payoutSchedule === 'custom'

                            return (
                              <button
                                key={mNum}
                                type="button"
                                disabled={!isInteractive}
                                onClick={() => {
                                  if (r.payoutSchedule === 'annual') {
                                    update(r.id, { payoutMonths: [mNum] })
                                  } else if (r.payoutSchedule === 'custom') {
                                    const next = isSelected
                                      ? r.payoutMonths.filter((m) => m !== mNum)
                                      : [...r.payoutMonths, mNum].sort((a, b) => a - b)
                                    update(r.id, { payoutMonths: next })
                                  }
                                }}
                                className={`py-1.5 rounded-lg font-bold transition-all border ${
                                  isSelected
                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-2xs scale-105'
                                    : 'bg-surface text-ink-muted border-line hover:text-ink hover:border-line-strong'
                                } ${isInteractive ? 'cursor-pointer' : 'opacity-80 cursor-default'}`}
                              >
                                {mName}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Live Calculation Preview Box for this account */}
                      {rateNum > 0 && balNum > 0 && (
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-[12px] space-y-1.5 text-emerald-700 dark:text-emerald-300">
                          <div className="flex flex-wrap items-center justify-between gap-1 font-semibold">
                            <span>
                              {r.payoutSchedule === 'monthly'
                                ? `💰 ได้รับดอกเบี้ยประมาณ ${thb(annualEarned / 12)} / เดือน`
                                : r.payoutSchedule === 'semi_annual'
                                ? `💰 ได้รับดอกเบี้ยประมาณ ${thb(annualEarned / 2)} ในเดือน มิ.ย. และ ธ.ค.`
                                : `💰 ได้รับดอกเบี้ยประมาณ ${thb(annualEarned)} ในเดือน ${THAI_MONTHS_SHORT[(r.payoutMonths[0] ?? 2) - 1]}`}
                            </span>
                            <span className="font-display font-bold text-[13px]">
                              รวม {thb(annualEarned)} / ปี
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 pt-1 border-t border-emerald-500/15 flex flex-wrap items-center justify-between gap-1">
                            <span>💡 ดอกเบี้ยที่ได้รับจะทบเข้าเป็นเงินต้นในบัญชีให้อัตโนมัติ (Compounding)</span>
                            {r.payoutSchedule === 'monthly' && (
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                ทบต้นรวม ≈ {thb(thbEquivalent * (Math.pow(1 + rateNum / 1200, 12) - 1))} / ปี
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Quick-Add Bank & App Presets */}
        <div className="pt-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-brand transition-colors hover:text-brand-ink hover:bg-brand-soft/50 cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
              Add custom account
            </button>
            <span className="text-[11px] text-ink-muted">Quick presets:</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_PRESETS.map((p) => {
              const presetInfo = detectBankPreset(p.name)
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => addPreset(p)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:scale-105 cursor-pointer shadow-2xs"
                  style={{
                    backgroundColor: presetInfo?.bg ?? 'var(--color-surface-muted)',
                    borderColor: 'var(--color-line)',
                    color: presetInfo?.color ?? 'var(--color-ink)',
                  }}
                  title={`Add ${p.name} (${p.category})`}
                >
                  <PlusIcon className="h-3 w-3" strokeWidth={2.5} />
                  <span>{p.name}</span>
                  {p.rate && <span className="opacity-80 text-[9.5px]">({p.rate}%)</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
