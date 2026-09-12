import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import {
  CarIcon,
  CreditCardIcon,
  DebtIcon,
  HomeIcon,
  PlusIcon,
  ReceiptPercentIcon,
  TrashIcon,
} from '../icons'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { DebtCategory, Liability } from '../../lib/types'
import { DEBT_CATEGORIES } from '../../lib/calc'
import { thb } from '../../lib/format'

interface Props {
  open: boolean
  onClose: () => void
  initialLiabilityId?: string | null
}

interface Draft {
  id: string
  name: string
  category: DebtCategory
  balance: string
  interestRate: string
  monthlyPayment: string
  lender: string
  dueDay: string
  note: string
}

const QUICK_PRESETS = [
  { name: 'บัตรเครดิต KBank', category: 'credit_card' as DebtCategory, rate: '16.0' },
  { name: 'บัตรเครดิต KTC', category: 'credit_card' as DebtCategory, rate: '16.0' },
  { name: 'บัตรเครดิต CardX', category: 'credit_card' as DebtCategory, rate: '16.0' },
  { name: 'สินเชื่อบ้าน / คอนโด', category: 'mortgage' as DebtCategory, rate: '3.75' },
  { name: 'สินเชื่อรถยนต์', category: 'auto_loan' as DebtCategory, rate: '2.50' },
  { name: 'กู้ยืม กยศ.', category: 'student_loan' as DebtCategory, rate: '1.0' },
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

function CategoryIcon({ category, className = 'h-4 w-4' }: { category: DebtCategory; className?: string }) {
  switch (category) {
    case 'credit_card':
      return <CreditCardIcon className={className} />
    case 'mortgage':
      return <HomeIcon className={className} />
    case 'auto_loan':
      return <CarIcon className={className} />
    case 'personal_loan':
    case 'student_loan':
      return <ReceiptPercentIcon className={className} />
    default:
      return <DebtIcon className={className} />
  }
}

export function LiabilitiesModal({ open, onClose, initialLiabilityId }: Props) {
  const { data, setLiabilities } = useData()
  const { showToast } = useToast()
  const [rows, setRows] = useState<Draft[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<DebtCategory | 'all'>('all')
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

    const initialList = data.liabilities ?? []
    const mappedDrafts: Draft[] = initialList.length > 0
      ? initialList.map((l) => ({
          id: l.id,
          name: l.name,
          category: l.category ?? 'other',
          balance: l.balance ? formatWithCommas(l.balance) : '',
          interestRate: l.interestRate !== undefined ? String(l.interestRate) : '',
          monthlyPayment: l.monthlyPayment !== undefined ? formatWithCommas(l.monthlyPayment) : '',
          lender: l.lender ?? '',
          dueDay: l.dueDay !== undefined ? String(l.dueDay) : '',
          note: l.note ?? '',
        }))
      : []

    setRows(mappedDrafts)

    if (initialLiabilityId) {
      setHighlightedId(initialLiabilityId)
      setExpandedId(initialLiabilityId)
      setTimeout(() => {
        const input = balanceInputRefs.current.get(initialLiabilityId)
        if (input) {
          input.focus()
          input.select()
        }
      }, 100)
    }
  }, [open, initialLiabilityId, data.liabilities])

  // Aggregate totals
  const totalBalance = rows.reduce((sum, r) => {
    const clean = r.balance.replace(/[^0-9.]/g, '')
    return sum + (clean === '' ? 0 : Number(clean))
  }, 0)

  const totalMonthlyPayment = rows.reduce((sum, r) => {
    const clean = r.monthlyPayment.replace(/[^0-9.]/g, '')
    return sum + (clean === '' ? 0 : Number(clean))
  }, 0)

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
        category: 'credit_card',
        balance: '',
        interestRate: '',
        monthlyPayment: '',
        lender: '',
        dueDay: '',
        note: '',
      },
    ])
    setExpandedId(id)
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
      category: p.category,
      balance: '',
      interestRate: p.rate,
      monthlyPayment: '',
      lender: '',
      dueDay: '',
      note: '',
    }
    setRows((rs) => [...rs, newDraft])
    setExpandedId(id)
    setTimeout(() => {
      const balanceInput = balanceInputRefs.current.get(id)
      if (balanceInput) {
        balanceInput.focus()
        balanceInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 50)
  }

  const save = () => {
    const cleaned: Liability[] = rows
      .map((r) => {
        const cleanBal = r.balance.replace(/[^0-9.]/g, '')
        const cleanRate = r.interestRate.replace(/[^0-9.]/g, '')
        const cleanPayment = r.monthlyPayment.replace(/[^0-9.]/g, '')
        const cleanDue = r.dueDay.replace(/[^0-9]/g, '')

        return {
          id: r.id.startsWith('tmp-') ? tempId().replace('tmp-', 'lib-') : r.id,
          name: r.name.trim() || 'Debt Item',
          category: r.category,
          balance: cleanBal === '' ? 0 : Number(cleanBal),
          interestRate: cleanRate !== '' ? Number(cleanRate) : undefined,
          monthlyPayment: cleanPayment !== '' ? Number(cleanPayment) : undefined,
          lender: r.lender.trim() || undefined,
          dueDay: cleanDue !== '' ? Math.min(31, Math.max(1, Number(cleanDue))) : undefined,
          note: r.note.trim() || undefined,
          updatedAt: new Date().toISOString().slice(0, 10),
        }
      })
      .filter((l) => l.name !== '' || l.balance > 0)

    setLiabilities(cleaned)
    showToast('Saved liabilities successfully', 'success')
    onClose()
  }

  const filteredRows = rows.filter((r) => {
    if (activeCategoryFilter === 'all') return true
    return r.category === activeCategoryFilter
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Liabilities & Debts"
      description="บันทึกและจัดการรายการหนี้สิน ยอดหนี้คงค้างจะถูกนำไปหักลบออกจาก Net Worth สุทธิ"
      size="xl"
      footer={
        <div className="flex flex-col gap-3 w-full">
          {/* Summary Card */}
          <div className="rounded-2xl bg-surface-muted/80 dark:bg-white/5 p-4 border border-line/70 dark:border-white/10 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-[12.5px] font-semibold text-ink-muted">Total Outstanding Debt (หนี้สินรวม)</span>
              <span className={`font-display text-[22px] sm:text-[24px] font-extrabold tnum ${totalBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink dark:text-white'}`}>
                {thb(totalBalance)}
              </span>
            </div>

            {totalMonthlyPayment > 0 && (
              <div className="flex items-center justify-between text-[11.5px] text-ink-muted border-t border-line/40 dark:border-white/10 pt-2">
                <span>Total Monthly Payment (ภาระผ่อนรวม)</span>
                <span className="tnum font-bold text-ink dark:text-white">
                  {thb(totalMonthlyPayment)} / month
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} className="w-1/3">
              Cancel
            </Button>
            <Button onClick={save} className="w-2/3">
              Save Liabilities
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 text-[12px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('all')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
                activeCategoryFilter === 'all'
                  ? 'bg-ink text-surface shadow-xs dark:bg-white dark:text-ink-dark'
                  : 'bg-surface-muted text-ink-muted hover:text-ink dark:bg-white/10 dark:text-white/70 dark:hover:text-white'
              }`}
            >
              All ({rows.length})
            </button>
            {(['credit_card', 'mortgage', 'auto_loan', 'personal_loan', 'student_loan', 'other'] as DebtCategory[]).map((catKey) => {
              const meta = DEBT_CATEGORIES[catKey]
              const count = rows.filter((r) => r.category === catKey).length
              if (count === 0 && activeCategoryFilter !== catKey) return null
              const isSelected = activeCategoryFilter === catKey
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setActiveCategoryFilter(catKey)}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand text-white shadow-xs font-semibold'
                      : 'bg-surface-muted text-ink-muted hover:text-ink dark:bg-white/10 dark:text-white/70 dark:hover:text-white'
                  }`}
                >
                  <CategoryIcon category={catKey} className="h-3.5 w-3.5" />
                  <span>{meta.label}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* List of Debt Items */}
        {filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line dark:border-white/10 p-8 text-center bg-surface-muted/30">
            <div className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500 mb-2">
              <DebtIcon className="h-6 w-6" />
            </div>
            <p className="font-display font-bold text-[15px] text-ink dark:text-white">
              {activeCategoryFilter === 'all' ? 'ไม่มีรายการหนี้สิน (Debt Free 🎉)' : 'ไม่พบรายการในหมวดนี้'}
            </p>
            <p className="text-[12.5px] text-ink-muted mt-0.5">
              {activeCategoryFilter === 'all'
                ? 'หากคุณมีหนี้บัตรเครดิต สินเชื่อบ้าน รถ หรือกู้ยืม สามารถเพิ่มเพื่อสะท้อน Net Worth ที่แท้จริงได้'
                : 'เลือกหมวดอื่น หรือกดปุ่มเพิ่มรายการใหม่ด้านล่าง'}
            </p>
            <Button onClick={add} variant="secondary" size="sm" className="mt-4">
              <PlusIcon className="h-4 w-4 mr-1" />
              Add First Debt
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((r) => {
              const isExpanded = expandedId === r.id
              const meta = DEBT_CATEGORIES[r.category]
              const isHighlighted = highlightedId === r.id

              return (
                <div
                  key={r.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isHighlighted
                      ? 'border-brand ring-2 ring-brand/20 bg-brand-soft/10 dark:bg-brand/10'
                      : 'border-line dark:border-white/10 bg-surface dark:bg-white/[0.03] hover:border-line-strong'
                  }`}
                >
                  {/* Primary Row Header */}
                  <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 ${meta.bgClass} ${meta.textClass}`}>
                        <CategoryIcon category={r.category} className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="relative">
                          <input
                            ref={(el) => {
                              if (el) nameInputRefs.current.set(r.id, el)
                              else nameInputRefs.current.delete(r.id)
                            }}
                            type="text"
                            value={r.name}
                            onChange={(e) => update(r.id, { name: e.target.value })}
                            placeholder="ระบุชื่อรายการหนี้ (คลิกเพื่อแก้ไข)"
                            className="w-full rounded-xl bg-surface-muted/60 dark:bg-white/5 px-3 py-1.5 font-bold text-[14px] text-ink dark:text-white placeholder:text-ink-faint border border-line/80 dark:border-white/10 hover:border-brand/50 focus:border-brand focus:bg-surface dark:focus:bg-white/10 focus:outline-none transition-colors"
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <select
                            value={r.category}
                            onChange={(e) => update(r.id, { category: e.target.value as DebtCategory })}
                            className="text-[11px] font-semibold bg-surface-muted dark:bg-white/10 text-ink-muted dark:text-white/80 rounded-md px-2 py-0.5 border border-line/60 dark:border-white/10 focus:outline-none cursor-pointer"
                          >
                            {(['credit_card', 'mortgage', 'auto_loan', 'personal_loan', 'student_loan', 'other'] as DebtCategory[]).map((cat) => (
                              <option key={cat} value={cat}>
                                {DEBT_CATEGORIES[cat].label}
                              </option>
                            ))}
                          </select>

                          {r.interestRate && Number(r.interestRate) > 0 && (
                            <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              {r.interestRate}% APR
                            </span>
                          )}

                          {r.monthlyPayment && Number(r.monthlyPayment.replace(/[^0-9.]/g, '')) > 0 && (
                            <span className="text-[10.5px] font-medium text-ink-muted">
                              ผ่อน {thb(Number(r.monthlyPayment.replace(/[^0-9.]/g, '')))}/ด.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                      <div className="relative flex-1 sm:flex-initial sm:w-44">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold ${Number(r.balance.replace(/[^0-9.]/g, '')) > 0 ? 'text-rose-500' : 'text-ink-muted/60'}`}>
                          -฿
                        </span>
                        <input
                          ref={(el) => {
                            if (el) balanceInputRefs.current.set(r.id, el)
                            else balanceInputRefs.current.delete(r.id)
                          }}
                          type="text"
                          value={r.balance}
                          onChange={(e) => update(r.id, { balance: formatWithCommas(e.target.value) })}
                          placeholder="0.00"
                          className="w-full rounded-xl bg-surface-muted/70 dark:bg-white/5 pl-8 pr-3 py-1.5 text-right font-display font-bold text-[14.5px] text-ink dark:text-white border border-line dark:border-white/10 focus:outline-none focus:border-brand tnum"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer text-[11.5px] font-semibold flex items-center gap-1.5 ${
                          isExpanded
                            ? 'bg-brand/10 text-brand border-brand/30'
                            : 'bg-surface-muted text-ink-muted border-line/60 hover:text-ink dark:bg-white/10 dark:text-white/70'
                        }`}
                        title="ดูรายละเอียดเพิ่มเติม (ดอกเบี้ย, ค่างวด, สถาบัน)"
                      >
                        <span>{isExpanded ? 'ย่อ' : 'รายละเอียด'}</span>
                        <span className="text-[10px] font-normal opacity-70">(optional)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        aria-label={`Delete ${r.name || 'debt'}`}
                        className="p-1.5 rounded-lg text-ink-faint hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="ลบรายการนี้"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Fields */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2.5 border-t border-line/60 dark:border-white/10 bg-surface-muted/20 dark:bg-white/[0.02] grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-4 flex items-center justify-between pb-1 border-b border-line/40 dark:border-white/5 text-[11px]">
                        <span className="font-semibold text-ink-muted flex items-center gap-1.5">
                          <span>รายละเอียดเพิ่มเติม</span>
                          <span className="text-[10px] font-medium text-ink-faint bg-surface-muted dark:bg-white/10 px-1.5 py-0.5 rounded border border-line/40">
                            Optional (ไม่บังคับ)
                          </span>
                        </span>
                        <span className="text-[10.5px] text-ink-faint hidden sm:inline">
                          ไม่กรอกก็ได้ ไม่มีผลต่อการคำนวณ Net Worth
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1 flex items-center justify-between">
                          <span>อัตราดอกเบี้ยต่อปี (% APR)</span>
                          <span className="text-[9.5px] font-normal text-ink-faint">optional</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={r.interestRate}
                            onChange={(e) => update(r.id, { interestRate: e.target.value.replace(/[^0-9.]/g, '') })}
                            placeholder="e.g. 16.0"
                            className="w-full rounded-lg bg-surface dark:bg-white/5 px-2.5 py-1 text-[13px] font-bold text-ink dark:text-white border border-line dark:border-white/10 focus:outline-none focus:border-brand tnum pr-6"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted font-bold">
                            %
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1 flex items-center justify-between">
                          <span>ค่างวดต่อเดือน (฿)</span>
                          <span className="text-[9.5px] font-normal text-ink-faint">optional</span>
                        </label>
                        <input
                          type="text"
                          value={r.monthlyPayment}
                          onChange={(e) => update(r.id, { monthlyPayment: formatWithCommas(e.target.value) })}
                          placeholder="e.g. 5,000"
                          className="w-full rounded-lg bg-surface dark:bg-white/5 px-2.5 py-1 text-[13px] font-bold text-ink dark:text-white border border-line dark:border-white/10 focus:outline-none focus:border-brand tnum"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1 flex items-center justify-between">
                          <span>เจ้าหนี้ / สถาบันการเงิน</span>
                          <span className="text-[9.5px] font-normal text-ink-faint">optional</span>
                        </label>
                        <input
                          type="text"
                          value={r.lender}
                          onChange={(e) => update(r.id, { lender: e.target.value })}
                          placeholder="e.g. KBank, SCB, กรุงศรี"
                          className="w-full rounded-lg bg-surface dark:bg-white/5 px-2.5 py-1 text-[13px] text-ink dark:text-white border border-line dark:border-white/10 focus:outline-none focus:border-brand"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1 flex items-center justify-between">
                          <span>วันครบกำหนดจ่าย (Due Day)</span>
                          <span className="text-[9.5px] font-normal text-ink-faint">optional</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={r.dueDay}
                          onChange={(e) => update(r.id, { dueDay: e.target.value })}
                          placeholder="วันที่ 1-31"
                          className="w-full rounded-lg bg-surface dark:bg-white/5 px-2.5 py-1 text-[13px] text-ink dark:text-white border border-line dark:border-white/10 focus:outline-none focus:border-brand tnum"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1 flex items-center justify-between">
                          <span>บันทึกเพิ่มเติม (Note)</span>
                          <span className="text-[9.5px] font-normal text-ink-faint">optional</span>
                        </label>
                        <input
                          type="text"
                          value={r.note}
                          onChange={(e) => update(r.id, { note: e.target.value })}
                          placeholder="เช่น ผ่อน 0% 10 เดือน เหลือ 4 งวดสุดท้าย"
                          className="w-full rounded-lg bg-surface dark:bg-white/5 px-2.5 py-1 text-[12.5px] text-ink dark:text-white border border-line dark:border-white/10 focus:outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Action / Presets Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-line/60 dark:border-white/10">
          <Button onClick={add} variant="secondary" size="sm" className="w-full sm:w-auto">
            <PlusIcon className="h-4 w-4 mr-1 text-brand" />
            + เพิ่มรายการหนี้ใหม่
          </Button>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-ink-muted mr-1">Quick Add:</span>
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => addPreset(p)}
                className="text-[11px] font-medium bg-surface-muted dark:bg-white/10 hover:bg-surface-muted/80 text-ink-soft dark:text-white/80 px-2 py-0.5 rounded-full border border-line/50 dark:border-white/10 transition-colors cursor-pointer"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
