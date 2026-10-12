import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DcaPlan, Holding } from '../../lib/types'
import {
  ASSET_META,
  getHoldingDpsForMonth,
  getLiabilityDueStatus,
  isBuyDayToday,
  isDividendReceivedThisMonth,
  isLiabilityActionableThisMonth,
  shouldConfirmBuy,
} from '../../lib/calc'
import { thb } from '../../lib/format'
import { useData } from '../../store/DataContext'
import { DcaIcon, ReceiptPercentIcon } from '../icons'

const FREQ: Record<string, string> = { daily: 'daily', weekly: 'weekly', biweekly: 'every 2 weeks', monthly: 'monthly', quarterly: 'quarterly' }

/** "Buy US Tech Leaders" + its ticker when the name doesn't already say it */
function planTitle(p: DcaPlan) {
  const verb = p.assetClass === 'cash' ? 'Save to' : 'Buy'
  const showTicker = !!p.ticker && !p.name.toUpperCase().includes(p.ticker.toUpperCase())
  return { verb, name: p.name, ticker: showTicker ? p.ticker : undefined }
}

function AssetBadge({ assetClass, children }: { assetClass: string; children: ReactNode }) {
  const color = ASSET_META[assetClass as keyof typeof ASSET_META]?.color ?? '#64748b'
  return (
    <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg text-white" style={{ background: color }}>
      {children}
    </span>
  )
}

interface Props {
  onConfirmDca: (plan: DcaPlan) => void
  onLogDividend: (holding: Holding, dps: number) => void
}

/** One DCA buy to confirm: the whole card is the button. */
function DcaCard({ plan, now, into, onConfirm }: { plan: DcaPlan; now: Date; into?: string; onConfirm: () => void }) {
  const today = isBuyDayToday(plan, now)
  const t = planTitle(plan)
  return (
    <button
      type="button"
      onClick={onConfirm}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer animate-rise ${
        today ? 'border-brand/30 bg-brand-soft/70 hover:bg-brand-soft' : 'border-warn/30 bg-warn-soft hover:bg-warn-soft/70'
      }`}
    >
      <AssetBadge assetClass={plan.assetClass}>
        <DcaIcon className="h-4 w-4" />
      </AssetBadge>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-ink">
          <span className="truncate">
            {t.verb} {t.name}
          </span>
          {/* Phones keep the room for the name; the ticker shows from sm up */}
          {t.ticker && <span className="hidden shrink-0 rounded-md bg-surface/70 px-1.5 py-0.5 text-[11px] font-bold text-ink-soft sm:inline">{t.ticker}</span>}
        </span>
        <span className={`block truncate text-xs font-semibold tnum ${today ? 'text-brand-ink' : 'text-warn'}`}>
          {thb(plan.monthlyAmount)} {FREQ[plan.frequency ?? 'monthly']} · {today ? 'due today' : 'late'}
          {into && ` · into ${into}`}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white dark:bg-[#4f46e5]">Confirm</span>
    </button>
  )
}

/**
 * Invest's "Today" stack, in the same style as Spend's bill cards: DCA buys to confirm (one card,
 * or a single summary card that opens into a list when there are several), dividends to log, and
 * a quiet line for loans (paid from Spend). Upcoming buys live on the DCA page.
 */
export function InvestReminders({ onConfirmDca, onLogDividend }: Props) {
  const { data } = useData()
  const [dcaOpen, setDcaOpen] = useState(false)
  const now = new Date()
  const month = now.getMonth() + 1
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' })
  const account = (id?: string) => data.cashAccounts.find((a) => a.id === id)?.name

  // Late first, then due today
  const dcaDue = data.dcaPlans.filter((p) => shouldConfirmBuy(p, now)).sort((a, b) => Number(isBuyDayToday(a, now)) - Number(isBuyDayToday(b, now)))
  const dcaLate = dcaDue.filter((p) => !isBuyDayToday(p, now)).length
  const dcaTotal = dcaDue.reduce((sum, p) => sum + p.monthlyAmount, 0)
  const dividends = (data.holdings ?? []).filter(
    (h) => h.paysDividend && (h.dividendMonths ?? []).includes(month) && !isDividendReceivedThisMonth(h.id, data.dividendRecords),
  )
  const loans = (data.liabilities ?? []).filter((l) => isLiabilityActionableThisMonth(l))
  const loansDue = loans.length
  // The old red "Overdue debts" chip is gone, so the quiet line still calls out anything late
  const loansOverdue = loans.filter((l) => getLiabilityDueStatus(l).status === 'overdue').length
  if (dcaDue.length + dividends.length + loansDue === 0) return null

  return (
    <div id="guide-dashboard-dca" className="space-y-2" role="region" aria-label="To do today">
      {dcaDue.length === 1 && (
        <DcaCard plan={dcaDue[0]} now={now} into={dcaDue[0].assetClass === 'cash' ? account(dcaDue[0].cashAccountId) : undefined} onConfirm={() => onConfirmDca(dcaDue[0])} />
      )}

      {/* Several buys: one summary card so they don't push the rest of Home down */}
      {dcaDue.length > 1 && (
        <div className={`overflow-hidden rounded-2xl border animate-rise ${dcaLate > 0 ? 'border-warn/30 bg-warn-soft' : 'border-brand/30 bg-brand-soft/70'}`}>
          <button
            type="button"
            onClick={() => setDcaOpen((o) => !o)}
            aria-expanded={dcaOpen}
            className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer"
          >
            <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-brand text-white">
              <DcaIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{dcaDue.length} DCA buys to confirm</span>
              <span className="block truncate text-xs font-semibold tnum text-brand-ink">
                {thb(dcaTotal)} total
                {dcaLate > 0 && <span className="text-warn"> · {dcaLate} late</span>}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white dark:bg-[#4f46e5]">{dcaOpen ? 'Hide' : 'Review'}</span>
          </button>
          {dcaOpen && (
            <ul className="divide-y divide-line/60 border-t border-line/60 bg-surface/60">
              {dcaDue.map((p) => {
                const t = planTitle(p)
                const late = !isBuyDayToday(p, now)
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ASSET_META[p.assetClass]?.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {t.verb} {t.name}
                      </span>
                      <span className={`block truncate text-xs font-semibold tnum ${late ? 'text-warn' : 'text-ink-muted'}`}>
                        {thb(p.monthlyAmount)} {FREQ[p.frequency ?? 'monthly']} · {late ? 'late' : 'due today'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onConfirmDca(p)}
                      className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer dark:bg-[#4f46e5]"
                    >
                      Confirm
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {dividends.map((h) => {
        const dps = getHoldingDpsForMonth(h, month)
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onLogDividend(h, dps)}
            className="flex w-full items-center gap-3 rounded-2xl border border-gain/30 bg-gain-soft px-4 py-3 text-left transition-colors cursor-pointer hover:bg-gain-soft/70 animate-rise"
          >
            <AssetBadge assetClass={h.assetClass}>
              <ReceiptPercentIcon className="h-4 w-4" />
            </AssetBadge>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">Dividend from {h.name}</span>
              <span className="block truncate text-xs font-semibold text-gain">
                Expected in {monthName}
                {dps > 0 && ` · ${dps} per share`} · log it when it arrives
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white dark:bg-[#4f46e5]">Log</span>
          </button>
        )
      })}

      {/* Loans are paid from Spend; one quiet line so they aren't missed from here (the count is orange because it's due) */}
      {loansDue > 0 && (
        <Link
          to="/spend/loans"
          className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted/60"
        >
          <span>
            <span className="font-semibold text-warn">
              {loansDue} loan {loansDue === 1 ? 'payment' : 'payments'}
            </span>{' '}
            due this month · paid from Spend
            {loansOverdue > 0 && <span className="font-semibold text-loss"> · {loansOverdue} overdue</span>}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  )
}
