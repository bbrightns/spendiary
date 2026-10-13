import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { CreditCardIcon, LockClosedIcon } from '../../../components/icons'
import { localDateStr, thb, thbCompact, thbSigned } from '../../../lib/format'
import type { CashAccount, SpendCard } from '../../../lib/types'
import { newCashAccount, sortCashAccounts } from '../../../lib/calc'
import { EditAccountModal } from '../../../components/forms/EditCashAccountModal'
import { useToast } from '../../../store/ToastContext'
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
  const { data, setCashAccounts, usdThb } = useData()
  const liabilities = data.liabilities ?? []
  const { showToast } = useToast()
  // Adding a wallet happens here, with the same form Cash & Liquidity uses
  const [newWallet, setNewWallet] = useState<CashAccount | null>(null)
  const [cardSheet, setCardSheet] = useState<{ open: boolean; card?: SpendCard }>({ open: false })
  const [walletSheet, setWalletSheet] = useState<PayMethod | undefined>()
  const [arrange, setArrange] = useState<'cards' | 'wallets' | null>(null)
  const period = useMemo(() => periodFor(localDateStr(), settings.cycle), [settings.cycle])
  const periodName = isCalendar(settings.cycle) ? 'This month' : 'This pay cycle'
  const favs = settings.favoriteAccountIds ?? []

  const wallets = methods.filter((m) => m.kind === 'cash')
  // An overpaid card is below zero and shows as a negative amount owed
  const owed = cards.reduce((s, c) => s + c.balance, 0)
  // Each shared limit counted once, less installment holds
  const credit = totalAvailable(cards, liabilities)
  const limit = credit.limit
  const usedPct = limit > 0 ? Math.min(100, Math.max(0, ((limit - credit.left) / limit) * 100)) : 0

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

      {/* md+: card stack on the left, wallets fill the rest */}
      <div className="space-y-6 md:grid md:grid-cols-[360px_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0 xl:gap-8">
        {/* ── Credit cards ── */}
        <section className="space-y-3">
          <div>
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-lg font-extrabold text-ink">Credit cards</h2>
              {cards.length > 0 && (
                <div className="flex items-center gap-2">
                  {cards.length > 1 && <ArrangeButton label="Arrange credit cards" onClick={() => setArrange('cards')} />}
                  <AddButton onClick={() => setCardSheet({ open: true })} label="Add card" />
                </div>
              )}
            </div>
            {/* One line for all cards: owed, share of the limit used (installment holds count), and what's left */}
            {cards.length > 0 && (
              <p className="mt-1 px-1 text-xs text-ink-muted tnum">
                Owed <span className="font-semibold text-ink-soft">{thbSigned(owed, true)}</span>
                {limit > 0 && (
                  <>
                    {' · '}
                    <span className="font-semibold text-ink-soft">{usedPct.toFixed(0)}%</span> used{' · '}
                    <span className="font-semibold text-ink-soft">{thb(Math.max(0, credit.left), true)}</span> left
                  </>
                )}
              </p>
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
                description="Add the bank accounts and cash you pay from, then log spending against them here."
                action={<Button onClick={() => setNewWallet(newCashAccount())}>Add wallet</Button>}
              />
            </Card>
          ) : (
            // Bento: three square tiles a row on phones; wider screens fit as many 120px+ tiles as
            // the row holds and stretch them to fill it, so there's no empty strip at the sides
            <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:gap-3 auto-rows-fr">
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
                    className={`relative flex aspect-square min-w-0 flex-col rounded-2xl border bg-surface p-2 sm:p-2.5 text-left shadow-[var(--shadow-soft)] transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
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
                      {/* Always two lines tall, so a one-line name gives the same tile as a long one */}
                      <p className="line-clamp-2 min-h-[2lh] break-words text-[11px] font-semibold leading-tight text-ink-soft">
                        {isDefault && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" aria-hidden />}
                        {w.name}
                      </p>
                      {/* Satang in small type so it still fits a third of a phone; millions go compact */}
                      <p className="truncate font-display text-[14px] min-[380px]:text-[15px] font-extrabold tracking-tight tnum text-ink">
                        {Math.abs(w.balance) >= 1_000_000 ? (
                          thbCompact(w.balance)
                        ) : (
                          <>
                            {thbSigned(w.balance, true).slice(0, -3)}
                            <span className="text-[10px] min-[380px]:text-[11px] font-bold text-ink-muted">{thbSigned(w.balance, true).slice(-3)}</span>
                          </>
                        )}
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
                onClick={() => setNewWallet(newCashAccount())}
                // Brand-tinted so it reads as an action in both themes, not as an empty slot
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/30 text-xs font-bold text-brand-ink transition-colors cursor-pointer hover:border-brand/70 hover:bg-brand-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-lg font-bold leading-none text-white shadow-xs">+</span>
                Add wallet
              </button>
            </div>
          )}
          <p className="px-1 text-center text-xs text-ink-muted md:text-left">In / out is {periodName.toLowerCase()}. USD accounts stay on the Invest side for now.</p>
        </section>
      </div>

      {newWallet && (
        <EditAccountModal
          open
          initialAccount={newWallet}
          onClose={() => setNewWallet(null)}
          onSave={(saved) => {
            setCashAccounts(sortCashAccounts([...(data.cashAccounts ?? []), saved], usdThb && usdThb > 0 ? usdThb : 35))
            setNewWallet(null)
            showToast(`Added "${saved.name}"`, 'success')
          }}
        />
      )}

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
