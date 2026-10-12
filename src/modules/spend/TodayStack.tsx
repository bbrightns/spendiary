import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDcaBuyForm } from '../../components/forms/ConfirmDcaBuyForm'
import { ConfirmDividendModal } from '../../components/forms/ConfirmDividendModal'
import { CreditCardIcon, DcaIcon, DebtIcon, ReceiptPercentIcon } from '../../components/icons'
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
import type { DcaPlan, Holding } from '../../lib/types'
import { useData } from '../../store/DataContext'
import { DEFAULT_BILL_REMINDER_DAYS } from './logic'
import { dueText, openPayBill } from './PayBillSheet'
import { openPayLoan } from './PayLoanSheet'
import { useSpend } from './useSpend'

type Tone = 'loss' | 'warn' | 'brand' | 'gain'

const TONE: Record<Tone, { card: string; text: string }> = {
  loss: { card: 'border-loss/30 bg-loss-soft', text: 'text-loss' },
  warn: { card: 'border-warn/30 bg-warn-soft', text: 'text-warn' },
  brand: { card: 'border-brand/30 bg-brand-soft/70', text: 'text-brand-ink' },
  gain: { card: 'border-gain/30 bg-gain-soft', text: 'text-gain' },
}
// Most urgent first, both for groups and for the colour of a folded group
const RANK: Record<Tone, number> = { loss: 0, warn: 1, brand: 2, gain: 3 }

const FREQ: Record<string, string> = { daily: 'daily', weekly: 'weekly', biweekly: 'every 2 weeks', monthly: 'monthly', quarterly: 'quarterly' }
const PILL = 'shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer dark:bg-[#4f46e5]'
const NEUTRAL_BADGE = 'bg-ink text-white dark:bg-surface-muted dark:text-ink'

interface Item {
  id: string
  title: string
  /** Shown next to the title from sm up (DCA tickers) */
  tag?: string
  detail: string
  tone: Tone
  /** Badge colour for the single card, dot colour in a folded list */
  color?: string
  action: string
  onAction: () => void
}

interface Group {
  id: string
  icon: ReactNode
  /** Badge style when the colour isn't per item */
  badge: string
  /** "3 DCA buys to confirm" */
  title: (n: number) => string
  summary: (items: Item[]) => string
  items: Item[]
}

const worst = (items: Item[]): Tone => items.reduce<Tone>((t, i) => (RANK[i.tone] < RANK[t] ? i.tone : t), 'gain')
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "Buy US Tech Leaders" + its ticker when the name doesn't already say it */
function planTitle(p: DcaPlan) {
  const verb = p.assetClass === 'cash' ? 'Save to' : 'Buy'
  const showTicker = !!p.ticker && !p.name.toUpperCase().includes(p.ticker.toUpperCase())
  return { title: `${verb} ${p.name}`, tag: showTicker ? p.ticker : undefined }
}

/**
 * Everything that needs doing today, from both sides: card bills and loans to pay, DCA buys to
 * confirm and dividends to log. Groups come most urgent first.
 */
function useTodayGroups(onConfirmDca: (p: DcaPlan) => void, onLogDividend: (h: Holding, dps: number) => void): Group[] {
  const { data } = useData()
  const { reminders, settings } = useSpend()
  const now = new Date()
  const month = now.getMonth() + 1
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' })
  const remindDays = settings.billReminderDays ?? DEFAULT_BILL_REMINDER_DAYS
  const account = (id?: string) => data.cashAccounts.find((a) => a.id === id)?.name

  const bills: Item[] = reminders.map((b) => ({
    id: b.card.id,
    title: `${b.card.name} bill`,
    detail: `${thb(b.amountDue)} ${dueText(b.daysToDue)}`,
    tone: b.status === 'overdue' ? 'loss' : 'warn',
    color: b.card.color ?? '#0f172a',
    action: 'Pay',
    onAction: () => openPayBill(b.card.id),
  }))

  // Same reminder window as card bills, so a payment weeks away doesn't crowd Home
  const loans: Item[] = (data.liabilities ?? []).flatMap((l) => {
    if (!isLiabilityActionableThisMonth(l)) return []
    const s = getLiabilityDueStatus(l)
    const soon = s.status === 'overdue' || s.status === 'due_today' || (s.daysLeft !== undefined && s.daysLeft <= remindDays)
    if (!soon) return []
    const when =
      s.status === 'overdue'
        ? `overdue · was due on the ${l.dueDay}`
        : s.status === 'due_today'
          ? 'due today'
          : s.daysLeft !== undefined
            ? `due in ${count(s.daysLeft, 'day')}`
            : 'due this month'
    return [{ id: l.id, title: l.name, detail: `${thb(l.monthlyPayment ?? l.balance)} ${when}`, tone: s.status === 'overdue' ? 'loss' : 'warn', action: 'Pay', onAction: () => openPayLoan(l.id) }]
  })

  // Late first, then due today
  const dca: Item[] = data.dcaPlans
    .filter((p) => shouldConfirmBuy(p, now))
    .sort((a, b) => Number(isBuyDayToday(a, now)) - Number(isBuyDayToday(b, now)))
    .map((p) => {
      const today = isBuyDayToday(p, now)
      const into = p.assetClass === 'cash' ? account(p.cashAccountId) : undefined
      return {
        id: p.id,
        ...planTitle(p),
        detail: `${thb(p.monthlyAmount)} ${FREQ[p.frequency ?? 'monthly']} · ${today ? 'due today' : 'late'}${into ? ` · into ${into}` : ''}`,
        tone: today ? 'brand' : 'warn',
        color: ASSET_META[p.assetClass]?.color,
        action: 'Confirm',
        onAction: () => onConfirmDca(p),
      }
    })

  const dividends: Item[] = (data.holdings ?? [])
    .filter((h) => h.paysDividend && (h.dividendMonths ?? []).includes(month) && !isDividendReceivedThisMonth(h.id, data.dividendRecords))
    .map((h) => {
      const dps = getHoldingDpsForMonth(h, month)
      return {
        id: h.id,
        title: `Dividend from ${h.name}`,
        detail: `Expected in ${monthName}${dps > 0 ? ` · ${dps} per share` : ''} · log it when it arrives`,
        tone: 'gain',
        color: ASSET_META[h.assetClass as keyof typeof ASSET_META]?.color,
        action: 'Log',
        onAction: () => onLogDividend(h, dps),
      }
    })

  const total = (items: Item[], key: (i: Item) => number) => thb(items.reduce((s, i) => s + key(i), 0))
  const billAmount = (i: Item) => reminders.find((b) => b.card.id === i.id)?.amountDue ?? 0
  const loanAmount = (i: Item) => {
    const l = data.liabilities?.find((x) => x.id === i.id)
    return l ? (l.monthlyPayment ?? l.balance) : 0
  }
  const dcaAmount = (i: Item) => data.dcaPlans.find((p) => p.id === i.id)?.monthlyAmount ?? 0
  const lateText = (items: Item[], word: string) => {
    const n = items.filter((i) => i.tone === 'loss' || (word === 'late' && i.tone === 'warn')).length
    return n > 0 ? ` · ${n} ${word}` : ''
  }

  const groups: Group[] = [
    {
      id: 'bills',
      icon: <CreditCardIcon className="h-4 w-4" />,
      badge: NEUTRAL_BADGE,
      title: (n) => `${count(n, 'card bill')} to pay`,
      summary: (items) => {
        const next = Math.min(...reminders.map((b) => b.daysToDue).filter((d) => d >= 0))
        const overdue = lateText(items, 'overdue')
        return `${total(items, billAmount)} total${overdue || (Number.isFinite(next) ? ` · next ${dueText(next)}` : '')}`
      },
      items: bills,
    },
    {
      id: 'loans',
      icon: <DebtIcon className="h-4 w-4" />,
      badge: NEUTRAL_BADGE,
      title: (n) => `${count(n, 'loan payment')} due`,
      summary: (items) => `${total(items, loanAmount)} total${lateText(items, 'overdue')}`,
      items: loans,
    },
    {
      id: 'dca',
      icon: <DcaIcon className="h-4 w-4" />,
      badge: 'bg-brand text-white',
      title: (n) => `${count(n, 'DCA buy')} to confirm`,
      summary: (items) => `${total(items, dcaAmount)} total${lateText(items, 'late')}`,
      items: dca,
    },
    {
      id: 'dividends',
      icon: <ReceiptPercentIcon className="h-4 w-4" />,
      badge: 'bg-gain text-white',
      title: (n) => `${count(n, 'dividend')} to log`,
      summary: () => `Expected in ${monthName} · log each when it arrives`,
      items: dividends,
    },
  ]
  return groups.filter((g) => g.items.length > 0).sort((a, b) => RANK[worst(a.items)] - RANK[worst(b.items)])
}

/** One item: the whole card is the button. */
function ItemCard({ item, icon, badge }: { item: Item; icon: ReactNode; badge: string }) {
  const t = TONE[item.tone]
  return (
    <button
      type="button"
      onClick={item.onAction}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-[filter] cursor-pointer animate-rise hover:brightness-[0.98] dark:hover:brightness-110 ${t.card}`}
    >
      <span
        className={`grid h-9 w-12 shrink-0 place-items-center rounded-lg ${item.color ? 'text-white' : badge}`}
        style={item.color ? { background: item.color } : undefined}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-ink">
          <span className="truncate">{item.title}</span>
          {/* Phones keep the room for the name; the ticker shows from sm up */}
          {item.tag && <span className="hidden shrink-0 rounded-md bg-surface/70 px-1.5 py-0.5 text-[11px] font-bold text-ink-soft sm:inline">{item.tag}</span>}
        </span>
        <span className={`block truncate text-xs font-semibold tnum ${t.text}`}>{item.detail}</span>
      </span>
      <span className={PILL}>{item.action}</span>
    </button>
  )
}

/** Several items of one kind: a summary card that opens into a list with a button per item. */
function GroupCard({ group }: { group: Group }) {
  const [open, setOpen] = useState(false)
  const tone = worst(group.items)
  return (
    <div className={`overflow-hidden rounded-2xl border animate-rise ${TONE[tone].card}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer">
        <span className={`grid h-9 w-12 shrink-0 place-items-center rounded-lg ${group.badge}`}>{group.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink">{group.title(group.items.length)}</span>
          <span className={`block truncate text-xs font-semibold tnum ${TONE[tone].text}`}>{group.summary(group.items)}</span>
        </span>
        <span className={PILL}>{open ? 'Hide' : 'Review'}</span>
      </button>
      {open && (
        <ul className="divide-y divide-line/60 border-t border-line/60 bg-surface/60">
          {group.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color ?? 'var(--color-ink-faint)' }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{i.title}</span>
                <span className={`block truncate text-xs font-semibold tnum ${i.tone === 'brand' ? 'text-ink-muted' : TONE[i.tone].text}`}>{i.detail}</span>
              </span>
              <button type="button" onClick={i.onAction} className={PILL}>
                {i.action}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Spend Home's "Today" stack for both sides. A kind with one item shows it as its own card;
 * several fold into one card so they don't push the rest of Home down.
 */
export function TodayStack() {
  const [confirmingPlan, setConfirmingPlan] = useState<DcaPlan | null>(null)
  const [dividendFor, setDividendFor] = useState<{ holding: Holding; dps: number } | null>(null)
  const groups = useTodayGroups(setConfirmingPlan, (holding, dps) => setDividendFor({ holding, dps }))

  return (
    <>
      {groups.length > 0 && (
        <div className="space-y-2" role="region" aria-label="To do today">
          {groups.map((g) => (g.items.length === 1 ? <ItemCard key={g.id} item={g.items[0]} icon={g.icon} badge={g.badge} /> : <GroupCard key={g.id} group={g} />))}
        </div>
      )}
      <ConfirmDcaBuyForm open={!!confirmingPlan} plan={confirmingPlan} onClose={() => setConfirmingPlan(null)} />
      <ConfirmDividendModal open={!!dividendFor} holding={dividendFor?.holding} initialDps={dividendFor?.dps} onClose={() => setDividendFor(null)} />
    </>
  )
}

const noop = () => {}

/** Invest Home's one line pointing at Spend Home's Today stack, when anything is waiting. */
export function TodayLink({ id }: { id?: string }) {
  const groups = useTodayGroups(noop, noop)
  const items = groups.flatMap((g) => g.items)
  if (items.length === 0) return null
  const urgent = items.filter((i) => i.tone === 'loss' || i.tone === 'warn').length
  return (
    <Link
      id={id}
      to="/spend"
      className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted/60"
    >
      <span>
        <span className="font-semibold text-ink">{count(items.length, 'thing')} to do today</span>
        {urgent > 0 && <span className="font-semibold text-warn"> · {urgent} due or late</span>} · on Spend Home
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}
