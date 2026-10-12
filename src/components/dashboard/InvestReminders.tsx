import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DcaPlan, Holding } from '../../lib/types'
import {
  ASSET_META,
  getHoldingDpsForMonth,
  isBuyDayToday,
  isDividendReceivedThisMonth,
  isLiabilityActionableThisMonth,
  nextBuyDate,
  shouldConfirmBuy,
} from '../../lib/calc'
import { thb, thbCompact } from '../../lib/format'
import { useData } from '../../store/DataContext'
import { DcaIcon, ReceiptPercentIcon } from '../icons'

const FREQ: Record<string, string> = { daily: 'daily', weekly: 'weekly', biweekly: 'every 2 weeks', monthly: 'monthly', quarterly: 'quarterly' }
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)

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

/**
 * Invest's "Today" stack, in the same style as Spend's bill cards: DCA buys to confirm and
 * dividends to log (each with its own button), a quiet line for loans (paid from Spend), and
 * the next few DCA buys with what, how much and when.
 */
export function InvestReminders({ onConfirmDca, onLogDividend }: Props) {
  const { data } = useData()
  const now = new Date()
  const month = now.getMonth() + 1
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' })
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const account = (id?: string) => data.cashAccounts.find((a) => a.id === id)?.name

  // Late first, then due today
  const dcaDue = data.dcaPlans.filter((p) => shouldConfirmBuy(p, now)).sort((a, b) => Number(isBuyDayToday(a, now)) - Number(isBuyDayToday(b, now)))
  const dividends = (data.holdings ?? []).filter(
    (h) => h.paysDividend && (h.dividendMonths ?? []).includes(month) && !isDividendReceivedThisMonth(h.id, data.dividendRecords),
  )
  const loansDue = (data.liabilities ?? []).filter((l) => isLiabilityActionableThisMonth(l)).length
  // Non-daily buys in the next week (weekly plans only in their last 2 days, so it isn't always full)
  const upcoming = data.dcaPlans
    .filter((p) => (p.frequency ?? 'monthly') !== 'daily' && !shouldConfirmBuy(p, now))
    .map((p) => {
      const next = nextBuyDate(p, now)
      const days = Math.round((new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime() - startOfToday) / 86_400_000)
      return { plan: p, next, days }
    })
    .filter((x) => x.days >= 0 && x.days <= ((x.plan.frequency ?? 'monthly') === 'weekly' ? 2 : 7))
    .sort((a, b) => a.days - b.days)

  if (dcaDue.length + dividends.length + loansDue + upcoming.length === 0) return null

  return (
    <div id="guide-dashboard-dca" className="space-y-2" role="region" aria-label="To do today">
      {dcaDue.map((p) => {
        const today = isBuyDayToday(p, now)
        const t = planTitle(p)
        const into = p.assetClass === 'cash' ? account(p.cashAccountId) : undefined
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onConfirmDca(p)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer animate-rise ${
              today ? 'border-brand/30 bg-brand-soft/70 hover:bg-brand-soft' : 'border-warn/30 bg-warn-soft hover:bg-warn-soft/70'
            }`}
          >
            <AssetBadge assetClass={p.assetClass}>
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
                {thb(p.monthlyAmount)} {FREQ[p.frequency ?? 'monthly']} · {today ? 'due today' : 'late'}
                {into && ` · into ${into}`}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white dark:bg-[#4f46e5]">Confirm</span>
          </button>
        )
      })}

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

      {/* Loans are paid from Spend; one quiet line so they aren't missed from here */}
      {loansDue > 0 && (
        <Link
          to="/spend/loans"
          className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted/60"
        >
          <span>
            <span className="font-semibold text-ink-soft">
              {loansDue} loan {loansDue === 1 ? 'payment' : 'payments'}
            </span>{' '}
            due this month · paid from Spend
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/80 px-4 py-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">Next DCA buys</p>
          <ul className="divide-y divide-line/60">
            {upcoming.slice(0, 3).map(({ plan, next, days }) => {
              const t = planTitle(plan)
              return (
                <li key={plan.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-24 shrink-0 tnum">
                    <span className="block text-xs font-semibold text-ink-soft">{dayLabel(next)}</span>
                    <span className={`block text-[11px] font-semibold ${days <= 1 ? 'text-warn' : 'text-ink-muted'}`}>{inDays(days)}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ASSET_META[plan.assetClass]?.color }} />
                    <span className="truncate font-semibold text-ink">{t.name}</span>
                    {t.ticker && <span className="shrink-0 text-xs text-ink-muted">{t.ticker}</span>}
                  </span>
                  <span className="shrink-0 font-semibold tnum text-ink">{thbCompact(plan.monthlyAmount)}</span>
                </li>
              )
            })}
          </ul>
          {upcoming.length > 3 && (
            <Link to="/dca" className="mt-1 inline-block text-xs font-semibold text-brand hover:underline">
              +{upcoming.length - 3} more in DCA →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
