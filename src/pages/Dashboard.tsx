import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressRing } from '../components/charts/ProgressRing'
import { PnLPill } from '../components/ui/PnL'
import { CashAccountsForm } from '../components/forms/CashAccountsForm'
import {
  AlertIcon,
  ClockIcon,
  PortfolioIcon,
  SparkleIcon,
  WalletIcon,
} from '../components/icons'
import {
  ASSET_META,
  allocations,
  dcaThisMonth,
  netWorth,
  portfolioSummary,
  remainingTransfers,
  shouldConfirmBuy,
  totalCash,
  FREQUENCY_LABEL,
} from '../lib/calc'
import { daysUntil, formatDateShort, pct, thb, thbCompact } from '../lib/format'
import type { NetWorthSnapshot } from '../lib/types'

// Distinct colors for cash account segments — cycles if >8 accounts
const CASH_COLORS = [
  'var(--color-cash)',      // emerald
  'var(--color-brand)',     // indigo
  'var(--color-crypto)',    // amber
  'var(--color-stocks)',    // sky
  'var(--color-funds)',     // violet
  '#f472b6',               // pink
  '#fb923c',               // orange
  '#a78bfa',               // purple
]

export function Dashboard() {
  const { data, recordNetWorthSnapshot } = useData()
  const navigate = useNavigate()
  const [cashOpen, setCashOpen] = useState(false)
  const hasAnything =
    data.holdings.length > 0 || data.dcaPlans.length > 0 || data.transfers.length > 0

  const portfolio = useMemo(() => portfolioSummary(data.holdings), [data.holdings])
  const alloc = useMemo(() => allocations(data.holdings), [data.holdings])
  const dca = useMemo(() => dcaThisMonth(data.dcaPlans), [data.dcaPlans])
  const cash = useMemo(() => totalCash(data), [data.cashAccounts])
  const nw = useMemo(() => netWorth(data), [data.cashAccounts, data.holdings])

  const upcoming = useMemo(
    () =>
      [...data.transfers]
        .map((t) => ({ ...t, days: daysUntil(t.expiryDate) }))
        .filter((t) => remainingTransfers(t) > 0)
        .sort((a, b) => a.days - b.days)
        .slice(0, 4),
    [data.transfers],
  )

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Record today's net worth snapshot whenever nw updates
  useEffect(() => {
    if (nw > 0) recordNetWorthSnapshot(nw)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nw])

  const dcaActions = useMemo(
    () => data.dcaPlans.filter((p) => shouldConfirmBuy(p)),
    [data.dcaPlans],
  )
  const expiringTransfers = useMemo(
    () => data.transfers.filter((t) => daysUntil(t.expiryDate) <= 7 && remainingTransfers(t) > 0),
    [data.transfers],
  )

  if (!hasAnything) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <Card>
          <EmptyState
            icon={<SparkleIcon className="h-7 w-7" />}
            title="Welcome to Spendiary"
            description="Your private cockpit for investments, DCA plans, and transfer schedules — all in Thai Baht."
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`Good day${data.userName ? `, ${data.userName}` : ''}`}
        subtitle="Here's where your money stands."
      />

      {/* Today's actions strip */}
      {(dcaActions.length > 0 || expiringTransfers.length > 0) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {dcaActions.length > 0 && (
            <button
              onClick={() => navigate('/dca')}
              className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-soft px-3.5 py-2 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand hover:text-white active:scale-95"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                {dcaActions.length}
              </span>
              DCA {dcaActions.length === 1 ? 'plan needs' : 'plans need'} confirmation
            </button>
          )}
          {expiringTransfers.length > 0 && (
            <button
              onClick={() => navigate('/transfers')}
              className="inline-flex items-center gap-2 rounded-full border border-warn/25 bg-warn-soft px-3.5 py-2 text-[13px] font-semibold text-warn transition-colors hover:bg-warn hover:text-white active:scale-95"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warn text-[11px] font-bold text-white">
                {expiringTransfers.length}
              </span>
              Transfer {expiringTransfers.length === 1 ? 'schedule expires' : 'schedules expire'} this week
            </button>
          )}
        </div>
      )}

      {/* Net worth hero */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-ink to-ink-deep text-white animate-rise">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-white/60">
              <WalletIcon className="h-4 w-4" />
              <span className="text-[13px] font-medium">Total Net Worth</span>
            </div>
            <p className="mt-3 font-display text-[40px] font-extrabold leading-none tracking-tight tnum sm:text-[52px]">
              {thb(nw)}
            </p>
            <div className="mt-4 flex items-center gap-2.5">
              <PnLPill value={portfolio.pnl} size="md" />
              <span className="text-[13px] text-white/55">unrealised across portfolio</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60 ring-1 ring-white/10">
              Auto-calculated
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <p className="text-[12px] text-white/55">Invested</p>
              <p className="mt-0.5 font-display text-lg font-bold tnum">{thbCompact(portfolio.value)}</p>
            </div>
            <div>
              <p className="text-[12px] text-white/55">Cash</p>
              <p className="mt-0.5 font-display text-lg font-bold tnum">{thbCompact(cash)}</p>
            </div>
            {nw > 0 && (
              <div className="col-span-2 space-y-2 pt-1">
                <div className="flex h-1.5 overflow-hidden rounded-full">
                  {alloc.map((a) => (
                    <div
                      key={a.assetClass}
                      style={{ width: `${(a.value / nw) * 100}%`, background: ASSET_META[a.assetClass].cssVar }}
                    />
                  ))}
                  {cash > 0 && (
                    <div style={{ width: `${(cash / nw) * 100}%`, background: 'var(--color-cash)' }} />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {alloc.map((a) => (
                    <span key={a.assetClass} className="flex items-center gap-1 text-[11px] text-white/50">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ASSET_META[a.assetClass].cssVar }} />
                      {ASSET_META[a.assetClass].label} {Math.round((a.value / nw) * 100)}%
                    </span>
                  ))}
                  {cash > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-white/50">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--color-cash)' }} />
                      Cash {Math.round((cash / nw) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </Card>

      {/* Net worth history chart */}
      {(data.netWorthHistory?.length ?? 0) >= 2 && (
        <NetWorthChart history={data.netWorthHistory!} />
      )}

      {/* Metric tiles */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Portfolio Value"
          value={thb(portfolio.value)}
          icon={<PortfolioIcon className="h-[18px] w-[18px]" />}
          accent="var(--color-funds)"
          onClick={() => navigate('/portfolio')}
          footer={
            <div className="flex items-center gap-2">
              <PnLPill value={portfolio.pnlPct} asPct />
              <span className="text-[12.5px] text-ink-muted">all-time</span>
            </div>
          }
        />
        <StatCard
          label="Monthly DCA"
          value={thb(dca.invested)}
          icon={<ClockIcon className="h-[18px] w-[18px]" />}
          accent="var(--color-brand)"
          onClick={() => navigate('/dca')}
          footer={
            <span className="text-[12.5px] text-ink-muted">
              of {thb(dca.total)} this month · {pct(dca.pct, 0)}
            </span>
          }
        />
        <StatCard
          label="Cash Available"
          value={thb(cash)}
          icon={<WalletIcon className="h-[18px] w-[18px]" />}
          accent="var(--color-cash)"
          editable
          onClick={() => setCashOpen(true)}
          className="sm:col-span-2 xl:col-span-3"
          footer={
            data.cashAccounts.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex h-1.5 overflow-hidden rounded-full">
                  {data.cashAccounts.map((a, i) => (
                    <div
                      key={a.id}
                      style={{
                        width: `${(a.balance / cash) * 100}%`,
                        background: CASH_COLORS[i % CASH_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {data.cashAccounts.map((a, i) => (
                    <span key={a.id} className="flex items-center gap-1 text-[11.5px] text-ink-muted">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: CASH_COLORS[i % CASH_COLORS.length] }}
                      />
                      {a.name} {thbCompact(a.balance)}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-[12.5px] font-medium text-brand">Tap to add accounts</span>
            )
          }
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* DCA progress */}
        <Card className={`animate-rise ${upcoming.length > 0 ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[17px] font-bold text-ink [text-wrap:balance]">This Month's DCA</h2>
            <Link to="/dca" className="text-[13px] font-semibold text-brand hover:underline" aria-label="View DCA planner">
              DCA planner
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-6">
            <ProgressRing
              value={dca.pct}
              size={132}
              thickness={13}
              ariaLabel={`This month's DCA progress, ${Math.round(dca.pct)}% bought`}
            >
              <div className="text-center">
                <p className="font-display text-2xl font-extrabold tnum text-ink">
                  {Math.round(dca.pct)}%
                </p>
                <p className="text-[11px] font-medium text-ink-muted">bought</p>
              </div>
            </ProgressRing>
            <div className="flex-1 space-y-3">
              <Row label="Bought so far" value={thb(dca.invested)} strong />
              <Row label="Upcoming" value={thb(dca.upcoming)} />
              <Row label="Monthly total" value={thb(dca.total)} muted />
            </div>
          </div>
        </Card>

        {/* Upcoming expirations — hidden entirely when empty */}
        {upcoming.length > 0 && (
          <Card className="lg:col-span-3 animate-rise" padded={false}>
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
              <div>
                <h2 className="font-display text-[17px] font-bold text-ink [text-wrap:balance]">Upcoming Expirations</h2>
                <p className="text-[13px] text-ink-muted">Transfer schedules ending soon</p>
              </div>
              <Link to="/transfers" className="text-[13px] font-semibold text-brand hover:underline" aria-label="View all transfers">
                All transfers
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {upcoming.map((t) => {
                const soon = t.days <= 14
                return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${soon ? 'bg-warn-soft text-warn' : 'bg-surface-muted text-ink-soft'}`}>
                      {soon ? <AlertIcon className="h-[18px] w-[18px]" /> : <ClockIcon className="h-[18px] w-[18px]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{t.recipient}</p>
                      <p className="text-[12.5px] text-ink-muted">
                        {thb(t.amount)} · {FREQUENCY_LABEL[t.frequency]} · {remainingTransfers(t)} left
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[13px] font-bold ${soon ? 'text-warn' : 'text-ink'}`}>
                        {t.days <= 0 ? 'Due' : `${t.days}d`}
                      </p>
                      <p className="text-[11.5px] text-ink-muted">{formatDateShort(t.expiryDate)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>

      <CashAccountsForm open={cashOpen} onClose={() => setCashOpen(false)} />
    </>
  )
}

// ── Net Worth History Chart ───────────────────────────────────────────────────

function NetWorthChart({ history }: { history: NetWorthSnapshot[] }) {
  const W = 600, H = 96
  const PAD_X = 2, PAD_Y = 10
  const iW = W - PAD_X * 2
  const iH = H - PAD_Y * 2

  const vals = history.map((s) => s.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const pts = history.map((s, i) => ({
    x: PAD_X + (i / (history.length - 1)) * iW,
    y: PAD_Y + (1 - (s.value - minV) / range) * iH,
    ...s,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H}Z`

  const first = history[0]
  const last = history[history.length - 1]
  const change = last.value - first.value
  const changePct = Math.abs((change / first.value) * 100)
  const isUp = change >= 0
  const color = isUp ? '#10b981' : '#c03252'

  // Show last 90 days label, or actual range
  const [y0, mo0, d0] = first.date.split('-').map(Number)
  const startDate = new Date(y0, mo0 - 1, d0).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return (
    <Card className="mt-5 animate-rise overflow-hidden" padded={false}>
      <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-5">
        <div>
          <h2 className="font-display text-[15px] font-bold text-ink">Net Worth History</h2>
          <p className="text-[12.5px] text-ink-muted">{history.length} snapshots · since {startDate}</p>
        </div>
        <div className={`flex items-baseline gap-1 rounded-full px-3 py-1 text-[13px] font-bold ${isUp ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss'}`}>
          {isUp ? '▲' : '▼'} {changePct.toFixed(1)}%
          <span className="text-[11px] font-medium opacity-70">from start</span>
        </div>
      </div>
      <div className="relative px-5 pb-4 pt-3 sm:px-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 88, display: 'block' }} aria-hidden>
          <defs>
            <linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#nwg)" />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill={color} />
        </svg>
        {/* Date axis */}
        <div className="flex justify-between">
          <span className="text-[11px] text-ink-faint">{startDate}</span>
          <span className="text-[11px] font-semibold text-ink-muted">{thb(last.value)} today</span>
          <span className="text-[11px] text-ink-faint">{todayLabel}</span>
        </div>
      </div>
    </Card>
  )
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span
        className={`tnum ${
          strong ? 'text-[15px] font-bold text-ink' : muted ? 'text-[13.5px] text-ink-muted' : 'text-[14px] font-semibold text-ink-soft'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
