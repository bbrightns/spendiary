import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDcaBuyForm } from '../../components/forms/ConfirmDcaBuyForm'
import { ConfirmDividendModal } from '../../components/forms/ConfirmDividendModal'
import { CreditCardIcon, DcaIcon, DebtIcon, ReceiptPercentIcon, WalletIcon } from '../../components/icons'
import {
  ASSET_META,
  buyDateThisPeriod,
  getHoldingDpsForMonth,
  getLiabilityDueStatus,
  isBuyDayToday,
  isDividendReceivedThisMonth,
  isLiabilityActionableThisMonth,
  shouldConfirmBuy,
} from '../../lib/calc'
import { localDateStr, thb } from '../../lib/format'
import type { DcaPlan, Holding } from '../../lib/types'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { DEFAULT_BILL_REMINDER_DAYS } from './logic'
import { dueText, openPayBill } from './PayBillSheet'
import { openPayLoan } from './PayLoanSheet'
import { useSpend } from './useSpend'

type Tone = 'loss' | 'warn' | 'brand' | 'gain'

const TONE: Record<Tone, { card: string; text: string }> = {
  // Pastels with enough body to read: pink-red for late or overdue, yellow for due soon
  loss: { card: 'border-rose-300 bg-rose-100 dark:border-rose-300/45 dark:bg-rose-300/[0.16]', text: 'text-rose-700 dark:text-rose-300' },
  warn: { card: 'border-amber-300 bg-amber-100 dark:border-amber-200/40 dark:bg-amber-200/[0.13]', text: 'text-amber-700 dark:text-amber-200' },
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
  /** For the folded card's total */
  amount: number
  /** Days until due (negative when overdue), for payments */
  days?: number
  /** Badge colour for the single card, dot colour in a folded list */
  color?: string
  /** Badge icon for the single card when it differs from the group's */
  icon?: ReactNode
  action: string
  onAction: () => void
  /** A quieter second button, e.g. Skip */
  secondary?: { label: string; onClick: () => void }
}

interface Group {
  id: string
  icon: ReactNode
  /** Badge style when the colour isn't per item */
  badge: string
  /** "3 DCA buys to log" */
  title: (n: number) => string
  summary: (items: Item[]) => string
  items: Item[]
  /** Where these items live when they come from the other side, e.g. DCA plans in Invest */
  source?: { label: string; to: string; linkText: string }
}

const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
/** Due today or already past: a bill due in 3 days or a dividend expected this month is not */
const isDueNow = (i: Item) => i.days !== undefined && i.days <= 0

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
  const { data, skipDcaBuy, unskipDcaBuy } = useData()
  const { showToast } = useToast()
  const { reminders, settings } = useSpend()
  const now = new Date()
  const month = now.getMonth() + 1
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' })
  const remindDays = settings.billReminderDays ?? DEFAULT_BILL_REMINDER_DAYS
  const account = (id?: string) => data.cashAccounts.find((a) => a.id === id)?.name

  // Card bills (cards in Spend → Accounts) and loans (Loans, incl. cards tracked as a debt) are
  // both just "pay this", so they share one group
  const bills: Item[] = reminders.map((b) => ({
    id: `bill-${b.card.id}`,
    title: `${b.card.name} bill`,
    detail: `${thb(b.amountDue)} ${dueText(b.daysToDue)}`,
    tone: b.status === 'overdue' ? 'loss' : 'warn',
    amount: b.amountDue,
    days: b.daysToDue,
    color: b.card.color ?? '#0f172a',
    icon: <CreditCardIcon className="h-4 w-4" />,
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
    const amount = l.monthlyPayment ?? l.balance
    return [
      {
        id: `loan-${l.id}`,
        title: l.name,
        detail: `${thb(amount)} ${when}`,
        tone: s.status === 'overdue' ? 'loss' : 'warn',
        amount,
        days: s.status === 'overdue' ? -1 : s.status === 'due_today' ? 0 : s.daysLeft,
        icon: <DebtIcon className="h-4 w-4" />,
        action: 'Pay',
        onAction: () => openPayLoan(l.id),
      },
    ]
  })
  // Overdue first, then soonest
  const payments = [...bills, ...loans].sort((a, b) => (a.days ?? 99) - (b.days ?? 99))

  // Missed first, then due today. A missed buy costs nothing, so it isn't red like an overdue bill
  const dca: Item[] = data.dcaPlans
    .filter((p) => shouldConfirmBuy(p, now))
    .sort((a, b) => Number(isBuyDayToday(a, now)) - Number(isBuyDayToday(b, now)))
    .map((p) => {
      const today = isBuyDayToday(p, now)
      const into = p.assetClass === 'cash' ? account(p.cashAccountId) : undefined
      return {
        id: p.id,
        ...planTitle(p),
        // When first, so a narrow phone cuts the frequency rather than the date
        detail: `${today ? 'Due today' : `Missed ${shortDate(buyDateThisPeriod(p, now))}`} · ${thb(p.monthlyAmount)} ${FREQ[p.frequency ?? 'monthly']}${into ? ` · into ${into}` : ''}`,
        tone: 'brand',
        amount: p.monthlyAmount,
        days: today ? 0 : -1,
        color: ASSET_META[p.assetClass]?.color,
        action: 'Log',
        onAction: () => onConfirmDca(p),
        secondary: {
          label: 'Skip',
          onClick: () => {
            const date = localDateStr()
            skipDcaBuy(p.id, date)
            showToast(`Skipped ${p.name} this time`, 'info', { label: 'Undo', onClick: () => unskipDcaBuy(p.id, date) })
          },
        },
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
        amount: 0,
        color: ASSET_META[h.assetClass as keyof typeof ASSET_META]?.color,
        action: 'Log',
        onAction: () => onLogDividend(h, dps),
      }
    })

  const total = (items: Item[]) => thb(items.reduce((s, i) => s + i.amount, 0))
  const lateText = (items: Item[], word: string) => {
    const n = items.filter((i) => i.tone === 'loss').length
    return n > 0 ? ` · ${n} ${word}` : ''
  }

  const groups: Group[] = [
    {
      id: 'pay',
      icon: <WalletIcon className="h-4 w-4" />,
      badge: NEUTRAL_BADGE,
      title: (n) => `${count(n, 'payment')} due`,
      summary: (items) => {
        const next = Math.min(...items.map((i) => i.days ?? Infinity).filter((d) => d >= 0))
        const overdue = lateText(items, 'overdue')
        return `${total(items)}${overdue || (Number.isFinite(next) ? ` · next ${dueText(next).replace('due ', '')}` : '')}`
      },
      items: payments,
    },
    {
      id: 'dca',
      icon: <DcaIcon className="h-4 w-4" />,
      badge: 'bg-brand text-white',
      title: (n) => `${count(n, 'DCA buy')} to log`,
      summary: (items) => {
        const missed = items.filter((i) => (i.days ?? 0) < 0).length
        return `${total(items)}${missed > 0 ? ` · ${missed} missed` : ''}`
      },
      items: dca,
      source: { label: 'Invest', to: '/dca', linkText: 'Plans live in Invest → DCA' },
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

/** "Invest": where an item lives when it isn't a Spend thing */
function SourceTag({ label }: { label: string }) {
  return <span className="shrink-0 rounded-md bg-surface/70 px-1.5 py-0.5 text-[11px] font-bold text-ink-soft">{label}</span>
}

const SECONDARY = 'shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer min-h-8'

/** One item: the whole card is the button (a second action, like Skip, sits beside it). */
function ItemCard({ item, icon, badge, source }: { item: Item; icon: ReactNode; badge: string; source?: Group['source'] }) {
  const t = TONE[item.tone]
  return (
    <div className={`flex w-full items-center gap-1 rounded-2xl border pr-4 animate-rise ${t.card}`}>
      <button
        type="button"
        onClick={item.onAction}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-3 pl-4 text-left transition-[filter] cursor-pointer hover:brightness-[0.98] dark:hover:brightness-110"
      >
        <span
          className={`grid h-9 w-12 shrink-0 place-items-center rounded-lg ${item.color ? 'text-white' : badge}`}
          style={item.color ? { background: item.color } : undefined}
        >
          {item.icon ?? icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-ink">
            <span className="truncate">{item.title}</span>
            {/* Phones keep the room for the name; the ticker shows from sm up */}
            {item.tag && <span className="hidden shrink-0 rounded-md bg-surface/70 px-1.5 py-0.5 text-[11px] font-bold text-ink-soft sm:inline">{item.tag}</span>}
            {source && <SourceTag label={source.label} />}
          </span>
          <span className={`block truncate text-xs font-semibold tnum ${t.text}`}>{item.detail}</span>
        </span>
      </button>
      {item.secondary && (
        <button type="button" onClick={item.secondary.onClick} className={SECONDARY}>
          {item.secondary.label}
        </button>
      )}
      <button type="button" onClick={item.onAction} tabIndex={-1} aria-hidden="true" className={PILL}>
        {item.action}
      </button>
    </div>
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
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-ink">
            <span className="truncate">{group.title(group.items.length)}</span>
            {group.source && <SourceTag label={group.source.label} />}
          </span>
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
              {i.secondary && (
                <button type="button" onClick={i.secondary.onClick} aria-label={`${i.secondary.label} ${i.title}`} className={SECONDARY}>
                  {i.secondary.label}
                </button>
              )}
              <button type="button" onClick={i.onAction} aria-label={`${i.action} ${i.title}`} className={PILL}>
                {i.action}
              </button>
            </li>
          ))}
          {group.source && (
            <li>
              <Link to={group.source.to} className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-ink-muted hover:text-ink">
                {group.source.linkText}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          )}
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
          {groups.map((g) => (g.items.length === 1 ? <ItemCard key={g.id} item={g.items[0]} icon={g.icon} badge={g.badge} source={g.source} /> : <GroupCard key={g.id} group={g} />))}
        </div>
      )}
      <ConfirmDcaBuyForm open={!!confirmingPlan} plan={confirmingPlan} onClose={() => setConfirmingPlan(null)} />
      <ConfirmDividendModal open={!!dividendFor} holding={dividendFor?.holding} initialDps={dividendFor?.dps} onClose={() => setDividendFor(null)} />
    </>
  )
}

const noop = () => {}

/**
 * Invest Home's lines for what's waiting today. Each points where the item lives, so DCA buys and
 * dividends stay in Invest (DCA page) and only bills and loans send you to Spend Home.
 */
export function TodayLink({ id }: { id?: string }) {
  const groups = useTodayGroups(noop, noop)
  if (groups.length === 0) return null
  const invest = groups.filter((g) => g.id !== 'pay')
  const spend = groups.filter((g) => g.id === 'pay')
  // Same pages the bottom nav badges: DCA buys on the DCA page, dividends on Dividends
  const investTo = invest.some((g) => g.id === 'dca') ? '/dca' : '/dividends'
  return (
    <div id={id} className="divide-y divide-line overflow-hidden rounded-2xl border border-line text-sm text-ink-muted">
      {invest.length > 0 && <TodayLinkRow to={investTo} groups={invest} />}
      {spend.length > 0 && <TodayLinkRow to="/" groups={spend} where="on Spend Home" />}
    </div>
  )
}

function TodayLinkRow({ to, groups, where }: { to: string; groups: Group[]; where?: string }) {
  const items = groups.flatMap((g) => g.items)
  const urgent = items.filter(isDueNow).length
  return (
    <Link to={to} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted/60">
      <span>
        <span className="font-semibold text-ink">{groups.map((g) => g.title(g.items.length)).join(' · ')}</span>
        {urgent > 0 && <span className="font-semibold text-warn"> · {urgent} due now</span>}
        {where && ` · ${where}`}
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}
