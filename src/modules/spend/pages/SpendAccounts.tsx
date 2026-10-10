import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ChevronRightIcon, CreditCardIcon } from '../../../components/icons'
import { thb } from '../../../lib/format'
import type { SpendCard } from '../../../lib/types'
import { CardSheet, StarIcon, WalletSheet } from '../AccountSheets'
import { cardCycle, monthKey, upcomingDue } from '../logic'
import { MethodIcon } from '../PayMethodPicker'
import { useSpend, type PayMethod } from '../useSpend'

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function SpendAccounts() {
  const { transactions, methods, cards, settings, toggleFavorite } = useSpend()
  const navigate = useNavigate()
  const [cardSheet, setCardSheet] = useState<{ open: boolean; card?: SpendCard }>({ open: false })
  const [walletSheet, setWalletSheet] = useState<PayMethod | undefined>()
  const month = monthKey()
  const favs = settings.favoriteAccountIds ?? []

  const wallets = methods.filter((m) => m.kind === 'cash')
  const cashTotal = wallets.reduce((s, w) => s + w.balance, 0)
  const owed = cards.reduce((s, c) => s + c.balance, 0)
  const limit = cards.reduce((s, c) => s + c.creditLimit, 0)

  // This month's in / out per wallet (transfers count on both sides)
  const flows = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>()
    const bump = (id: string | undefined, key: 'in' | 'out', v: number) => {
      if (!id) return
      const f = map.get(id) ?? { in: 0, out: 0 }
      f[key] += v
      map.set(id, f)
    }
    for (const t of transactions) {
      if (!t.date.startsWith(month)) continue
      if (t.type === 'income') bump(t.accountId, 'in', t.amount)
      else if (t.type === 'expense') bump(t.accountId, 'out', t.amount)
      else {
        bump(t.accountId, 'out', t.amount)
        bump(t.toAccountId, 'in', t.amount)
      }
    }
    return map
  }, [transactions, month])

  /** Charges minus refunds on a card since its last statement. */
  const cycleSpend = (card: SpendCard, since: string) =>
    transactions
      .filter((t) => t.accountId === card.id && t.date > since)
      .reduce((s, t) => s + (t.type === 'expense' ? t.amount : t.type === 'income' ? -t.amount : 0), 0)

  const star = (id: string, name: string) => {
    const on = favs.includes(id)
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(id)
        }}
        aria-pressed={on}
        aria-label={on ? `Unfavorite ${name}` : `Favorite ${name}`}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors cursor-pointer hover:bg-surface-muted ${on ? 'text-amber-500' : 'text-ink-faint'}`}
      >
        <StarIcon filled={on} />
      </button>
    )
  }

  const defaultBadge = (id: string) =>
    settings.defaultAccountId === id && (
      <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-ink">Default</span>
    )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Spend"
        title="Accounts"
        subtitle="Wallets and credit cards you pay with. Star the ones you use most."
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        <Card className="p-3 sm:p-5 animate-rise" padded={false}>
          <p className="text-xs font-medium text-ink-muted">In wallets</p>
          <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate text-ink">{thb(cashTotal)}</p>
        </Card>
        <Card className="p-3 sm:p-5 animate-rise" padded={false}>
          <p className="text-xs font-medium text-ink-muted">Owed on cards</p>
          <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate text-ink">{thb(owed)}</p>
          {limit > 0 && <p className="mt-0.5 text-xs text-ink-muted tnum">{thb(limit - owed)} available</p>}
        </Card>
      </div>

      {/* ── Credit cards ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-extrabold text-ink">Credit cards</h2>
          {cards.length > 0 && <AddButton onClick={() => setCardSheet({ open: true })} label="Add card" />}
        </div>
        {cards.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CreditCardIcon className="h-7 w-7" />}
              title="Add a credit card"
              description="Pay with it in Quick add, and see what you owe, your limit, and when the bill is due."
              action={<AddButton onClick={() => setCardSheet({ open: true })} label="Add card" />}
            />
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {cards.map((c) => {
              const cyc = cardCycle(c)
              const used = c.creditLimit > 0 ? Math.min(100, (c.balance / c.creditLimit) * 100) : 0
              const spentCycle = cycleSpend(c, cyc.lastStatement)
              const due = upcomingDue(cyc, c.balance, spentCycle)
              const dueSoon = due.amount > 0 && due.days <= 5
              return (
                <Card
                  key={c.id}
                  padded={false}
                  className="overflow-hidden cursor-pointer transition-shadow hover:shadow-[var(--shadow-lift)]"
                  onClick={() => setCardSheet({ open: true, card: c })}
                >
                  <div className="h-1.5" style={{ background: c.color ?? '#0f172a' }} />
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-14 shrink-0 place-items-center rounded-lg text-white" style={{ background: c.color ?? '#0f172a' }}>
                        <CreditCardIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {c.name}
                          {defaultBadge(c.id)}
                        </p>
                        <p className="text-xs text-ink-muted tnum">{c.last4 ? `•••• ${c.last4}` : 'Credit card'}</p>
                      </div>
                      {star(c.id, c.name)}
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-ink-muted">Owed</p>
                        <p className="font-display text-2xl font-extrabold tracking-tight tnum text-ink">{thb(c.balance)}</p>
                      </div>
                      <p className="text-right text-xs text-ink-muted tnum">
                        {thb(Math.max(0, c.creditLimit - c.balance))} left
                        <br />
                        of {thb(c.creditLimit)}
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full ${used > 80 ? 'bg-loss' : used > 50 ? 'bg-warn' : 'bg-brand'}`}
                        style={{ width: `${used}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-surface-muted/70 px-2.5 py-2">
                        <p className="text-ink-muted">This cycle</p>
                        <p className="font-bold text-ink tnum">{thb(spentCycle)}</p>
                      </div>
                      <div className="rounded-xl bg-surface-muted/70 px-2.5 py-2">
                        <p className="text-ink-muted">Statement</p>
                        <p className="font-bold text-ink">{shortDate(cyc.nextStatement)}</p>
                      </div>
                      <div className={`rounded-xl px-2.5 py-2 ${dueSoon ? 'bg-warn-soft' : 'bg-surface-muted/70'}`}>
                        <p className={dueSoon ? 'text-warn' : 'text-ink-muted'}>
                          Due {shortDate(due.date)}
                          {dueSoon && <span className="font-semibold"> · {due.days === 0 ? 'today' : `${due.days}d`}</span>}
                        </p>
                        <p className={`font-bold tnum ${dueSoon ? 'text-warn' : 'text-ink'}`}>{thb(due.amount)}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Wallets ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-extrabold text-ink">Wallets</h2>
          <button type="button" onClick={() => navigate('/cash')} className="text-sm font-semibold text-brand hover:underline cursor-pointer">
            Manage in Cash
          </button>
        </div>
        {wallets.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MethodIcon method={{ kind: 'cash' }} className="h-7 w-7" />}
              title="Add a wallet"
              description="Create a THB cash account in Cash and Liquidity, then log spending against it here."
              action={<Button onClick={() => navigate('/cash?action=new')}>Add cash account</Button>}
            />
          </Card>
        ) : (
          <Card padded={false} className="divide-y divide-line">
            {wallets.map((w) => {
              const f = flows.get(w.id)
              return (
                <div
                  key={w.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setWalletSheet(w)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setWalletSheet(w)}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-surface-muted/50 cursor-pointer sm:px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  {star(w.id, w.name)}
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-muted">
                    <MethodIcon method={w} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center">
                      <span className="truncate text-sm font-semibold text-ink">{w.name}</span>
                      {defaultBadge(w.id)}
                    </span>
                    <span className="block truncate text-xs text-ink-muted tnum">
                      {f ? (
                        <>
                          This month <span className="text-gain">+{thb(f.in)}</span> · −{thb(f.out)}
                        </>
                      ) : (
                        'No activity this month'
                      )}
                      {w.locked ? ' · Locked savings' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-ink tnum">{thb(w.balance)}</span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-muted/50" strokeWidth={2} />
                </div>
              )
            })}
          </Card>
        )}
        <p className="px-1 text-xs text-ink-muted">USD accounts stay on the Invest side for now.</p>
      </section>

      <CardSheet open={cardSheet.open} card={cardSheet.card ? cards.find((c) => c.id === cardSheet.card!.id) : undefined} onClose={() => setCardSheet({ open: false })} />
      <WalletSheet wallet={walletSheet} onClose={() => setWalletSheet(undefined)} />
    </div>
  )
}
