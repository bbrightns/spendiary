import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { LiabilitiesModal } from '../components/forms/LiabilitiesModal'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import type { DebtCategory, HoldingLog, Liability } from '../lib/types'
import { DEBT_CATEGORIES, getLiabilityDueStatus } from '../lib/calc'
import { thb } from '../lib/format'
import {
  CarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  DebtIcon,
  HomeIcon,
  PencilIcon,
  PlusIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  TrashIcon,
} from '../components/icons'

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

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

function formatThaiDate(dateStr?: string): string {
  if (!dateStr) return '-'
  try {
    const parts = dateStr.slice(0, 10).split('-')
    if (parts.length < 3) return dateStr
    const y = Number(parts[0])
    const m = Number(parts[1]) - 1
    const d = Number(parts[2])
    const yearBE = y > 2400 ? y : y + 543
    return `${d} ${THAI_MONTHS[m] || ''} ${yearBE}`
  } catch {
    return dateStr
  }
}

function getEstimatedPayoffDate(dueDay: number | undefined, remainingTerms: number): { dateStr: string; relativeStr: string } {
  if (remainingTerms <= 0) return { dateStr: 'ผ่อนหมดแล้ว 🎉', relativeStr: '0 เดือน' }
  const now = new Date()
  const targetDate = new Date(now.getFullYear(), now.getMonth() + remainingTerms, dueDay || 25)
  const d = targetDate.getDate()
  const m = targetDate.getMonth()
  const yearBE = targetDate.getFullYear() + 543
  return {
    dateStr: `${d} ${THAI_MONTHS[m]} ${yearBE}`,
    relativeStr: `อีก ${remainingTerms} เดือน`,
  }
}

export function Debts() {
  const { data, payLiabilityInstallment, undoLiabilityPayment, removeLiability } = useData()
  const { showToast } = useToast()

  const [statusTab, setStatusTab] = useState<'active' | 'completed' | 'all'>('active')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<DebtCategory | 'all'>('all')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    const set = new Set<string>()
    if (data.liabilities && data.liabilities.length > 1) {
      // Keep only the first debt expanded by default; collapse the rest to save screen space
      data.liabilities.slice(1).forEach((l) => set.add(l.id))
    }
    return set
  })
  const [liabilitiesModalOpen, setLiabilitiesModalOpen] = useState(false)
  const [editingLiabilityId, setEditingLiabilityId] = useState<string | null>(null)
  const [historyModalLiability, setHistoryModalLiability] = useState<Liability | null>(null)
  const [itemToDelete, setItemToDelete] = useState<Liability | null>(null)

  const liabilities = data.liabilities ?? []

  // Metrics
  const activeDebts = useMemo(() => {
    return liabilities.filter((l) => {
      if (l.balance <= 0) return false
      if (l.isInstallment && l.totalInstallments && (l.paidInstallments ?? 0) >= l.totalInstallments) return false
      return true
    })
  }, [liabilities])

  const completedDebts = useMemo(() => {
    return liabilities.filter((l) => {
      if (l.balance <= 0) return true
      if (l.isInstallment && l.totalInstallments && (l.paidInstallments ?? 0) >= l.totalInstallments) return true
      return false
    })
  }, [liabilities])

  const totalOutstanding = useMemo(() => {
    return activeDebts.reduce((sum, l) => sum + (Number(l.balance) || 0), 0)
  }, [activeDebts])

  const totalMonthlyPayment = useMemo(() => {
    return activeDebts.reduce((sum, l) => sum + (Number(l.monthlyPayment) || 0), 0)
  }, [activeDebts])

  const totalOriginalDebt = useMemo(() => {
    return liabilities.reduce((sum, l) => sum + (l.originalBalance ?? l.balance ?? 0), 0)
  }, [liabilities])

  const totalPaidOffAmount = Math.max(0, totalOriginalDebt - totalOutstanding)

  // Max payoff estimation among all active installment debts
  const overallDebtFreeEstimation = useMemo(() => {
    let maxRemainingMonths = 0
    let latestDueDay = 25

    activeDebts.forEach((l) => {
      if (l.isInstallment && l.totalInstallments) {
        const remaining = Math.max(0, l.totalInstallments - (l.paidInstallments ?? 0))
        if (remaining > maxRemainingMonths) {
          maxRemainingMonths = remaining
          latestDueDay = l.dueDay || 25
        }
      }
    })

    if (maxRemainingMonths === 0) return null
    return getEstimatedPayoffDate(latestDueDay, maxRemainingMonths)
  }, [activeDebts])

  // Filtered list
  const filteredDebts = useMemo(() => {
    return liabilities.filter((l) => {
      const isCompleted = l.balance <= 0 || (l.isInstallment && l.totalInstallments && (l.paidInstallments ?? 0) >= l.totalInstallments)
      if (statusTab === 'active' && isCompleted) return false
      if (statusTab === 'completed' && !isCompleted) return false
      if (activeCategoryFilter !== 'all' && l.category !== activeCategoryFilter) return false
      return true
    })
  }, [liabilities, statusTab, activeCategoryFilter])

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePay = (l: Liability) => {
    payLiabilityInstallment(l.id)
    showToast(`บันทึกชำระงวด "${l.name}" เรียบร้อยแล้ว`, 'success')
  }

  const handleUndo = (l: Liability) => {
    undoLiabilityPayment(l.id)
    showToast(`ยกเลิกการชำระงวด "${l.name}" เรียบร้อย`, 'info')
  }

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      removeLiability(itemToDelete.id)
      showToast(`ลบรายการ "${itemToDelete.name}" เรียบร้อย`, 'info')
      setItemToDelete(null)
    }
  }

  // Related logs for history modal
  const historyLogs = useMemo(() => {
    if (!historyModalLiability) return []
    return (data.holdingLogs ?? []).filter((log: HoldingLog) => {
      return (
        log.holdingName === `Liability: ${historyModalLiability.name}` ||
        log.note.includes(historyModalLiability.name)
      )
    })
  }, [historyModalLiability, data.holdingLogs])

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        eyebrow="Cashflow & Liabilities"
        title="Debts & Installments"
        subtitle="ศูนย์รวมการจัดการหนี้สิน ผ่อนสินค้า 0% และวางแผนปลดหนี้สู่ความมั่งคั่งที่แท้จริง"
        action={
          <Button
            onClick={() => {
              setEditingLiabilityId(null)
              setLiabilitiesModalOpen(true)
            }}
            variant="primary"
            size="md"
            className="shadow-xs"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            เพิ่มรายการหนี้ใหม่
          </Button>
        }
      />

      {/* ── Top Summary Bento (Compact 2x2 on Mobile, 4x1 on Desktop like Dividends) ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Total Outstanding */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-[11px] sm:text-[12px] font-medium text-ink-muted truncate">หนี้คงค้างรวม</p>
            <p className={`mt-1 font-display text-[17px] sm:text-[24px] font-extrabold tnum truncate ${totalOutstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {totalOutstanding > 0 ? `-${thb(totalOutstanding)}` : '฿0'}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] text-ink-muted truncate">
            {totalOutstanding > 0 ? `${activeDebts.length} รายการกำลังผ่อน` : '🎉 ปลอดหนี้ 100%'}
          </p>
        </Card>

        {/* Card 2: Total Monthly Payment */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-[11px] sm:text-[12px] font-medium text-ink-muted truncate">ภาระผ่อน/เดือน</p>
            <p className="mt-1 font-display text-[17px] sm:text-[24px] font-extrabold tnum text-ink dark:text-white truncate">
              {totalMonthlyPayment > 0 ? thb(totalMonthlyPayment) : '฿0'}
              <span className="text-[11px] sm:text-[12px] font-semibold text-ink-muted ml-0.5">/ด.</span>
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] text-ink-muted truncate">
            {activeDebts.filter((l) => l.monthlyPayment).length} รายการมีค่างวดประจำ
          </p>
        </Card>

        {/* Card 3: Paid Off Progress */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-[11px] sm:text-[12px] font-medium text-ink-muted truncate">ผ่อนสำเร็จแล้ว</p>
            <p className="mt-1 font-display text-[17px] sm:text-[24px] font-extrabold tnum text-emerald-600 dark:text-emerald-400 truncate">
              +{thb(totalPaidOffAmount)}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] text-ink-muted truncate">
            {completedDebts.length > 0 ? `ปลดหนี้ ${completedDebts.length} รายการ 🎉` : 'ยอดสะสมจากการผ่อน'}
          </p>
        </Card>

        {/* Card 4: Estimated Debt-Free Date */}
        <Card className="p-3 sm:p-5 animate-rise flex flex-col justify-between" padded={false}>
          <div>
            <p className="text-[11px] sm:text-[12px] font-medium text-brand truncate">คาดว่าจะปลอดหนี้</p>
            <p className="mt-1 font-display text-[15px] sm:text-[22px] font-extrabold text-ink dark:text-white tnum truncate">
              {overallDebtFreeEstimation ? overallDebtFreeEstimation.dateStr : 'ไม่มีหนี้ 🎉'}
            </p>
          </div>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] text-ink-muted truncate">
            {overallDebtFreeEstimation ? overallDebtFreeEstimation.relativeStr : 'อิสรภาพการเงิน 100%'}
          </p>
        </Card>
      </div>

      {/* ── Status Tabs & Filter Controls (Slim & Compact) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        {/* Main Status Segment (Slim single-line pill) */}
        <div className="inline-flex items-center gap-1 p-0.5 sm:p-1 bg-surface-muted/70 dark:bg-white/5 rounded-xl border border-line/60 dark:border-white/10 w-fit shrink-0">
          <button
            type="button"
            onClick={() => setStatusTab('active')}
            className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              statusTab === 'active'
                ? 'bg-amber-400 text-amber-950 dark:bg-amber-400 dark:text-amber-950 shadow-xs'
                : 'text-ink-muted hover:text-ink dark:hover:text-white'
            }`}
          >
            <span>กำลังผ่อน</span>
            <span className="text-[10px] opacity-85">({activeDebts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusTab('completed')}
            className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              statusTab === 'completed'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-ink-muted hover:text-ink dark:hover:text-white'
            }`}
          >
            <span>ผ่อนสำเร็จ</span>
            <span className="text-[10px] opacity-85">({completedDebts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusTab('all')}
            className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              statusTab === 'all'
                ? 'bg-ink text-surface dark:bg-white dark:text-ink-dark shadow-xs'
                : 'text-ink-muted hover:text-ink dark:hover:text-white'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="text-[10px] opacity-85">({liabilities.length})</span>
          </button>
        </div>

        {/* Category Filter Pills (Slim) */}
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeCategoryFilter === 'all'
                ? 'bg-ink text-surface dark:bg-white dark:text-ink-dark shadow-xs'
                : 'bg-surface-muted text-ink-muted hover:text-ink dark:bg-white/10 dark:text-white/70'
            }`}
          >
            ทุกหมวด
          </button>

          {(['installment', 'credit_card', 'mortgage', 'auto_loan', 'personal_loan', 'student_loan', 'other'] as DebtCategory[]).map((catKey) => {
            const meta = DEBT_CATEGORIES[catKey]
            const count = liabilities.filter((l) => l.category === catKey).length
            if (count === 0 && activeCategoryFilter !== catKey) return null
            const isSelected = activeCategoryFilter === catKey
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setActiveCategoryFilter(catKey)}
                className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-brand text-white shadow-xs font-semibold'
                    : 'bg-surface-muted text-ink-muted hover:text-ink dark:bg-white/10 dark:text-white/70'
                }`}
              >
                <CategoryIcon category={catKey} className="h-3 w-3" />
                <span>{meta.label}</span>
                <span className="text-[9.5px] opacity-75">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Debts List / Cards ── */}
      {filteredDebts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="inline-grid h-16 w-16 place-items-center rounded-3xl bg-pink-500/10 text-pink-600 dark:text-pink-400 mb-3">
            <ShoppingBagIcon className="h-8 w-8" />
          </div>
          <h3 className="font-display text-[18px] font-bold text-ink dark:text-white">
            {statusTab === 'active'
              ? 'ไม่มีรายการหนี้ที่กำลังผ่อน (Debt Free 🎉)'
              : statusTab === 'completed'
              ? 'ยังไม่มีรายการที่ผ่อนสำเร็จ'
              : 'ยังไม่มีรายการหนี้สิน'}
          </h3>
          <p className="text-[13px] text-ink-muted max-w-md mx-auto mt-1">
            {statusTab === 'active'
              ? 'สุดยอดมาก! คุณไม่มีภาระผ่อนคงค้าง หรือหากต้องการบันทึกการผ่อนสินค้า 0% ชิ้นใหม่ สามารถกดเพิ่มได้เลย'
              : 'บันทึกและจัดการผ่อนสินค้า 0% สินเชื่อบ้าน รถ หรือกู้ยืมเพื่อเห็นภาพความมั่งคั่งสุทธิ'}
          </p>
          <Button
            onClick={() => {
              setEditingLiabilityId(null)
              setLiabilitiesModalOpen(true)
            }}
            variant="secondary"
            size="md"
            className="mt-5"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            เพิ่มรายการแรก
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDebts.map((l) => {
            const meta = DEBT_CATEGORIES[l.category] ?? DEBT_CATEGORIES.other
            const isInst = l.isInstallment || l.category === 'installment'
            const totalInst = l.totalInstallments ?? (isInst ? 10 : 0)
            const paidInst = l.paidInstallments ?? 0
            const remainingInst = Math.max(0, totalInst - paidInst)
            const isCompleted = l.balance <= 0 || (isInst && totalInst > 0 && paidInst >= totalInst)
            const percent = totalInst > 0 ? Math.min(100, Math.round((paidInst / totalInst) * 100)) : (isCompleted ? 100 : 0)
            const isCollapsed = collapsedIds.has(l.id)

            const originalBal = l.originalBalance ?? (isInst && l.monthlyPayment && totalInst > 0 ? l.monthlyPayment * totalInst : l.balance)
            const paidAmount = Math.max(0, originalBal - l.balance)
            const dueInfo = getLiabilityDueStatus(l)
            const payoff = getEstimatedPayoffDate(l.dueDay, remainingInst)

            // Monthly amount for each installment pill
            const pillAmount = l.monthlyPayment && l.monthlyPayment > 0
              ? l.monthlyPayment
              : (totalInst > 0 ? Math.round(originalBal / totalInst) : 0)

            return (
              <Card
                key={l.id}
                className="overflow-hidden border border-line/70 dark:border-white/10 shadow-xs hover:border-line-strong transition-all"
                padded={false}
              >
                {/* ── Card Header (Compact & Crisp) ── */}
                <div
                  onClick={() => toggleCollapse(l.id)}
                  className="p-2.5 sm:p-3.5 flex items-center justify-between gap-2 bg-surface-muted/30 dark:bg-white/[0.01] hover:bg-surface-muted/60 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl shrink-0 ${meta.bgClass} ${meta.textClass}`}>
                      <CategoryIcon category={l.category} className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-[13.5px] sm:text-[15px] text-ink dark:text-white truncate">
                          {l.name}
                        </h3>
                        <span className={`text-[9.5px] sm:text-[10px] font-semibold px-2 py-0.2 rounded-full ${dueInfo.badgeClass}`}>
                          {dueInfo.label}
                        </span>
                      </div>
                      <p className="text-[10.5px] sm:text-[11.5px] text-ink-muted truncate mt-0.5">
                        {meta.label} {l.dueDay ? `· ทุกวันที่ ${l.dueDay}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Header Right: Balance & Actions */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="font-display font-bold text-[13px] sm:text-[15px] text-rose-600 dark:text-rose-400 tnum">
                      -{thb(l.balance)}
                    </span>

                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLiabilityId(l.id)
                          setLiabilitiesModalOpen(true)
                        }}
                        className="p-1 sm:p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted dark:hover:bg-white/10 transition-colors cursor-pointer"
                        title="แก้ไขข้อมูลรายการนี้"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setItemToDelete(l)}
                        className="p-1 sm:p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="ลบรายการนี้"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="p-0.5 text-ink-muted">
                      <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} />
                    </div>
                  </div>
                </div>

                {/* ── Card Body (Collapsible, Compact like Reference Image) ── */}
                {!isCollapsed && (
                  <div className="p-2.5 sm:p-3.5 space-y-2.5 sm:space-y-3 border-t border-line/50 dark:border-white/5">
                    {/* 1. Grid 6 ช่องสรุปตัวเลขหลัก (2 แถว x 3 คอลัมน์) */}
                    <div className="rounded-xl bg-surface-muted/50 dark:bg-white/[0.03] p-2 sm:p-3 border border-line/40 dark:border-white/5 text-center">
                      <div className="grid grid-cols-3 gap-1.5 pb-2 border-b border-line/40 dark:border-white/5">
                        <div>
                          <span className="text-[10px] sm:text-[11px] font-medium text-ink-muted block">จ่ายไปแล้ว</span>
                          <p className="font-display font-bold text-[12px] sm:text-[13.5px] tnum text-emerald-600 dark:text-emerald-400 truncate">
                            {thb(paidAmount)}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] sm:text-[11px] font-medium text-ink-muted block">คงเหลือ</span>
                          <p className={`font-display font-extrabold text-[12px] sm:text-[13.5px] tnum truncate ${l.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {l.balance > 0 ? `-${thb(l.balance)}` : '฿0'}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] sm:text-[11px] font-medium text-ink-muted block">เงินต้น</span>
                          <p className="font-display font-bold text-[12px] sm:text-[13.5px] tnum text-ink dark:text-white truncate">
                            {thb(originalBal)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-2">
                        <div>
                          <span className="text-[10px] sm:text-[11px] font-medium text-ink-muted block">ค่างวดต่อเดือน</span>
                          <p className="font-display font-bold text-[12px] sm:text-[13.5px] tnum text-ink dark:text-white truncate">
                            {l.monthlyPayment ? thb(l.monthlyPayment) : '-'}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] sm:text-[11px] font-medium text-ink-muted block">จ่ายล่าสุด</span>
                          <p className="font-display font-semibold text-[11px] sm:text-[12.5px] text-ink dark:text-white truncate">
                            {formatThaiDate(l.lastPaidDate)}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] sm:text-[11px] font-medium text-ink-muted block">เจ้าหนี้</span>
                          <p className="font-display font-semibold text-[11px] sm:text-[12.5px] text-ink dark:text-white truncate">
                            {l.lender || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2. Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-ink-muted">
                        <span>ความคืบหน้า ({percent}%)</span>
                        <span>{isCompleted ? 'ผ่อนครบทุกงวดแล้ว 🎉' : `เหลืออีก ${thb(l.balance)}`}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-muted dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percent >= 100 ? 'bg-emerald-500' : 'bg-pink-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* 3. ตารางการผ่อนชำระ (Visual Installment Pills Matrix - 4 ต่อแถวบนมือถือ) */}
                    {totalInst > 0 && (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center justify-between text-[11px] sm:text-[12px]">
                          <span className="font-bold text-ink dark:text-white">ตารางการผ่อนชำระ</span>
                          <span className="text-ink-muted font-medium text-[10.5px]">
                            {paidInst}/{totalInst} (เหลือ {remainingInst} งวด)
                          </span>
                        </div>

                        {/* 4 columns on mobile, 6 on sm, 8 on md */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                          {Array.from({ length: totalInst }, (_, i) => {
                            const termNum = i + 1
                            const isPaid = termNum <= paidInst
                            const isNext = termNum === paidInst + 1

                            return (
                              <button
                                key={termNum}
                                type="button"
                                onClick={() => {
                                  if (isPaid && termNum === paidInst) {
                                    handleUndo(l)
                                  } else if (isNext) {
                                    handlePay(l)
                                  }
                                }}
                                title={
                                  isPaid
                                    ? `งวดที่ ${termNum} (ชำระแล้ว - คลิกเพื่อ Undo)`
                                    : isNext
                                    ? `งวดที่ ${termNum} (งวดถัดไป - คลิกเพื่อจ่าย)`
                                    : `งวดที่ ${termNum} (ยังไม่ถึงกำหนด)`
                                }
                                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer select-none ${
                                  isPaid
                                    ? 'bg-[#b3cf82]/40 dark:bg-[#b3cf82]/25 border-[#9abf60]/60 text-[#2a4512] dark:text-[#d3ebb0] hover:brightness-95'
                                    : isNext
                                    ? 'bg-amber-400/25 dark:bg-amber-400/15 border-amber-500 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/40'
                                    : 'bg-surface-muted/50 dark:bg-white/[0.03] border-line/50 dark:border-white/10 text-ink-muted'
                                }`}
                              >
                                <span
                                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8.5px] font-extrabold shrink-0 ${
                                    isPaid
                                      ? 'bg-[#7a9d3e] text-white'
                                      : isNext
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-surface-muted dark:bg-white/10 text-ink-faint'
                                  }`}
                                >
                                  {isPaid ? '✓' : termNum}
                                </span>
                                <span className="tnum font-semibold text-[9.5px] sm:text-[10px] truncate">
                                  {pillAmount > 0 ? (pillAmount >= 1000 ? `${(pillAmount / 1000).toFixed(pillAmount % 1000 === 0 ? 0 : 1)}k` : pillAmount) : '0'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 4. Estimated Payoff Date */}
                    {isInst && !isCompleted && (
                      <div className="rounded-xl bg-surface-muted/40 dark:bg-white/[0.02] px-3 py-1.5 text-[10.5px] sm:text-[11px] text-ink-muted flex items-center justify-between">
                        <span>วันที่คาดว่าจะผ่อนหมด :</span>
                        <strong className="text-ink dark:text-white font-bold">{payoff.dateStr}</strong>
                      </div>
                    )}

                    {/* 5. Action Footer Buttons (Side by Side like reference image!) */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line/40 dark:border-white/5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setHistoryModalLiability(l)}
                        className="w-full text-[11.5px] sm:text-[12px] font-semibold py-1.5"
                      >
                        <ClockIcon className="h-3.5 w-3.5 mr-1 text-ink-muted" />
                        ประวัติการชำระ
                      </Button>

                      {isCompleted ? (
                        <div className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-[11.5px] sm:text-[12px] py-1.5">
                          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                          <span>ปลดหนี้แล้ว 🎉</span>
                        </div>
                      ) : dueInfo.status === 'paid' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUndo(l)}
                          className="w-full text-[11.5px] sm:text-[12px] font-semibold py-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        >
                          <CheckIcon className="h-3.5 w-3.5 mr-1" strokeWidth={2.4} />
                          จ่ายแล้ว (Undo)
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handlePay(l)}
                          className="w-full text-[11.5px] sm:text-[12px] font-bold py-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950 shadow-xs"
                        >
                          <CheckIcon className="h-3.5 w-3.5 mr-1" strokeWidth={2.4} />
                          จ่ายค่างวด {l.monthlyPayment ? `(${thb(l.monthlyPayment)})` : ''}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Payment History Modal ── */}
      <Modal
        open={historyModalLiability !== null}
        onClose={() => setHistoryModalLiability(null)}
        title={historyModalLiability ? `ประวัติการชำระ: ${historyModalLiability.name}` : 'ประวัติการชำระ'}
        description="ประวัติบันทึกการตัดรอบและชำระค่างวดที่บันทึกไว้ใน Activity Logs"
        size="lg"
      >
        <div className="space-y-3 py-1">
          {historyLogs.length === 0 ? (
            <div className="py-8 text-center text-ink-muted text-[13px]">
              ยังไม่มีประวัติการทำรายการสำหรับหนี้สินรายการนี้
            </div>
          ) : (
            <div className="divide-y divide-line/60 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
              {historyLogs.map((log: HoldingLog) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-[12.5px]">
                  <div>
                    <p className="font-semibold text-ink dark:text-white">{log.note}</p>
                    <p className="text-[11px] text-ink-faint mt-0.5">
                      {new Date(log.timestamp).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-surface-muted text-ink-muted uppercase">
                    {log.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        title="ยืนยันการลบรายการหนี้"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setItemToDelete(null)}>
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              ลบรายการ
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-ink-muted py-2">
          คุณแน่ใจหรือไม่ว่าต้องการลบรายการ &ldquo;<strong className="text-ink dark:text-white">{itemToDelete?.name}</strong>&rdquo; ออกจากระบบ? การลบนี้จะไม่สามารถย้อนคืนได้
        </p>
      </Modal>

      {/* ── Add / Edit Liabilities Modal ── */}
      <LiabilitiesModal
        open={liabilitiesModalOpen}
        onClose={() => {
          setLiabilitiesModalOpen(false)
          setEditingLiabilityId(null)
        }}
        initialLiabilityId={editingLiabilityId}
      />
    </div>
  )
}
