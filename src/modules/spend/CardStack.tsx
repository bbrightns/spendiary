import { useMemo, useState } from 'react'
import { thb, thbSigned } from '../../lib/format'
import type { SpendCard, SpendTransaction } from '../../lib/types'
import { StarIcon } from './AccountSheets'
import { FALLBACK_CARD_COLOR, cardFace, inkOn } from './cardColor'
import { availableCredit } from './credit'
import { useData } from '../../store/DataContext'
import { cardCycle, upcomingDue } from './logic'
import { dueText, openPayBill } from './PayBillSheet'
import type { useSpend } from './useSpend'

type Bill = ReturnType<typeof useSpend>['bills'][number]

interface Props {
  cards: SpendCard[]
  bills: Bill[]
  transactions: SpendTransaction[]
  defaultId?: string
  favoriteIds: string[]
  onToggleFavorite: (id: string) => void
  onEdit: (card: SpendCard) => void
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** The star in front of a card's name, on the front card and on every tab behind it, same column */
function FavoriteToggle({ on, name, light, onToggle, className = '' }: { on: boolean; name: string; light: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={on}
      aria-label={on ? `Unfavorite ${name}` : `Favorite ${name}`}
      className={`-mx-2 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current ${light ? 'hover:bg-white/15' : 'hover:bg-slate-900/10'} ${on ? 'text-amber-300' : 'opacity-70 hover:opacity-100'} ${className}`}
    >
      <StarIcon filled={on} />
    </button>
  )
}

/**
 * Credit cards as a wallet: one card in front with full details, the rest as colored tabs peeking
 * out above it. Tapping a tab brings that card forward. Keeps 10 cards to roughly one screen.
 */
export function CardStack({ cards, bills, transactions, defaultId, favoriteIds, onToggleFavorite, onEdit }: Props) {
  const loans = useData().data.liabilities ?? []
  const info = useMemo(
    () =>
      new Map(
        cards.map((c) => {
          const cyc = cardCycle(c)
          // Charges minus refunds since the last statement
          const spentCycle = transactions
            .filter((t) => t.accountId === c.id && t.date > cyc.lastStatement)
            .reduce((s, t) => s + (t.type === 'expense' ? t.amount : t.type === 'income' ? -t.amount : 0), 0)
          const bill = bills.find((b) => b.card.id === c.id)
          // An open statement wins; otherwise show the next one forming
          const open = bill && bill.amountDue > 0 ? bill : undefined
          const due = open ? { date: open.dueDate, days: open.daysToDue, amount: open.amountDue } : upcomingDue(cyc, c.balance, spentCycle)
          const tone = open?.status === 'overdue' ? ('loss' as const) : open?.status === 'due' ? ('warn' as const) : undefined
          return [c.id, { cyc, spentCycle, open, due, tone }]
        }),
      ),
    [cards, bills, transactions],
  )

  // Start on the card that needs attention: overdue, then due soon, then the default card
  const firstPick = () =>
    cards.find((c) => info.get(c.id)?.tone === 'loss')?.id ??
    cards.find((c) => info.get(c.id)?.tone === 'warn')?.id ??
    cards.find((c) => c.id === defaultId)?.id ??
    cards[0]?.id
  const [picked, setPicked] = useState<string | undefined>(firstPick)
  // A deleted card falls back to the usual pick
  const activeId = cards.some((c) => c.id === picked) ? picked : firstPick()
  const active = cards.find((c) => c.id === activeId)
  const behind = cards.filter((c) => c.id !== activeId)
  if (!active) return null

  const a = info.get(active.id)!
  const color = active.color ?? FALLBACK_CARD_COLOR
  const ink = inkOn(color)
  // The limit it draws on: shared with its other cards, less installment holds
  const credit = availableCredit(active, cards, loans)
  const held = credit.held
  const used = credit.limit > 0 ? Math.min(100, Math.max(0, (credit.used / credit.limit) * 100)) : 0
  const fav = favoriteIds.includes(active.id)

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      {behind.map((c, i) => {
        const t = info.get(c.id)!
        const bg = c.color ?? FALLBACK_CARD_COLOR
        const k = inkOn(bg)
        return (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => setPicked(c.id)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
              e.preventDefault()
              setPicked(c.id)
            }}
            aria-label={`Show ${c.name}, owed ${thbSigned(c.balance, true)}${t.open ? `, ${dueText(t.open.daysToDue)}` : ''}`}
            style={{ background: cardFace(bg), zIndex: i }}
            // Taller than it shows: the next layer covers the bottom, so only ~44px peeks out
            className={`relative -mb-4 flex h-[60px] w-full items-start gap-3 rounded-t-[var(--radius-card)] px-4 pt-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_-8px_20px_-10px_rgba(0,0,0,0.45)] transition-transform duration-200 cursor-pointer hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-5 ${k.text}`}
          >
            <FavoriteToggle on={favoriteIds.includes(c.id)} name={c.name} light={k.light} onToggle={() => onToggleFavorite(c.id)} className="-my-1.5" />
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="truncate text-sm font-bold">{c.name}</span>
              {c.last4 && <span className={`shrink-0 text-xs tnum ${k.soft}`}>•• {c.last4}</span>}
            </span>
            {t.tone && (
              <span className={`shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold ${t.tone === 'loss' ? 'text-rose-600' : 'text-amber-700'}`}>
                {t.tone === 'loss' ? 'Overdue' : `Due ${shortDate(t.due.date)}`}
              </span>
            )}
            <span className="shrink-0 text-sm font-bold tnum">{thbSigned(c.balance, true)}</span>
          </div>
        )
      })}

      {/* Front card */}
      <div
        key={active.id}
        role="button"
        tabIndex={0}
        onClick={() => onEdit(active)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
          e.preventDefault()
          onEdit(active)
        }}
        aria-label={`Edit ${active.name}`}
        style={{ zIndex: behind.length }}
        className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.45),var(--shadow-soft)] cursor-pointer transition-shadow hover:shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.45),var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand animate-rise"
      >
        <div className={`flex items-center gap-3 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] sm:px-5 ${ink.text}`} style={{ background: cardFace(color) }}>
          <FavoriteToggle on={fav} name={active.name} light={ink.light} onToggle={() => onToggleFavorite(active.id)} />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center text-sm font-bold">
              <span className="truncate">{active.name}</span>
              {defaultId === active.id && (
                <span className={`ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${ink.light ? 'bg-white/20' : 'bg-slate-900/10'}`}>Default</span>
              )}
            </p>
            <p className={`text-xs tnum ${ink.soft}`}>{active.last4 ? `•••• ${active.last4}` : 'Credit card'}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-ink-muted">Owed</p>
              <p className="font-display text-2xl font-extrabold tracking-tight tnum text-ink">{thbSigned(active.balance, true)}</p>
            </div>
            <p className="text-right text-xs text-ink-muted tnum">
              {thb(credit.left, true)} left
              <br />
              of {thb(credit.limit, true)}
              {credit.sharedWith.length > 0 && (
                <>
                  <br />
                  shared with {credit.sharedWith.join(', ')}
                </>
              )}
              {held > 0 && (
                <>
                  <br />
                  {thb(held, true)} in installments
                </>
              )}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div className={`h-full rounded-full ${used > 80 ? 'bg-loss' : used > 50 ? 'bg-warn' : 'bg-brand'}`} style={{ width: `${used}%` }} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-surface-muted/70 px-2.5 py-2">
              <p className="text-ink-muted">This cycle</p>
              <p className="font-bold text-ink tnum">{thb(a.spentCycle, true)}</p>
            </div>
            <div className="rounded-xl bg-surface-muted/70 px-2.5 py-2">
              <p className="text-ink-muted">Statement</p>
              <p className="font-bold text-ink">{shortDate(a.cyc.nextStatement)}</p>
            </div>
            <div className={`rounded-xl px-2.5 py-2 ${a.tone === 'loss' ? 'bg-loss-soft' : a.tone === 'warn' ? 'bg-warn-soft' : 'bg-surface-muted/70'}`}>
              <p className={a.tone === 'loss' ? 'text-loss' : a.tone === 'warn' ? 'text-warn' : 'text-ink-muted'}>
                {a.tone === 'loss' ? 'Overdue' : `Due ${shortDate(a.due.date)}`}
              </p>
              <p className={`font-bold tnum ${a.tone === 'loss' ? 'text-loss' : a.tone === 'warn' ? 'text-warn' : 'text-ink'}`}>{thb(a.due.amount, true)}</p>
            </div>
          </div>

          {(a.open || active.balance > 0) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openPayBill(active.id)
              }}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted/60 cursor-pointer"
            >
              <span className="min-w-0 truncate">
                {a.open ? 'Pay bill' : 'Pay early'}{' '}
                <span className="text-ink-muted">· {a.open ? dueText(a.open.daysToDue) : `closes ${shortDate(a.cyc.nextStatement)}`}</span>
              </span>
              <span className="shrink-0 font-bold tnum">{thb(a.open ? a.open.amountDue : active.balance, true)} →</span>
            </button>
          )}
        </div>
      </div>

      {behind.length > 0 && (
        <p className="mt-2 px-1 text-center text-xs text-ink-muted">
          {cards.length} cards · tap a card above to bring it forward
        </p>
      )}
    </div>
  )
}
