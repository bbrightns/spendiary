import type { SpendiaryData } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { upsert } from '../dataHelpers'

/**
 * DCA plans (confirming a buy still lives in DataContext).
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function upsertPlan(prev: SpendiaryData, ...[plan]: Parameters<DataContextValue['upsertPlan']>): SpendiaryData {
  const isEdit = plan.id && prev.dcaPlans.some((p) => p.id === plan.id)
  const updatedPlans = upsert(prev.dcaPlans, plan)
  const savedPlan = updatedPlans.find((p) => p.id === plan.id) || updatedPlans[updatedPlans.length - 1]

  const logEntry: import('../../lib/types').HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: isEdit ? 'edit' : 'add',
    holdingName: `DCA Plan: ${savedPlan.name}`,
    ticker: 'DCA',
    assetClass: savedPlan.assetClass,
    note: `${isEdit ? 'Updated' : 'Created'} DCA plan of ฿${savedPlan.monthlyAmount.toLocaleString()}/month`,
  }

  return {
    ...prev,
    dcaPlans: updatedPlans,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function removePlan(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['removePlan']>): SpendiaryData {
  const plan = prev.dcaPlans.find((p) => p.id === id)
  if (!plan) return prev
  const updatedPlans = prev.dcaPlans.filter((p) => p.id !== id)

  const logEntry: import('../../lib/types').HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: 'edit',
    holdingName: `DCA Plan: ${plan.name}`,
    ticker: 'DCA',
    assetClass: plan.assetClass,
    note: `Deleted DCA plan of ฿${plan.monthlyAmount.toLocaleString()}/month`,
  }

  return {
    ...prev,
    dcaPlans: updatedPlans,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function skipDcaBuy(prev: SpendiaryData, ...[planId, date]: Parameters<DataContextValue['skipDcaBuy']>): SpendiaryData {
  const plan = prev.dcaPlans.find((p) => p.id === planId)
  if (!plan) return prev

  const updatedPlans = prev.dcaPlans.map((p) =>
    p.id !== planId ? p : {
      ...p,
      skippedDates: [date, ...(p.skippedDates ?? [])],
    }
  )

  const logEntry: import('../../lib/types').HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: 'edit',
    holdingName: `DCA Plan: ${plan.name}`,
    ticker: 'DCA',
    assetClass: plan.assetClass,
    note: `Skipped DCA buy of ฿${plan.monthlyAmount.toLocaleString()} for this period`,
    dcaPlanId: plan.id,
    dcaDate: date,
  }

  return {
    ...prev,
    dcaPlans: updatedPlans,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}
