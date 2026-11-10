import { useMemo, useState } from 'react'
import { useData } from '../../store/DataContext'
import { Modal } from '../ui/Modal'
import { Inset } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { PnLPill } from '../ui/PnL'
import { SegmentedControl } from '../ui/SegmentedControl'
import { BuyTrendIcon } from '../icons'
import { BuyTrendChart } from './BuyTrendChart'
import { buildBuyTrend, buyTrendStats, groupBuys } from '../../lib/buyTrend'
import { unitPrice } from '../../lib/buyTrendFormat'
import { hasRealPrice } from '../../lib/calc'
import { thb } from '../../lib/format'
import type { DcaPlan, Holding } from '../../lib/types'

type Scope = 'plan' | 'all'

interface BuyTrendSheetProps {
  open: boolean
  onClose: () => void
  /** Opened from a holding: every paid buy of it */
  holding?: Holding | null
  /** Opened from a DCA plan: the plan's buys, with the whole holding one tap away */
  plan?: DcaPlan | null
}

function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function units(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: value >= 100 ? 2 : 6 })
}

/** Where each buy was made, against the average buy price and today's price. Free units are left out. */
export function BuyTrendSheet({ open, onClose, holding: holdingProp, plan }: BuyTrendSheetProps) {
  const { data } = useData()
  const logs = useMemo(() => data.holdingLogs ?? [], [data.holdingLogs])
  const [scope, setScope] = useState<Scope>('plan')
  const [active, setActive] = useState<number | null>(null)

  // A plan's holding: the one it is linked to, else the one its latest buy went into
  const holding = useMemo(() => {
    if (holdingProp) return data.holdings.find((h) => h.id === holdingProp.id) ?? holdingProp
    if (!plan) return null
    const id = plan.holdingId ?? logs.find((l) => l.dcaPlanId === plan.id && l.holdingId)?.holdingId
    return id ? data.holdings.find((h) => h.id === id) ?? null : null
  }, [holdingProp, plan, logs, data.holdings])

  const canSwitch = Boolean(plan && holding)
  const effective: Scope = plan && (scope === 'plan' || !holding) ? 'plan' : 'all'
  const trend = useMemo(
    () => buildBuyTrend(logs, effective === 'plan' && plan ? { planId: plan.id } : { holdingId: holding?.id }),
    [logs, effective, plan, holding?.id],
  )
  const current = holding && hasRealPrice(holding) && holding.price > 0 ? holding.price : null
  const stats = buyTrendStats(trend, current)
  const { points, by } = useMemo(() => groupBuys(trend.buys), [trend.buys])
  const activePoint = active !== null ? points[active] : undefined

  const name = plan?.name ?? holding?.name ?? ''
  const notes = [
    by !== 'buy' && `Buys are grouped by ${by} so the dots stay readable.`,
    trend.receivedCount > 0 && `${trend.receivedCount} received for free ${trend.receivedCount === 1 ? 'is' : 'are'} left out.`,
    trend.unreadableCount > 0 && `${trend.unreadableCount} older ${trend.unreadableCount === 1 ? 'entry has' : 'entries have'} no price to show.`,
    !current && holding && 'No market price yet, so buys are not compared with today.',
    effective === 'all' && holding?.assetClass === 'stock' && 'Prices are in baht, so the dollar rate on each day is part of them.',
  ].filter(Boolean) as string[]

  const close = () => { setActive(null); onClose() }

  return (
    <Modal open={open} onClose={close} title="Buy trend" description={name} size="lg">
      <div className="space-y-5">
        {canSwitch && (
          <SegmentedControl
            size="sm"
            value={effective}
            onChange={(v) => { setScope(v); setActive(null) }}
            options={[
              { value: 'plan', label: 'This plan' },
              { value: 'all', label: `All buys of ${holding?.ticker || holding?.name}` },
            ]}
          />
        )}

        {trend.buys.length === 0 ? (
          <EmptyState
            icon={<BuyTrendIcon className="h-7 w-7" />}
            title="No buys yet"
            description={plan && !holding
              ? 'Link this plan to a holding, then each logged buy shows here with its price.'
              : 'Each buy you log shows here with the price you paid.'}
          />
        ) : (
          <>
            <Inset className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold text-ink-muted">Average buy price</p>
                <p className="mt-0.5 font-display text-lg font-extrabold tnum text-ink">{trend.avg ? unitPrice(trend.avg) : '−'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-muted">Price now</p>
                <p className="mt-0.5 font-display text-lg font-extrabold tnum text-ink">{current ? unitPrice(current) : '−'}</p>
                {stats.vsAvg !== null && <div className="mt-1"><PnLPill value={stats.vsAvg * 100} asPct /></div>}
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-muted">Bought below now</p>
                <p className="mt-0.5 font-display text-lg font-extrabold tnum text-ink">
                  {stats.belowNow !== null ? `${Math.round(stats.belowNow * trend.buys.length)} of ${trend.buys.length}` : '−'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-muted">Lowest · highest</p>
                <p className="mt-0.5 text-sm font-semibold tnum text-ink">{stats.cheapest ? unitPrice(stats.cheapest.price) : '−'}</p>
                <p className="text-sm font-semibold tnum text-ink-muted">{stats.dearest ? unitPrice(stats.dearest.price) : '−'}</p>
              </div>
            </Inset>

            <div>
              <BuyTrendChart
                points={points}
                sells={trend.sells}
                avg={trend.avg}
                current={current}
                active={active}
                onActive={setActive}
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-ink-soft" />Average</span>
                {current && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-invest" />Now</span>}
                {current ? (
                  <>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gain" />Bought below now</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-loss" />Above now</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-invest" />Buy</span>
                )}
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-ink-muted" />Not from DCA</span>
                <span>Bigger dot = more money</span>
                {trend.sells.length > 0 && <span>▼ Sale</span>}
              </div>
            </div>

            <div className="min-h-[60px] rounded-2xl border border-dashed border-line-strong p-3 text-sm" aria-live="polite">
              {activePoint ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink tnum">
                      {longDate(activePoint.date)}
                      {activePoint.endDate !== activePoint.date && ` – ${longDate(activePoint.endDate)}`}
                    </p>
                    <p className="text-xs text-ink-muted tnum">
                      {activePoint.count > 1 ? `${activePoint.count} buys · ` : ''}
                      {thb(activePoint.thb)} · {units(activePoint.units)} units · average after {unitPrice(activePoint.avgAfter)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display font-extrabold tnum text-ink">{unitPrice(activePoint.price)}</p>
                    {current && <PnLPill value={(current / activePoint.price - 1) * 100} asPct />}
                  </div>
                </div>
              ) : (
                <p className="text-ink-muted tnum">
                  {trend.buys.length} {trend.buys.length === 1 ? 'buy' : 'buys'} · {thb(trend.totalThb)} spent · {units(trend.totalUnits)} units. Tap a dot to see that buy.
                </p>
              )}
            </div>

            {notes.length > 0 && (
              <ul className="space-y-1 text-xs text-ink-muted">
                {notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
