import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  TransferIcon,
  WalletIcon,
} from '../components/icons'
import {
  ASSET_META,
  allocations,
  dcaThisMonth,
  netWorth,
  portfolioSummary,
  remainingTransfers,
  totalCash,
  FREQUENCY_LABEL,
} from '../lib/calc'
import { daysUntil, formatDateShort, pct, thb, thbCompact } from '../lib/format'

export function Dashboard() {
  const { data } = useData()
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
      <PageHeader eyebrow={today} title="Good day, Praween" subtitle="Here's where your money stands." />

      {/* Net worth hero */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-ink to-ink-deep text-white animate-rise">
        <span className="absolute right-5 top-5 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white/70 ring-1 ring-white/10">
          Auto-calculated
        </span>
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
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
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
      </Card>

      {/* Metric tiles */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Portfolio Value"
          value={thb(portfolio.value)}
          icon={<PortfolioIcon className="h-[18px] w-[18px]" />}
          accent="var(--color-funds)"
          footer={
            <div className="flex items-center gap-2">
              <PnLPill value={portfolio.pnlPct} asPct />
              <span className="text-[12.5px] text-ink-muted">all-time</span>
            </div>
          }
        />
        <StatCard
          label="Cash Available"
          value={thb(cash)}
          icon={<WalletIcon className="h-[18px] w-[18px]" />}
          accent="var(--color-cash)"
          editable
          onClick={() => setCashOpen(true)}
          footer={
            data.cashAccounts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.cashAccounts.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11.5px] font-medium text-ink-soft"
                  >
                    {a.name}
                    <span className="tnum text-ink-muted">{thbCompact(a.balance)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[12.5px] font-medium text-brand">Tap to add accounts</span>
            )
          }
        />
        <StatCard
          label="Monthly DCA"
          value={thb(dca.invested)}
          icon={<ClockIcon className="h-[18px] w-[18px]" />}
          accent="var(--color-brand)"
          footer={
            <span className="text-[12.5px] text-ink-muted">
              of {thb(dca.total)} this month · {pct(dca.pct, 0)}
            </span>
          }
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* DCA progress */}
        <Card className="lg:col-span-2 animate-rise">
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

        {/* Upcoming expirations */}
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

          {upcoming.length === 0 ? (
            <EmptyState
              icon={<TransferIcon className="h-6 w-6" />}
              title="Nothing expiring"
              description="Active transfer schedules will appear here as they approach their end date."
              accent="var(--color-cash)"
            />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {upcoming.map((t) => {
                const soon = t.days <= 14
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        soon ? 'bg-warn-soft text-warn' : 'bg-surface-muted text-ink-soft'
                      }`}
                    >
                      {soon ? <AlertIcon className="h-[18px] w-[18px]" /> : <ClockIcon className="h-[18px] w-[18px]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{t.recipient}</p>
                      <p className="text-[12.5px] text-ink-muted">
                        {thb(t.amount)} · {FREQUENCY_LABEL[t.frequency]} · {remainingTransfers(t)} left
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-[13px] font-bold ${soon ? 'text-warn' : 'text-ink'}`}
                      >
                        {t.days <= 0 ? 'Due' : `${t.days}d`}
                      </p>
                      <p className="text-[11.5px] text-ink-muted">{formatDateShort(t.expiryDate)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <CashAccountsForm open={cashOpen} onClose={() => setCashOpen(false)} />
    </>
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
