import type { AcquisitionSource, HoldingLog } from './types'

const RECEIVED_SUFFIX = /\s*·\s*Received(?: from [^·]*)?\s*$/

/**
 * Rewrite a buy / add note for a new acquisition source: "฿X spent" ↔ "฿X worth",
 * and the trailing "· Received from …" is added, updated or removed.
 */
export function noteForSource(note: string, source: AcquisitionSource, receivedFrom?: string): string {
  let n = note.replace(RECEIVED_SUFFIX, '')
  if (source === 'received') {
    n = n.replace(/(฿[0-9,.]+)\s*spent\b/, '$1 worth')
    const from = receivedFrom?.trim()
    return `${n} · Received${from ? ` from ${from}` : ''}`
  }
  return n.replace(/(฿[0-9,.]+)\s*worth\b/, '$1 spent')
}

/** A buy that moved money out of a cash account (or came from a DCA plan) stays a purchase. */
export function logTookCash(log: HoldingLog): boolean {
  return Boolean(
    log.cashAccountId ||
    log.paidFromAccountId ||
    log.dcaPlanId ||
    /(?:Paid from|จ่ายจาก)/i.test(log.note) ||
    /\bDCA\b/.test(log.note),
  )
}

/** Name of the account a buy was paid from, when the log records one. */
export function paidFromName(log: HoldingLog): string | undefined {
  return log.note.match(/(?:Paid from|จ่ายจาก)\s*([^·\n()]+)/i)?.[1].trim()
}
