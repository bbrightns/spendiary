import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { CreditCardIcon, LockClosedIcon } from '../../../components/icons'
import { localDateStr, thb, thbCompact, thbSigned } from '../../../lib/format'
import type { SpendCard } from '../../../lib/types'
import { CardSheet, StarIcon, WalletSheet } from '../AccountSheets'
import { GoalsSection } from '../Goals'
import { inPeriod, isCalendar, moveId, periodFor } from '../logic'
import { CardStack } from '../CardStack'
import { totalAvailable } from '../credit'
import { useData } from '../../../store/DataContext'
import { MethodIcon } from '../PayMethodPicker'
import { ArrangeButton, ReorderSheet } from '../ReorderSheet'
import { useSpend, type PayMethod } from '../useSpend'

/** 1234 → 1.2K, for the tiny in / out line on a wallet tile. */
const compact = (v: number) => thbCompact(v).replace(/^฿\s/, '')

export function SpendAccounts() {
  const { transactions, methods, cards, settings, bills, toggleFavorite, updateSettings } = useSpend()
  const navigate = useNavigate()
  const liabilities = useData().data.liabilities ?? []
  const [cardSheet, setCardSheet] = useState<{ open: boolean; card?: SpendCard }>({ open: false })
  const [walletSheet, setWalletSheet] = useState<PayMethod | undefined>()
  const [arrange, setArrange] = useState<'cards' | 'wallets' | null>(null)
  const period = useMemo(() => periodFor(localDateStr(), settings.cycle), [settings.cycle])
  const periodName = isCalendar(settings.cycle) ? 'This month' : 'This pay cycle'
  const favs = settings.favoriteAccountIds ?? []

  const wallets = methods.filter((m) => m.kind === 'cash')
  const cashTotal = wallets.reduce((s, w) => s + w.balance, 0)
  // An overpaid card is below zero and shows as a negative amount owed
  const owed = cards.reduce((s, c) => s + c.balance, 0)
  // Each shared limit counted once, less installment holds
  const credit = totalAvailable(cards, liabilities)
  const limit = credit.limit

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
      if (!inPeriod(period, t.date)) continue
      if (t.type === 'income') bump(t.accountId, 'in', t.amount)
      else if (t.type === 'expense') bump(t.accountId, 'out', t.amount)
      else {
        bump(t.accountId, 'out', t.amount)
        bump(t.toAccountId, 'in', t.amount)
      }
    }
    return map
  }, [transactions, period])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Spend"
        title="Accounts"
        subtitle="Wallets and credit cards you pay with. Star the ones you use most."
      />

      {/* Same order and columns as the sections below: cards, then wallets */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-[360px_minmax(0,1fr)] md:gap-6 xl:gap-8">
        <Card className="p-3 sm:p-5 animate-rise" padded={false}>
          <p className="text-xs font-medium text-ink-muted">Owed on cards</p>
          <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate text-ink">{thbSigned(owed, true)}</p>
          {limit > 0 && <p className="mt-0.5 text-xs text-ink-muted tnum">{thb(credit.left, true)} available</p>}
        </Card>
        <Card className="p-3 sm:p-5 animate-rise" padded={false}>
          <p className="text-xs font-medium text-ink-muted">In wallets</p>
          <p className="mt-1 font-display text-lg sm:text-2xl font-extrabold tnum truncate text-ink">{thb(cashTotal, true)}</p>
        </Card>
      </div>

      {/* md+: card stack on the left, wallets fill the rest */}
      <div className="space-y-6 md:grid md:grid-cols-[360px_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0 xl:gap-8">
        {/* ── Credit cards ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-lg font-extrabold text-ink">Credit cards</h2>
            {cards.length > 0 && (
              <div className="flex items-center gap-2">
                {cards.length > 1 && <ArrangeButton label="Arrange credit cards" onClick={() => setArrange('cards')} />}
                <AddButton onClick={() => setCardSheet({ open: true })} label="Add card" />
              </div>
            )}
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
            <CardStack
              cards={cards}
              bills={bills}
              transactions={transactions}
              defaultId={settings.defaultAccountId}
              favoriteIds={favs}
              onToggleFavorite={toggleFavorite}
              onEdit={(card) => setCardSheet({ open: true, card })}
            />
          )}
        </section>

        {/* ── Wallets ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-lg font-extrabold text-ink">Wallets</h2>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate('/cash')} className="text-sm font-semibold text-brand hover:underline cursor-pointer">
                Manage in Cash
              </button>
              {wallets.length > 1 && <ArrangeButton label="Arrange wallets" onClick={() => setArrange('wallets')} />}
            </div>
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
            // Bento: three square tiles a row on phones (the card stack's width); wider screens fit
            // as many as the row holds, capped so the fixed-size text doesn't float in huge tiles
            <div className="mx-auto grid w-full max-w-[360px] grid-cols-3 gap-2 sm:max-w-none sm:grid-cols-[repeat(auto-fill,minmax(112px,140px))] sm:justify-center md:justify-start">
              {wallets.map((w) => {
                const f = flows.get(w.id)
                const on = favs.includes(w.id)
                const isDefault = settings.defaultAccountId === w.id
                return (
                  <div
                    key={w.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setWalletSheet(w)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
                      e.preventDefault()
                      setWalletSheet(w)
                    }}
                    aria-label={`${w.name}${isDefault ? ', default' : ''}${w.locked ? ', locked savings' : ''}, ${thb(w.balance, true)}`}
                    title={`${w.name} · ${thb(w.balance, true)}`}
                    className={`relative flex aspect-square min-w-0 flex-col rounded-2xl border bg-surface p-2.5 text-left shadow-[var(--shadow-soft)] transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      isDefault ? 'border-brand/60 ring-1 ring-brand/30' : 'border-line'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className="relative grid h-8 w-8 place-items-center rounded-xl bg-surface-muted"
                        style={w.color ? { background: `${w.color}22` } : undefined}
                      >
                        <MethodIcon method={w} className="h-4 w-4" />
                        {w.locked && (
                          <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-line">
                            <LockClosedIcon className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(w.id)
                        }}
                        aria-pressed={on}
                        aria-label={on ? `Unfavorite ${w.name}` : `Favorite ${w.name}`}
                        className={`-mr-1.5 -mt-1.5 grid h-8 w-8 place-items-center rounded-full transition-colors cursor-pointer hover:bg-surface-muted ${on ? 'text-amber-500' : 'text-ink-faint'}`}
                      >
                        <StarIcon filled={on} className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-auto min-w-0">
                      {/* Two lines, so names like "KBank Payroll (main)" stay readable */}
                      <p className="line-clamp-2 break-words text-[11px] font-semibold leading-tight text-ink-soft">
                        {isDefault && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" aria-hidden />}
                        {w.name}
                      </p>
                      {/* Whole baht fits a third of a phone; millions go compact */}
                      <p className="truncate font-display text-[15px] font-extrabold tracking-tight tnum text-ink">
                        {Math.abs(w.balance) >= 1_000_000 ? thbCompact(w.balance) : thb(w.balance)}
                      </p>
                      <p className="truncate text-[10px] leading-tight text-ink-muted tnum">
                        {f ? (
                          <>
                            <span className="text-gain">+{compact(f.in)}</span> · −{compact(f.out)}
                          </>
                        ) : (
                          'No activity'
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => navigate('/cash?action=new')}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-xs font-semibold text-ink-muted transition-colors cursor-pointer hover:bg-surface-muted/60 hover:text-ink"
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-surface-muted text-lg leading-none">+</span>
                Add wallet
              </button>
            </div>
          )}
          <p className="px-1 text-center text-xs text-ink-muted md:text-left">In / out is {periodName.toLowerCase()}. USD accounts stay on the Invest side for now.</p>
        </section>
      </div>

      <GoalsSection />

      <ReorderSheet
        open={arrange === 'cards'}
        onClose={() => setArrange(null)}
        title="Arrange credit cards"
        description="Sets the order of the card stack and the cards in Quick add."
        items={cards.map((c) => ({
          id: c.id,
          label: c.last4 ? `${c.name} •• ${c.last4}` : c.name,
          leading: <span className="h-6 w-9 shrink-0 rounded-md shadow-xs" style={{ background: c.color ?? '#0f172a' }} />,
        }))}
        onMove={(id, delta) => updateSettings({ cardOrder: moveId(cards.map((c) => c.id), id, delta) })}
        canReset={!!settings.cardOrder}
        onReset={() => updateSettings({ cardOrder: undefined })}
      />
      <ReorderSheet
        open={arrange === 'wallets'}
        onClose={() => setArrange(null)}
        title="Arrange wallets"
        description="Sets the order of the wallet tiles and the wallets in Quick add."
        items={wallets.map((w) => ({
          id: w.id,
          label: w.name,
          leading: (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-muted" style={w.color ? { background: `${w.color}22` } : undefined}>
              <MethodIcon method={w} className="h-4 w-4" />
            </span>
          ),
        }))}
        onMove={(id, delta) => updateSettings({ walletOrder: moveId(wallets.map((w) => w.id), id, delta) })}
        canReset={!!settings.walletOrder}
        onReset={() => updateSettings({ walletOrder: undefined })}
      />
      <CardSheet open={cardSheet.open} card={cardSheet.card ? cards.find((c) => c.id === cardSheet.card!.id) : undefined} onClose={() => setCardSheet({ open: false })} />
      <WalletSheet wallet={walletSheet} onClose={() => setWalletSheet(undefined)} />
    </div>
  )
}
