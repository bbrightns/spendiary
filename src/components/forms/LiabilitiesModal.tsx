import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import {
  CarIcon,
  CreditCardIcon,
  DebtIcon,
  HomeIcon,
  PencilIcon,
  PlusIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  TrashIcon,
} from '../icons'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { DebtCategory, Liability } from '../../lib/types'
import { DEBT_CATEGORIES, THAI_MONTHS_SHORT } from '../../lib/calc'
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
  isInstallment: boolean
  totalInstallments: string
  paidInstallments: string
  originalBalance: string
  firstPaymentMonth: 'auto' | 'current' | 'next'
  createdAt?: string
}

const CATEGORIES_LIST: DebtCategory[] = [
  'installment',
  'credit_card',
  'mortgage',
  'auto_loan',
  'personal_loan',
  'student_loan',
  'other',
]

const QUICK_PRESETS = [
  { name: 'iPhone (0% 10 เดือน)', category: 'installment' as DebtCategory, rate: '0.0', isInstallment: true, totalInst: '10', dueDay: '25' },
  { name: 'เครื่องใช้ไฟฟ้า / TV (10 ด.)', category: 'installment' as DebtCategory, rate: '0.0', isInstallment: true, totalInst: '10', dueDay: '25' },
  { name: 'Shopee SPayLater (6 ด.)', category: 'installment' as DebtCategory, rate: '0.0', isInstallment: true, totalInst: '6', dueDay: '1' },
  { name: 'บัตรเครดิต KBank', category: 'credit_card' as DebtCategory, rate: '16.0', isInstallment: false },
  { name: 'บัตรเครดิต KTC', category: 'credit_card' as DebtCategory, rate: '16.0', isInstallment: false },
  { name: 'สินเชื่อบ้าน / คอนโด', category: 'mortgage' as DebtCategory, rate: '3.75', isInstallment: false },
  { name: 'สินเชื่อรถยนต์', category: 'auto_loan' as DebtCategory, rate: '2.50', isInstallment: false },
  { name: 'กู้ยืม กยศ.', category: 'student_loan' as DebtCategory, rate: '1.0', isInstallment: false },
]

function tempId(): string {
  return `lib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
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
    case 'installment':
      return <ShoppingBagIcon className={className} />
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

const emptyDraft = (): Draft => ({
  id: tempId(),
  name: '',
  category: 'installment',
  balance: '',
  interestRate: '0.0',
  monthlyPayment: '',
  lender: '',
  dueDay: '',
  note: '',
  isInstallment: true,
  totalInstallments: '10',
  paidInstallments: '0',
  originalBalance: '',
  firstPaymentMonth: 'auto',
})

export function LiabilitiesModal({ open, onClose, initialLiabilityId }: Props) {
  const { data, setLiabilities, removeLiability } = useData()
  const { showToast } = useToast()

  // 'form' = add or edit one item; 'list' = manage all debts
  const [mode, setMode] = useState<'form' | 'list'>('form')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const balanceInputRef = useRef<HTMLInputElement>(null)

  const liabilitiesList = useMemo(() => data.liabilities ?? [], [data.liabilities])

  // Initialize draft and mode when modal opens or initialLiabilityId changes
  useEffect(() => {
    if (!open) {
      setMode('form')
      setEditingId(null)
      setShowAdvanced(false)
      setActivePreset(null)
      return
    }

    if (initialLiabilityId) {
      const existing = liabilitiesList.find((l) => l.id === initialLiabilityId)
      if (existing) {
        setEditingId(existing.id)
        setDraft({
          id: existing.id,
          name: existing.name,
          category: existing.category ?? 'other',
          balance: existing.balance ? formatWithCommas(existing.balance) : '',
          interestRate: existing.interestRate !== undefined ? String(existing.interestRate) : '',
          monthlyPayment: existing.monthlyPayment !== undefined ? formatWithCommas(existing.monthlyPayment) : '',
          lender: existing.lender ?? '',
          dueDay: existing.dueDay !== undefined ? String(existing.dueDay) : '',
          note: existing.note ?? '',
          isInstallment: existing.isInstallment ?? (existing.category === 'installment'),
          totalInstallments: existing.totalInstallments !== undefined ? String(existing.totalInstallments) : '',
          paidInstallments: existing.paidInstallments !== undefined ? String(existing.paidInstallments) : '',
          originalBalance: existing.originalBalance !== undefined ? formatWithCommas(existing.originalBalance) : '',
          firstPaymentMonth: existing.firstPaymentMonth ?? 'auto',
          createdAt: existing.createdAt,
        })
        setMode('form')
        setShowAdvanced(Boolean(existing.interestRate || existing.note || (existing.originalBalance && existing.originalBalance !== existing.balance)))
        return
      }
    }

    // Default to adding new debt with clean blank draft
    setEditingId(null)
    setDraft(emptyDraft())
    setMode('form')
    setShowAdvanced(false)
    setActivePreset(null)
  }, [open, initialLiabilityId, liabilitiesList])

  // Focus input on form open
  useEffect(() => {
    if (open && mode === 'form') {
      const timer = setTimeout(() => {
        if (draft.name) {
          balanceInputRef.current?.focus()
        } else {
          nameInputRef.current?.focus()
        }
      }, 80)
      return () => clearTimeout(timer)
    }
  }, [open, mode, editingId])

  const totalBalanceAll = useMemo(() => {
    return liabilitiesList.reduce((sum, l) => sum + (l.balance || 0), 0)
  }, [liabilitiesList])

  const totalMonthlyPaymentAll = useMemo(() => {
    return liabilitiesList.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)
  }, [liabilitiesList])

  // Apply Quick Preset
  const applyPreset = (p: typeof QUICK_PRESETS[number]) => {
    setActivePreset(p.name)
    const isInst = Boolean(p.isInstallment)
    setDraft((d) => ({
      ...d,
      name: p.name,
      category: p.category,
      interestRate: p.rate ?? '',
      dueDay: 'dueDay' in p ? (p.dueDay as string) : d.dueDay,
      isInstallment: isInst,
      totalInstallments: 'totalInst' in p ? (p.totalInst as string) : d.totalInstallments,
      paidInstallments: '0',
    }))
    setTimeout(() => {
      balanceInputRef.current?.focus()
    }, 50)
  }

  // Edit existing from list
  const startEdit = (l: Liability) => {
    setEditingId(l.id)
    setDraft({
      id: l.id,
      name: l.name,
      category: l.category ?? 'other',
      balance: l.balance ? formatWithCommas(l.balance) : '',
      interestRate: l.interestRate !== undefined ? String(l.interestRate) : '',
      monthlyPayment: l.monthlyPayment !== undefined ? formatWithCommas(l.monthlyPayment) : '',
      lender: l.lender ?? '',
      dueDay: l.dueDay !== undefined ? String(l.dueDay) : '',
      note: l.note ?? '',
      isInstallment: l.isInstallment ?? (l.category === 'installment'),
      totalInstallments: l.totalInstallments !== undefined ? String(l.totalInstallments) : '',
      paidInstallments: l.paidInstallments !== undefined ? String(l.paidInstallments) : '',
      originalBalance: l.originalBalance !== undefined ? formatWithCommas(l.originalBalance) : '',
      firstPaymentMonth: l.firstPaymentMonth ?? 'auto',
      createdAt: l.createdAt,
    })
    setShowAdvanced(Boolean(l.interestRate || l.note || (l.originalBalance && l.originalBalance !== l.balance)))
    setMode('form')
  }

  // Delete liability
  const handleDelete = (id: string) => {
    removeLiability(id)
    showToast('ลบรายการหนี้สินเรียบร้อย', 'info')
    if (editingId === id) {
      setEditingId(null)
      setDraft(emptyDraft())
      if (liabilitiesList.length <= 1) {
        onClose()
      } else {
        setMode('list')
      }
    }
  }

  // Save liability form
  const handleSave = () => {
    const cleanName = draft.name.trim()
    const cleanBal = draft.balance.replace(/[^0-9.]/g, '')
    const balNum = cleanBal === '' ? 0 : Number(cleanBal)

    if (!cleanName && balNum <= 0) {
      showToast('กรุณาระบุชื่อรายการหนี้สินหรือยอดหนี้', 'error')
      return
    }

    const cleanRate = draft.interestRate.replace(/[^0-9.]/g, '')
    const cleanPayment = draft.monthlyPayment.replace(/[^0-9.]/g, '')
    const cleanDue = draft.dueDay.replace(/[^0-9]/g, '')
    const cleanTotalInst = draft.totalInstallments.replace(/[^0-9]/g, '')
    const cleanPaidInst = draft.paidInstallments.replace(/[^0-9]/g, '')
    const cleanOrigBal = draft.originalBalance.replace(/[^0-9.]/g, '')

    const isInst = draft.isInstallment || draft.category === 'installment'
    const cleanDueDayNum = cleanDue !== '' ? Math.min(31, Math.max(1, Number(cleanDue))) : undefined

    let resolvedFirstPaymentMonth: 'current' | 'next' | undefined = undefined
    if (draft.firstPaymentMonth === 'next' || draft.firstPaymentMonth === 'current') {
      resolvedFirstPaymentMonth = draft.firstPaymentMonth
    } else if (cleanDueDayNum !== undefined && cleanDueDayNum < new Date().getDate()) {
      resolvedFirstPaymentMonth = 'next'
    }

    const existingItem = liabilitiesList.find((l) => l.id === (editingId || draft.id))

    const liabilityData: Liability = {
      id: editingId || draft.id,
      name: cleanName || 'หนี้สินรายการใหม่',
      category: draft.category,
      balance: balNum,
      interestRate: cleanRate !== '' ? Number(cleanRate) : undefined,
      monthlyPayment: cleanPayment !== '' ? Number(cleanPayment) : undefined,
      lender: draft.lender.trim() || undefined,
      dueDay: cleanDueDayNum,
      note: draft.note.trim() || undefined,
      isInstallment: isInst ? true : undefined,
      totalInstallments: isInst && cleanTotalInst !== '' ? Math.max(1, Number(cleanTotalInst)) : undefined,
      paidInstallments: isInst && cleanPaidInst !== '' ? Math.max(0, Number(cleanPaidInst)) : undefined,
      originalBalance: cleanOrigBal !== '' ? Number(cleanOrigBal) : (balNum > 0 ? balNum : undefined),
      firstPaymentMonth: resolvedFirstPaymentMonth,
      createdAt: existingItem?.createdAt || draft.createdAt || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    }

    let nextList: Liability[]
    if (editingId) {
      nextList = liabilitiesList.map((l) => (l.id === editingId ? liabilityData : l))
      showToast(`อัปเดตรายการ "${liabilityData.name}" เรียบร้อย`, 'success')
    } else {
      nextList = [...liabilitiesList, liabilityData]
      showToast(`บันทึกรายการ "${liabilityData.name}" เรียบร้อย`, 'success')
    }

    setLiabilities(nextList)
    onClose()
  }

  const modalTitle = editingId
    ? 'แก้ไขรายการหนี้สิน (Edit Debt)'
    : mode === 'list'
    ? 'จัดการหนี้สินทั้งหมด (All Debts)'
    : 'บันทึกรายการหนี้ใหม่ (Add Debt)'

  const modalDescription = editingId
    ? 'ปรับปรุงยอดหนี้ ค่างวด หรือข้อมูลการผ่อนชำระ'
    : mode === 'list'
    ? 'ตรวจสอบและแก้ไขรายการหนี้สินทั้งหมดในระบบ'
    : 'บันทึกรายการผ่อนสินค้า หรือหนี้สินเพื่อสะท้อน Net Worth ที่แท้จริง'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      size="lg"
      footer={
        mode === 'form' ? (
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-8.5 px-3 rounded-xl text-[12px] font-semibold text-ink-muted hover:text-ink dark:hover:text-white bg-surface-muted/60 dark:bg-white/5 border border-line/60 dark:border-white/10 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                ยกเลิก
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingId)}
                  className="h-8.5 px-2.5 sm:px-3 rounded-xl text-[12px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  <span>ลบรายการนี้</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="h-8.5 px-4 rounded-xl text-[12.5px] font-bold text-white bg-brand hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              {editingId ? 'บันทึกการแก้ไข' : 'บันทึกรายการหนี้'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2.5 w-full">
            <button
              type="button"
              onClick={onClose}
              className="h-8.5 px-3.5 rounded-xl text-[12px] font-semibold text-ink-muted hover:text-ink dark:hover:text-white bg-surface-muted/60 dark:bg-white/5 border border-line/60 dark:border-white/10 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setDraft(emptyDraft())
                setMode('form')
              }}
              className="h-8.5 px-3.5 rounded-xl text-[12.5px] font-bold text-white bg-brand hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer shadow-xs whitespace-nowrap flex items-center gap-1.5"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>เพิ่มรายการหนี้ใหม่</span>
            </button>
          </div>
        )
      }
    >
      <div className="space-y-4 pb-1">
        {/* Navigation Tabs (When user has liabilities and is not in strict edit mode) */}
        {liabilitiesList.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line/60 dark:border-white/10">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-muted/60 dark:bg-white/5 border border-line/40">
              <button
                type="button"
                onClick={() => {
                  if (editingId) {
                    setEditingId(null)
                    setDraft(emptyDraft())
                  }
                  setMode('form')
                }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  mode === 'form'
                    ? 'bg-surface dark:bg-white/15 text-ink dark:text-white shadow-xs'
                    : 'text-ink-muted hover:text-ink dark:hover:text-white'
                }`}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>{editingId ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('list')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  mode === 'list'
                    ? 'bg-surface dark:bg-white/15 text-ink dark:text-white shadow-xs'
                    : 'text-ink-muted hover:text-ink dark:hover:text-white'
                }`}
              >
                <span>รายการทั้งหมด ({liabilitiesList.length})</span>
              </button>
            </div>

            <div className="text-[12px] text-ink-muted font-medium">
              หนี้คงค้างรวม: <strong className="text-rose-600 dark:text-rose-400 font-bold">{thb(totalBalanceAll)}</strong>
            </div>
          </div>
        )}

        {/* ── MODE 1: FORM (Add / Edit Single Debt) ── */}
        {mode === 'form' && (
          <div className="space-y-4">
            {/* Quick Presets (Only shown in Add mode to keep it clean) */}
            {!editingId && (
              <div className="rounded-2xl bg-surface-muted/50 dark:bg-white/[0.03] p-3 border border-line/60 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                    ⚡ Quick Presets (เลือกด่วน)
                  </span>
                  <span className="text-[10px] text-ink-faint">คลิกเพื่อใส่ข้อมูลเริ่มต้นทันที</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUICK_PRESETS.map((p) => {
                    const isSelected = activePreset === p.name
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-brand text-white border-brand shadow-xs'
                            : 'bg-surface dark:bg-white/10 text-ink-muted dark:text-white/80 border-line/60 dark:border-white/15 hover:text-ink dark:hover:text-white hover:border-brand/40'
                        }`}
                      >
                        <span>+ {p.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Main Inputs: Name & Balance */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Name */}
              <div className="sm:col-span-7">
                <label className="h-5 flex items-center text-[12px] font-semibold text-ink-muted mb-1">
                  <span>ชื่อรายการหนี้ / สินค้า</span>
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="เช่น iPhone 16 Pro, บัตรเครดิต KBank"
                    className="h-10 w-full rounded-xl bg-surface-muted/60 dark:bg-white/5 px-3 font-semibold text-[14px] text-ink dark:text-white border border-line/80 dark:border-white/10 focus:outline-none focus:border-brand focus:bg-surface dark:focus:bg-white/10 transition-colors placeholder:text-ink-faint"
                  />
                </div>
              </div>

              {/* Balance */}
              <div className="sm:col-span-5">
                <label className="h-5 flex items-center justify-between text-[12px] font-semibold text-ink-muted mb-1">
                  <span>
                    ยอดหนี้คงเหลือ (฿) <span className="text-rose-500">*</span>
                  </span>
                  {draft.originalBalance && Number(draft.originalBalance.replace(/[^0-9.]/g, '')) > 0 && (
                    <span className="text-[10px] text-ink-faint">
                      เต็ม {draft.originalBalance}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-rose-500 select-none">
                    -฿
                  </span>
                  <input
                    ref={balanceInputRef}
                    type="text"
                    inputMode="decimal"
                    value={draft.balance}
                    onChange={(e) => {
                      const formatted = formatWithCommas(e.target.value)
                      const numBal = Number(formatted.replace(/[^0-9.]/g, ''))
                      const numTotal = Number(draft.totalInstallments) || 1
                      const numPaid = Number(draft.paidInstallments) || 0
                      const remaining = Math.max(1, numTotal - numPaid)
                      const autoMonth = numBal > 0 ? Math.round(numBal / remaining) : 0
                      setDraft((d) => ({
                        ...d,
                        balance: formatted,
                        originalBalance: d.originalBalance || formatted,
                        monthlyPayment: d.isInstallment && autoMonth > 0 ? formatWithCommas(autoMonth) : d.monthlyPayment,
                      }))
                    }}
                    placeholder="0.00"
                    className="h-10 w-full rounded-xl bg-surface-muted/60 dark:bg-white/5 pl-9 pr-3 text-right font-display font-bold text-[15px] text-ink dark:text-white border border-line/80 dark:border-white/10 focus:outline-none focus:border-brand focus:bg-surface dark:focus:bg-white/10 transition-colors placeholder:text-ink-faint tnum"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Lender & Due Day (Main Details) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Lender */}
              <div className="sm:col-span-7">
                <label className="h-5 flex items-center text-[12px] font-semibold text-ink-muted mb-1">
                  เจ้าหนี้ / สถาบันการเงิน
                </label>
                <input
                  type="text"
                  value={draft.lender}
                  onChange={(e) => setDraft((d) => ({ ...d, lender: e.target.value }))}
                  placeholder="เช่น SPayLater, Apple, KBank, SCB"
                  className="h-10 w-full rounded-xl bg-surface-muted/60 dark:bg-white/5 px-3 text-[13px] text-ink dark:text-white border border-line/80 dark:border-white/10 focus:outline-none focus:border-brand focus:bg-surface dark:focus:bg-white/10 transition-colors placeholder:text-ink-faint"
                />
              </div>

              {/* Due Day */}
              <div className="sm:col-span-5">
                <label className="h-5 flex items-center justify-between text-[12px] font-semibold text-ink-muted mb-1">
                  <span>วันครบกำหนดจ่าย</span>
                  <span className="text-[10.5px] text-ink-faint">วันที่ 1-31</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={draft.dueDay}
                  onChange={(e) => setDraft((d) => ({ ...d, dueDay: e.target.value }))}
                  placeholder="เช่น 1, 15, 25"
                  className="h-10 w-full rounded-xl bg-surface-muted/60 dark:bg-white/5 px-3 text-[13px] font-bold text-ink dark:text-white border border-line/80 dark:border-white/10 focus:outline-none focus:border-brand focus:bg-surface dark:focus:bg-white/10 transition-colors placeholder:text-ink-faint tnum"
                />
              </div>
            </div>

            {/* Smart Next Due Cycle Notice (เมื่อใส่วันที่เลยกำหนดของเดือนนี้) */}
            {(() => {
              const dueNum = Number(draft.dueDay)
              const now = new Date()
              const curDay = now.getDate()
              if (dueNum >= 1 && dueNum <= 31 && dueNum < curDay) {
                const nextMonthName = THAI_MONTHS_SHORT[(now.getMonth() + 1) % 12]
                const curMonthName = THAI_MONTHS_SHORT[now.getMonth()]
                return (
                  <div className="p-2.5 rounded-xl bg-brand/5 dark:bg-brand/10 border border-brand/20 text-[11.5px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-brand dark:text-brand-light">
                        💡 เลยวันที่ {dueNum} ของเดือนนี้แล้ว:
                      </span>{' '}
                      <span className="text-ink-muted dark:text-white/80">
                        รอบชำระถัดไปจะเริ่มวันที่{' '}
                        <strong>
                          {draft.firstPaymentMonth === 'current'
                            ? `${dueNum} ${curMonthName} (รอบเดือนนี้)`
                            : `${dueNum} ${nextMonthName} (เดือนหน้า)`}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, firstPaymentMonth: 'next' }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                          draft.firstPaymentMonth !== 'current'
                            ? 'bg-brand text-white shadow-xs'
                            : 'bg-surface-muted text-ink-muted hover:text-ink dark:bg-white/10 dark:text-white/70'
                        }`}
                      >
                        เริ่ม {dueNum} {nextMonthName} (แนะนำ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, firstPaymentMonth: 'current' }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-all ${
                          draft.firstPaymentMonth === 'current'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-surface-muted text-ink-muted hover:text-ink dark:bg-white/10 dark:text-white/70'
                        }`}
                      >
                        รอบ {dueNum} {curMonthName} (ค้างจ่าย)
                      </button>
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* Category Selector Chips */}
            <div>
              <label className="h-5 flex items-center justify-between text-[12px] font-semibold text-ink-muted mb-1.5">
                <span>หมวดหมู่หนี้สิน (Category)</span>
                <span className="text-[10.5px] text-ink-faint">คลิกเลือกหมวดที่ตรงกัน</span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORIES_LIST.map((catKey) => {
                  const meta = DEBT_CATEGORIES[catKey]
                  const isSelected = draft.category === catKey
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => {
                        const isInst = catKey === 'installment'
                        setDraft((d) => ({
                          ...d,
                          category: catKey,
                          isInstallment: isInst ? true : d.isInstallment,
                          totalInstallments: isInst && !d.totalInstallments ? '10' : d.totalInstallments,
                          paidInstallments: isInst && !d.paidInstallments ? '0' : d.paidInstallments,
                        }))
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSelected
                          ? `${meta.bgClass} ${meta.textClass} ${meta.borderClass} ring-1 ring-current shadow-xs`
                          : 'bg-surface-muted/60 dark:bg-white/5 text-ink-muted dark:text-white/70 border-line/60 dark:border-white/10 hover:text-ink dark:hover:text-white'
                      }`}
                    >
                      <CategoryIcon category={catKey} className="h-3.5 w-3.5" />
                      <span>{meta.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Installment Plan Section */}
            <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 dark:bg-indigo-500/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.isInstallment}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setDraft((d) => ({
                        ...d,
                        isInstallment: checked,
                        category: checked && d.category === 'other' ? 'installment' : d.category,
                      }))
                    }}
                    className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-[12.5px] font-bold text-ink dark:text-white flex items-center gap-2">
                    <span>ผ่อนชำระเป็นงวด (Installment Plan / 0%)</span>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 px-2 py-0.5 rounded-full">
                      Gadget / Shopping
                    </span>
                  </span>
                </label>

                {draft.isInstallment && (
                  <span className="text-[11.5px] font-bold text-indigo-600 dark:text-indigo-400">
                    เหลืออีก {Math.max(0, (Number(draft.totalInstallments) || 0) - (Number(draft.paidInstallments) || 0))} งวด
                  </span>
                )}
              </div>

              {draft.isInstallment && (
                <>
                  {/* Preset term chips on their own row */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-ink-muted">เลือกงวดด่วน:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['3', '6', '10', '12', '18', '24', '36'].map((terms) => {
                        const isSelected = draft.totalInstallments === terms
                        return (
                          <button
                            key={terms}
                            type="button"
                            onClick={() => {
                              const numTerms = Number(terms)
                              const currentBal = Number(draft.balance.replace(/[^0-9.]/g, ''))
                              const paid = Number(draft.paidInstallments) || 0
                              const remaining = Math.max(1, numTerms - paid)
                              const suggested = currentBal > 0 ? Math.round(currentBal / remaining) : 0
                              setDraft((d) => ({
                                ...d,
                                totalInstallments: terms,
                                monthlyPayment: suggested > 0 ? formatWithCommas(suggested) : d.monthlyPayment,
                              }))
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-surface dark:bg-white/10 text-ink-muted dark:text-white/80 border-line/60 dark:border-white/10 hover:text-ink dark:hover:text-white'
                            }`}
                          >
                            {terms} งวด
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 3 Columns: Total Terms, Paid Terms, Monthly Payment */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-indigo-500/15">
                    <div>
                      <label className="h-5 flex items-center text-[11.5px] font-semibold text-ink-muted mb-1">
                        จำนวนงวดทั้งหมด
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={draft.totalInstallments}
                        onChange={(e) => {
                          const val = e.target.value
                          const numTerms = Number(val)
                          const currentBal = Number(draft.balance.replace(/[^0-9.]/g, ''))
                          const paid = Number(draft.paidInstallments) || 0
                          const remaining = Math.max(1, numTerms - paid)
                          const suggested = currentBal > 0 ? Math.round(currentBal / remaining) : 0
                          setDraft((d) => ({
                            ...d,
                            totalInstallments: val,
                            monthlyPayment: suggested > 0 ? formatWithCommas(suggested) : d.monthlyPayment,
                          }))
                        }}
                        placeholder="เช่น 10"
                        className="h-10 w-full rounded-xl bg-surface dark:bg-white/10 px-3 text-[13.5px] font-bold text-ink dark:text-white border border-line dark:border-white/15 focus:outline-none focus:border-brand tnum"
                      />
                    </div>

                    <div>
                      <label className="h-5 flex items-center text-[11.5px] font-semibold text-ink-muted mb-1">
                        ผ่อนไปแล้ว (งวด)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={Number(draft.totalInstallments) || 120}
                        value={draft.paidInstallments}
                        onChange={(e) => setDraft((d) => ({ ...d, paidInstallments: e.target.value }))}
                        placeholder="0"
                        className="h-10 w-full rounded-xl bg-surface dark:bg-white/10 px-3 text-[13.5px] font-bold text-ink dark:text-white border border-line dark:border-white/15 focus:outline-none focus:border-brand tnum"
                      />
                    </div>

                    <div>
                      <label className="h-5 flex items-center justify-between text-[11.5px] font-semibold text-ink-muted mb-1">
                        <span>ค่างวดต่อเดือน (฿)</span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">คำนวณให้อัตโนมัติ</span>
                      </label>
                      <input
                        type="text"
                        value={draft.monthlyPayment}
                        onChange={(e) => setDraft((d) => ({ ...d, monthlyPayment: formatWithCommas(e.target.value) }))}
                        placeholder="เช่น 3,500"
                        className="h-10 w-full rounded-xl bg-surface dark:bg-white/10 px-3 text-[13.5px] font-bold text-ink dark:text-white border border-line dark:border-white/15 focus:outline-none focus:border-brand tnum"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Collapsible Advanced Details (Optional) */}
            <div className="rounded-2xl border border-line/60 dark:border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="w-full flex items-center justify-between p-3 bg-surface-muted/30 dark:bg-white/[0.02] hover:bg-surface-muted/60 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-ink dark:text-white">
                    ⚙️ ข้อมูลเพิ่มเติม (Optional)
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    (ดอกเบี้ย APR, ราคาเต็มเริ่มต้น, Note)
                  </span>
                </div>
                <span
                  className={`text-[12px] text-ink-muted font-bold transition-transform duration-200 ${
                    showAdvanced ? 'rotate-180 text-brand' : ''
                  }`}
                >
                  ▼
                </span>
              </button>

              {showAdvanced && (
                <div className="p-3.5 space-y-3 bg-surface dark:bg-white/[0.01] border-t border-line/50 dark:border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="h-5 flex items-center text-[11px] font-semibold text-ink-muted mb-1">
                        ดอกเบี้ยต่อปี (% APR)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={draft.interestRate}
                          onChange={(e) => setDraft((d) => ({ ...d, interestRate: e.target.value.replace(/[^0-9.]/g, '') }))}
                          placeholder="0.0"
                          className="h-10 w-full rounded-xl bg-surface-muted/50 dark:bg-white/5 pl-3 pr-6 text-[13px] font-bold text-ink dark:text-white border border-line/70 dark:border-white/10 focus:outline-none focus:border-brand tnum"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink-muted">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="h-5 flex items-center text-[11px] font-semibold text-ink-muted mb-1">
                        ราคาเต็มเริ่มต้น (฿)
                      </label>
                      <input
                        type="text"
                        value={draft.originalBalance}
                        onChange={(e) => setDraft((d) => ({ ...d, originalBalance: formatWithCommas(e.target.value) }))}
                        placeholder="เช่น 35,000"
                        className="h-10 w-full rounded-xl bg-surface-muted/50 dark:bg-white/5 px-3 text-[13px] font-bold text-ink dark:text-white border border-line/70 dark:border-white/10 focus:outline-none focus:border-brand tnum"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="h-5 flex items-center text-[11px] font-semibold text-ink-muted mb-1">
                      บันทึกเพิ่มเติม (Note)
                    </label>
                    <input
                      type="text"
                      value={draft.note}
                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                      placeholder="เช่น ผ่อน 0% 10 เดือน เหลือ 4 งวดสุดท้าย"
                      className="h-10 w-full rounded-xl bg-surface-muted/50 dark:bg-white/5 px-3 text-[12.5px] text-ink dark:text-white border border-line/70 dark:border-white/10 focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODE 2: LIST (Review & Manage All Existing Debts) ── */}
        {mode === 'list' && (
          <div className="space-y-3">
            {liabilitiesList.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[13.5px] text-ink-muted font-medium">ยังไม่มีรายการหนี้สินในระบบ</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setDraft(emptyDraft())
                    setMode('form')
                  }}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 h-8.5 px-3.5 rounded-xl text-[12px] font-bold text-white bg-brand hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span>เพิ่มรายการแรก</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {liabilitiesList.map((l) => {
                  const meta = DEBT_CATEGORIES[l.category] ?? DEBT_CATEGORIES.other
                  const isInst = l.isInstallment || l.category === 'installment'
                  const total = l.totalInstallments ?? 0
                  const paid = l.paidInstallments ?? 0
                  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

                  return (
                    <div
                      key={l.id}
                      className="p-3 rounded-2xl border border-line/60 dark:border-white/10 bg-surface-muted/30 dark:bg-white/[0.02] flex items-center justify-between gap-3 hover:border-brand/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`grid h-9 w-9 place-items-center rounded-xl shrink-0 ${meta.bgClass} ${meta.textClass}`}>
                          <CategoryIcon category={l.category} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[14px] text-ink dark:text-white truncate">
                            {l.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted mt-0.5">
                            <span className="font-semibold">{meta.label}</span>
                            {isInst && total > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  ผ่อน {paid}/{total} งวด ({percent}%)
                                </span>
                              </>
                            )}
                            {l.monthlyPayment && (
                              <>
                                <span>•</span>
                                <span>{thb(l.monthlyPayment)}/ด.</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-display font-bold text-[15px] text-ink dark:text-white tnum">
                          -{thb(l.balance)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(l)}
                            className="p-2 rounded-xl text-ink-muted hover:text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                            title="แก้ไขรายการนี้"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(l.id)}
                            className="p-2 rounded-xl text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Summary Footer in List Mode */}
            {liabilitiesList.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-surface-muted/60 dark:bg-white/5 border border-line/60 dark:border-white/10 flex items-center justify-between text-[12px]">
                <div className="text-ink-muted">
                  รวม <strong className="text-ink dark:text-white">{liabilitiesList.length} รายการ</strong>
                  {totalMonthlyPaymentAll > 0 && (
                    <span className="ml-2">
                      (ภาระผ่อนรวม <strong>{thb(totalMonthlyPaymentAll)}/เดือน</strong>)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-[15px] text-rose-600 dark:text-rose-400 tnum">
                    -{thb(totalBalanceAll)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
