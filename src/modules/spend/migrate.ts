import type { SpendRecurring, SpendiaryData } from '../../lib/types'
import { localDateStr } from '../../lib/format'

/** Best-guess category from a fixed cost's name (English or Thai). */
function guessCategory(name: string): string {
  const n = name.toLowerCase()
  if (/rent|condo|mortgage|house|home|apartment|common fee|ค่าเช่า|คอนโด|บ้าน|ส่วนกลาง/.test(n)) return 'housing'
  if (/family|parent|mom|dad|allowance|พ่อ|แม่|ครอบครัว/.test(n)) return 'family'
  if (/insurance|health|gym|ประกัน|สุขภาพ/.test(n)) return 'health'
  if (/car|transport|fuel|gas|bts|รถ|น้ำมัน/.test(n)) return 'transport'
  return 'bills'
}

/**
 * One-time move of the Invest-side fixed cost list into Spend as monthly recurring
 * bills (counted as fixed costs). The old list is left in place as a backup.
 * Starts today, so nothing shows up as overdue; the first one is due next month.
 */
export function importFixedCosts(data: SpendiaryData): SpendiaryData {
  if (data.spendSettings?.fixedCostsImported) return data
  const items = data.fixedCostItems ?? []
  const existing = data.spendRecurring ?? []
  const imported: SpendRecurring[] = items
    .filter((item) => item.amount > 0 && !existing.some((r) => r.id === `fc-${item.id}`))
    .map((item) => ({
      id: `fc-${item.id}`,
      name: item.name,
      type: 'expense',
      amount: item.amount,
      categoryId: guessCategory(item.name),
      frequency: 'monthly',
      day: 1,
      startDate: localDateStr(),
      fixedCost: true,
    }))
  return {
    ...data,
    spendRecurring: [...existing, ...imported],
    spendSettings: { ...data.spendSettings, fixedCostsImported: true },
  }
}
