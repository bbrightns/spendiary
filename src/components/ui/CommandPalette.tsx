import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../store/DataContext'
import { useTheme } from '../../hooks/useTheme'
import { useToast } from '../../store/ToastContext'
import { thb, thbSigned } from '../../lib/format'
import {
  amountMatches,
  parseAmountFilter,
  parseQuickAdd,
  parseVerb,
  queryTerms,
  scoreItem,
  usageBoost,
  type AmountFilter,
  type Usage,
} from '../../lib/paletteSearch'
import {
  SearchIcon,
  CommandIcon,
  KeyboardIcon,
  DashboardIcon,
  PortfolioIcon,
  DcaIcon,
  DebtIcon,
  WalletIcon,
  ReceiptPercentIcon,
  SettingsIcon,
  ClockIcon,
  PieChartIcon,
  DownloadIcon,
  SparkleIcon,
  PlusIcon,
  CloseIcon,
  ArrowUpRightIcon,
  CreditCardIcon,
} from '../icons'
import { openQuickAdd } from '../../modules/spend/QuickAddSheet'
import { openPayBill } from '../../modules/spend/PayBillSheet'
import { openImport } from '../../modules/spend/ImportSheet'
import { ListBulletIcon, RepeatIcon, TransferIcon, getCategory, guessCategory, manageableCategories } from '../../modules/spend/categories'
import { frequencyLabel, goalProgress, noteTitle } from '../../modules/spend/logic'
import { useSpendSide } from '../../modules/spend/side'
import { TONES } from '../../modules/spend/tones'
import { useSpend } from '../../modules/spend/useSpend'

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('spendiary:open-command-palette'))
}

export function openShortcutsGuide() {
  window.dispatchEvent(new CustomEvent('spendiary:open-shortcuts-guide'))
}

type Group =
  | 'Recent searches'
  | 'Frequently used'
  | 'Do it'
  | 'Actions'
  | 'Transactions'
  | 'Accounts'
  | 'Categories'
  | 'Recurring'
  | 'Pages'
  | 'Holdings'
  | 'DCA plans'
  | 'Debts'
  | 'Settings'
  | 'System'

/** Base order; with a query, groups are re-ordered by their best match. */
const GROUP_ORDER: Group[] = [
  'Recent searches',
  'Do it',
  'Frequently used',
  'Actions',
  'Transactions',
  'Accounts',
  'Categories',
  'Recurring',
  'Pages',
  'Holdings',
  'DCA plans',
  'Debts',
  'Settings',
  'System',
]
const GROUP_LIMIT = 5

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  badge?: string
  keywords: string[]
  group: Group
  /** Belongs to the Spend side: ranked first while in Spend mode */
  spend?: boolean
  icon: ReactNode
  /** Classes for the icon's box (defaults to a plain outlined box) */
  iconBox?: string
  run: () => void
  /** Keep the palette open (e.g. filling in the search box) */
  stay?: boolean
}

interface Ranked extends CommandItem {
  score: number
}

const USAGE_KEY = 'spendiary.palette_usage'
const RECENT_KEY = 'spendiary.palette_recent'

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null')
    return v && typeof v === 'object' ? (v as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable — ranking just won't remember picks
  }
}

const ic = (Icon: (p: { className?: string; strokeWidth?: number }) => ReactNode, cls = 'text-ink-muted') => (
  <Icon className={`h-4 w-4 ${cls}`} strokeWidth={2} />
)

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [usage, setUsage] = useState<Usage>({})
  const [recent, setRecent] = useState<string[]>([])

  const navigate = useNavigate()
  const { data, exportData } = useData()
  const spend = useSpend()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inSpend = useSpendSide()

  const reset = useCallback(() => {
    setShowShortcuts(false)
    setQuery('')
    setSelectedIndex(0)
    setUsage(readJson<Usage>(USAGE_KEY, {}))
    setRecent(readJson<string[]>(RECENT_KEY, []).filter((x) => typeof x === 'string').slice(0, 5))
  }, [])

  // Listen for global custom events and keyboard shortcuts
  useEffect(() => {
    function handleOpenEvent() {
      reset()
      setIsOpen(true)
    }

    function handleShortcutsEvent() {
      setShowShortcuts(true)
      setIsOpen(true)
    }

    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable)

      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        if (!isOpen) reset()
        setIsOpen(!isOpen)
        return
      }

      // '?' key to open keyboard shortcuts (when not typing in an input)
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setShowShortcuts(true)
        setIsOpen(true)
        return
      }

      // '/' key to open the palette (when not typing in an input)
      if (e.key === '/' && !isInput && !isOpen) {
        e.preventDefault()
        reset()
        setIsOpen(true)
        return
      }

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
        setShowShortcuts(false)
      }
    }

    window.addEventListener('spendiary:open-command-palette', handleOpenEvent)
    window.addEventListener('spendiary:open-shortcuts-guide', handleShortcutsEvent)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('spendiary:open-command-palette', handleOpenEvent)
      window.removeEventListener('spendiary:open-shortcuts-guide', handleShortcutsEvent)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, reset])

  // Focus input on open
  useEffect(() => {
    if (isOpen && !showShortcuts) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [isOpen, showShortcuts])

  const closePalette = useCallback(() => {
    setIsOpen(false)
    setShowShortcuts(false)
    setQuery('')
  }, [])

  const go = useCallback((to: string) => () => navigate(to), [navigate])

  // ── Everything that can be searched (not the transactions; those depend on the query) ──
  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      // ── Actions ──
      {
        id: 'action-spend-add',
        title: 'Add Transaction',
        subtitle: 'Log an expense, income or transfer · or type "65 coffee"',
        badge: 'Action',
        keywords: ['spend', 'expense', 'income', 'transaction', 'quick add', 'จด', 'รายจ่าย', 'รายรับ', 'ใช้เงิน', 'บันทึก'],
        group: 'Actions',
        spend: true,
        icon: ic(PlusIcon, 'text-brand'),
        run: () => openQuickAdd(),
      },
      {
        id: 'action-spend-transfer',
        title: 'Transfer or Pay a Card',
        subtitle: 'Move money between wallets, or pay a card bill',
        badge: 'Action',
        keywords: ['transfer', 'move', 'pay', 'card', 'bill', 'โอน', 'จ่ายบัตร'],
        group: 'Actions',
        spend: true,
        icon: ic(TransferIcon, 'text-sky-500'),
        run: () => openQuickAdd({ type: 'transfer' }),
      },
      {
        id: 'action-spend-import',
        title: 'Import Bank Statement (CSV)',
        subtitle: 'Bring past transactions in from a bank or card CSV',
        badge: 'Action',
        keywords: ['import', 'csv', 'statement', 'bank', 'upload', 'นำเข้า', 'สเตทเมนต์', 'ไฟล์'],
        group: 'Actions',
        spend: true,
        icon: ic(DownloadIcon, 'text-brand'),
        run: () => openImport(),
      },
      {
        id: 'action-new-holding',
        title: 'Record New Holding',
        subtitle: 'Add a stock, fund, crypto or gold holding',
        badge: 'Action',
        keywords: ['add', 'holding', 'buy', 'stock', 'fund', 'crypto', 'gold', 'เพิ่ม', 'ซื้อ', 'หุ้น', 'สินทรัพย์', 'ทอง'],
        group: 'Actions',
        icon: ic(PlusIcon, 'text-brand'),
        run: go('/portfolio?action=new'),
      },
      {
        id: 'action-new-debt',
        title: 'Record Debt / Liability',
        subtitle: 'Add a debt, installment or loan',
        badge: 'Action',
        keywords: ['add', 'debt', 'loan', 'liability', 'installment', 'บัตรเครดิต', 'ผ่อน', 'หนี้', 'กู้', 'เพิ่มหนี้'],
        group: 'Actions',
        icon: ic(DebtIcon, 'text-rose-500'),
        run: go('/spend/loans?action=new'),
      },
      {
        id: 'action-new-dca',
        title: 'Create DCA Plan',
        subtitle: 'Set up a recurring monthly buy',
        badge: 'Action',
        keywords: ['dca', 'plan', 'recurring', 'monthly', 'แผน', 'ออม', 'ซื้อถัว'],
        group: 'Actions',
        icon: ic(DcaIcon, 'text-amber-500'),
        run: go('/dca?action=new'),
      },
      {
        id: 'action-new-account',
        title: 'Add Cash Account',
        subtitle: 'Add a bank account or cash wallet',
        badge: 'Action',
        keywords: ['bank', 'cash', 'account', 'saving', 'wallet', 'ธนาคาร', 'เงินสด', 'บัญชี', 'เงินฝาก'],
        group: 'Actions',
        icon: ic(WalletIcon, 'text-emerald-500'),
        run: go('/cash?action=new'),
      },

      // ── Pages ──
      ...(
        [
          ['nav-spend', 'Spend Home', "Today's allowance, bills due and today's spending", '/spend', ['spend', 'overview', 'budget', 'allowance', 'รายจ่าย', 'งบ', 'หน้าแรก'], DashboardIcon, true, undefined],
          ['nav-spend-txns', 'Transactions', 'Every income, expense and transfer', '/spend/txns', ['history', 'transactions', 'search', 'ประวัติ', 'รายการ'], ListBulletIcon, true, undefined],
          ['nav-spend-accounts', 'Accounts', 'Wallets and credit cards you pay with', '/spend/accounts', ['wallets', 'cards', 'credit', 'บัตร', 'กระเป๋า'], CreditCardIcon, true, undefined],
          ['nav-spend-analysis', 'Analysis', 'Spending by week, month or year', '/spend/analysis', ['analysis', 'report', 'chart', 'trend', 'วิเคราะห์', 'สรุป'], PieChartIcon, true, undefined],
          ['nav-spend-recurring', 'Bills & recurring', 'Bills and income that repeat', '/spend/recurring', ['recurring', 'bills', 'subscription', 'fixed', 'ค่าใช้จ่ายประจำ', 'บิล'], RepeatIcon, true, undefined],
          ['nav-spend-loans', 'Loans & installments', 'What you owe and pay back each month', '/spend/loans', ['loans', 'installments', 'debt', 'pay', 'หนี้', 'ผ่อน', 'งวด'], DebtIcon, true, undefined],
          ['nav-dashboard', 'Dashboard', 'Your net worth at a glance', '/', ['dashboard', 'home', 'net worth', 'หน้าแรก', 'แดชบอร์ด', 'ภาพรวม'], DashboardIcon, false, 'G D'],
          ['nav-portfolio', 'Portfolio', 'All your holdings', '/portfolio', ['portfolio', 'holdings', 'stocks', 'funds', 'พอร์ต', 'หุ้น', 'สินทรัพย์'], PortfolioIcon, false, 'G P'],
          ['nav-rebalance', 'Rebalance Hub', 'Check and adjust how your portfolio is split', '/rebalance', ['rebalance', 'allocation', 'target', 'drift', 'ปรับพอร์ต', 'สมดุล'], SparkleIcon, false, 'G R'],
          ['nav-dca', 'DCA Planner', 'Plan and confirm your recurring buys', '/dca', ['dca', 'planner', 'recurring', 'งวด', 'ออมหุ้น'], DcaIcon, false, 'G A'],
          ['nav-dividends', 'Dividends', 'Dividends received and expected', '/dividends', ['dividend', 'passive income', 'yield', 'ปันผล', 'เงินปันผล'], ReceiptPercentIcon, false, 'G V'],
          ['nav-cash', 'Cash & Liquidity', 'Cash, savings and interest', '/cash', ['cash', 'liquidity', 'emergency', 'เงินสด', 'บัญชี', 'สภาพคล่อง'], WalletIcon, false, 'G C'],
          ['nav-retirement', 'Retirement (FIRE)', 'Plan for retirement and financial freedom', '/retirement', ['retirement', 'fire', 'financial freedom', 'เกษียณ', 'อิสรภาพ'], SparkleIcon, false, 'G F'],
          ['nav-logs', 'Activity Logs', 'History of buys, sales, dividends and tax', '/logs', ['logs', 'history', 'activity', 'ประวัติ', 'บันทึก'], ClockIcon, false, 'G L'],
          ['nav-summary', 'P/L Summary', 'Profit and loss by month, year or period', '/logs/summary', ['summary', 'profit', 'loss', 'pnl', 'สรุป', 'กำไร', 'ขาดทุน'], PieChartIcon, false, undefined],
          ['nav-settings', 'Settings', 'Theme, spending month, budgets, backup and sync', '/settings', ['settings', 'preferences', 'theme', 'budget', 'payday', 'categories', 'backup', 'profile', 'ตั้งค่า', 'สำรอง'], SettingsIcon, false, 'G S'],
        ] as const
      ).map(([id, title, subtitle, to, keywords, Icon, isSpend, badge]) => ({
        id,
        title,
        subtitle,
        badge,
        keywords: [...keywords, 'go', 'page', 'open'],
        group: 'Pages' as const,
        spend: isSpend,
        icon: ic(Icon),
        run: go(to),
      })),

      // ── Settings sections ──
      ...(
        [
          ['spending-month', 'Spending month / payday', 'Count from the 1st or from payday', ['payday', 'pay cycle', 'salary day', 'เงินเดือนออก', 'รอบเดือน']],
          ['monthly-budget', 'Monthly budget', 'What you plan to spend each month', ['budget', 'limit', 'งบ', 'งบประมาณ']],
          ['categories', 'Categories', 'Add, rename or change icons', ['category', 'categories', 'icon', 'หมวด', 'หมวดหมู่']],
          ['category-budgets', 'Budget per category', 'Limits per category', ['budget', 'category', 'limit', 'งบหมวด']],
          ['bill-reminders', 'Card bill reminders', 'Days before a card bill is due', ['reminder', 'card', 'bill', 'due', 'แจ้งเตือน']],
          ['quick-add', 'Default payment method', 'Picked for you in Quick add', ['default', 'payment', 'quick add', 'wallet', 'ค่าเริ่มต้น']],
          ['data', 'Import / export CSV', 'Statements in, a spreadsheet out', ['import', 'export', 'csv', 'excel', 'download', 'นำเข้า', 'ส่งออก']],
        ] as const
      ).map(([hash, title, subtitle, keywords]) => ({
        id: `set-spend-${hash}`,
        title,
        subtitle: `Settings · Spend · ${subtitle}`,
        keywords: [...keywords, 'settings', 'ตั้งค่า'],
        group: 'Settings' as const,
        spend: true,
        icon: ic(SettingsIcon),
        run: go(`/settings#${hash}`),
      })),
      {
        id: 'set-backup',
        title: 'Backup, import and reset',
        subtitle: 'Settings · Export or restore your data',
        keywords: ['backup', 'import', 'export', 'restore', 'reset', 'สำรอง', 'นำเข้า'],
        group: 'Settings',
        icon: ic(SettingsIcon),
        run: go('/settings#backup'),
      },
      {
        id: 'set-sync',
        title: 'Cloud sync and profile',
        subtitle: 'Settings · Account, sync and your name',
        keywords: ['sync', 'cloud', 'profile', 'account', 'name', 'login', 'ซิงค์', 'โปรไฟล์'],
        group: 'Settings',
        icon: ic(SettingsIcon),
        run: go('/settings#general'),
      },

      // ── System ──
      {
        id: 'sys-theme-toggle',
        title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Change the color theme',
        badge: 'Theme',
        keywords: ['theme', 'dark', 'light', 'mode', 'color', 'สว่าง', 'มืด', 'ธีม'],
        group: 'System',
        icon: ic(SparkleIcon, 'text-brand'),
        run: () => {
          const nextTheme = theme === 'dark' ? 'light' : 'dark'
          setTheme(nextTheme)
          showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info')
        },
      },
      {
        id: 'sys-export-backup',
        title: 'Export Backup Data (JSON)',
        subtitle: 'Download a backup of all your data',
        badge: 'Backup',
        keywords: ['export', 'backup', 'download', 'json', 'ส่งออก', 'สำรองข้อมูล'],
        group: 'System',
        icon: ic(DownloadIcon),
        run: () => {
          exportData()
          showToast('Backup JSON downloaded successfully', 'success')
        },
      },
      {
        id: 'sys-shortcuts',
        title: 'View Keyboard Shortcuts',
        subtitle: 'See every keyboard shortcut',
        badge: '?',
        keywords: ['shortcut', 'shortcuts', 'keyboard', 'hotkey', 'คีย์ลัด', 'ปุ่ม'],
        group: 'System',
        icon: ic(KeyboardIcon),
        stay: true,
        run: () => setShowShortcuts(true),
      },
    ]

    // ── Wallets and cards ──
    for (const m of spend.methods) {
      const card = m.kind === 'card'
      list.push({
        id: `acct-${m.id}`,
        title: m.name,
        subtitle: card
          ? `Credit card · ${thbSigned(m.balance, true)} owed`
          : `Wallet · ${thb(m.balance, true)}`,
        keywords: card ? ['card', 'credit', 'บัตร'] : ['wallet', 'account', 'bank', 'กระเป๋า', 'บัญชี'],
        group: 'Accounts',
        spend: true,
        icon: card ? (
          <span className="grid h-full w-full place-items-center" style={{ background: m.color ?? '#0f172a' }}>
            {ic(CreditCardIcon, 'text-white')}
          </span>
        ) : (
          ic(WalletIcon)
        ),
        iconBox: card ? 'border-transparent' : undefined,
        run: go(`/spend/txns?q=${encodeURIComponent(m.name.toLowerCase())}`),
      })
    }

    // ── Categories ──
    for (const type of ['expense', 'income'] as const) {
      for (const c of manageableCategories(type)) {
        list.push({
          id: `cat-${c.id}`,
          title: c.label,
          subtitle: `${type === 'income' ? 'Income' : 'Expense'} category${c.hidden ? ' · hidden' : ''}`,
          keywords: [...c.keywords, 'category', 'หมวด'],
          group: 'Categories',
          spend: true,
          icon: <c.icon className="h-4 w-4" />,
          iconBox: `border-transparent ${TONES[c.tone].chip}`,
          run: go(`/spend/txns?q=${encodeURIComponent(c.label.toLowerCase())}`),
        })
      }
    }

    // ── Recurring ──
    for (const r of spend.recurring) {
      const cat = getCategory(r.categoryId)
      list.push({
        id: `rec-${r.id}`,
        title: r.name,
        subtitle: `${r.type === 'income' ? '+' : ''}${thb(r.amount, true)} · ${frequencyLabel(r)}${r.paused ? ' · paused' : ''}`,
        keywords: ['recurring', 'bill', 'subscription', 'ประจำ', ...(cat ? [cat.label] : [])],
        group: 'Recurring',
        spend: true,
        icon: ic(RepeatIcon),
        run: go('/spend/recurring'),
      })
    }

    // ── Savings goals ──
    for (const g of spend.goals) {
      const p = goalProgress(g, spend.wallets)
      list.push({
        id: `goal-${g.id}`,
        title: g.name,
        subtitle: `Savings goal · ${Math.round(p.pct)}% · ${thb(p.saved)} of ${thb(g.target)}`,
        keywords: ['goal', 'saving', 'save', 'เป้าหมาย', 'ออมเงิน'],
        group: 'Accounts',
        spend: true,
        icon: ic(SparkleIcon, 'text-emerald-500'),
        run: go('/spend/accounts'),
      })
    }

    // ── Holdings ──
    for (const h of data.holdings ?? []) {
      const valThb = (h.units ?? 0) * (h.price ?? 0)
      list.push({
        id: `holding-${h.id}`,
        title: `${h.ticker} · ${h.name}`,
        subtitle: `${h.assetClass.toUpperCase()} · ${thb(valThb)} (${(h.units ?? 0).toLocaleString()} units)`,
        badge: h.assetClass,
        keywords: [h.ticker, h.name, h.assetClass, 'holding', 'asset', 'หุ้น'],
        group: 'Holdings',
        icon: <span className="text-xs font-bold text-brand">{h.ticker.slice(0, 2).toUpperCase()}</span>,
        run: go(`/portfolio?search=${encodeURIComponent(h.ticker)}`),
      })
    }

    // ── DCA plans ──
    for (const p of data.dcaPlans ?? []) {
      list.push({
        id: `dca-${p.id}`,
        title: p.name,
        subtitle: `DCA · ${thb(p.monthlyAmount)} ${p.frequency === 'weekly' ? 'a week' : p.frequency === 'daily' ? 'a day' : 'a month'}`,
        keywords: [p.ticker ?? '', 'dca', 'plan', 'ออม'],
        group: 'DCA plans',
        icon: ic(DcaIcon, 'text-amber-500'),
        run: go('/dca'),
      })
    }

    // ── Debts ──
    for (const l of data.liabilities ?? []) {
      list.push({
        id: `debt-${l.id}`,
        title: l.name,
        subtitle: `Debt · ${thb(l.balance)} left${l.monthlyPayment ? ` · ${thb(l.monthlyPayment)}/mo` : ''}`,
        keywords: ['debt', 'loan', 'installment', 'หนี้', 'ผ่อน'],
        group: 'Debts',
        icon: ic(DebtIcon, 'text-rose-500'),
        run: go('/spend/loans'),
      })
    }

    return list
    // Category edits live in settings; the lookups read them, so list them to rebuild on change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spend.methods, spend.recurring, spend.goals, spend.wallets, spend.settings.customCategories, spend.settings.categoryEdits, data.holdings, data.dcaPlans, data.liabilities, theme, setTheme, showToast, exportData, go])

  // ── Rank everything against the query ──
  const results = useMemo<Ranked[]>(() => {
    const q = query.trim()
    const boost = (it: CommandItem) => usageBoost(usage[it.id]) + (inSpend && it.spend ? 0.2 : 0)

    if (!q) {
      const out: Ranked[] = recent.map((r, i) => ({
        id: `recent-${i}`,
        title: r,
        keywords: [],
        group: 'Recent searches',
        icon: ic(ClockIcon),
        stay: true,
        run: () => {
          setQuery(r)
          setSelectedIndex(0)
        },
        score: 1,
      }))
      const used = items
        .filter((it) => usage[it.id])
        .map((it) => ({ ...it, group: 'Frequently used' as const, score: boost(it) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
      const usedIds = new Set(used.map((u) => u.id))
      const actions = items
        .filter((it) => it.group === 'Actions' && !usedIds.has(it.id))
        .map((it) => ({ ...it, score: boost(it) }))
        .sort((a, b) => b.score - a.score)
      const pages = items
        .filter((it) => it.group === 'Pages' && !usedIds.has(it.id))
        .map((it) => ({ ...it, score: boost(it) }))
        .sort((a, b) => b.score - a.score)
      return [...out, ...used, ...actions, ...pages]
    }

    const ranked: Ranked[] = []

    // Commands that take arguments
    const intent = parseQuickAdd(q)
    if (intent) {
      const cat = guessCategory(intent.note, intent.type)
      ranked.push({
        id: 'do-quick-add',
        title: `Add ${intent.type} ${thb(intent.amount, true)}${intent.note ? ` · ${intent.note}` : ''}`,
        subtitle: `Quick add${cat ? ` as ${cat.label}` : ''} · check it, then save`,
        keywords: [],
        group: 'Do it',
        spend: true,
        icon: ic(PlusIcon, 'text-brand'),
        run: () => openQuickAdd({ draft: { type: intent.type, amount: intent.amount, note: intent.note, categoryId: cat?.id } }),
        score: 2,
      })
    }
    const payWhat = parseVerb(q, ['pay', 'จ่าย'])
    if (payWhat) {
      for (const c of spend.cards) {
        if (scoreItem(queryTerms(payWhat), { title: c.name, keywords: c.last4 ? [c.last4] : [] }) === 0) continue
        const bill = spend.bills.find((b) => b.card.id === c.id)
        ranked.push({
          id: `do-pay-${c.id}`,
          title: `Pay ${c.name} bill`,
          subtitle:
            bill && bill.amountDue > 0
              ? `${thb(bill.amountDue, true)} due ${shortDate(bill.dueDate)}`
              : c.balance > 0
                ? `Nothing billed yet · ${thb(c.balance, true)} owed, pay early`
                : 'Nothing owed',
          keywords: [],
          group: 'Do it',
          spend: true,
          icon: ic(CreditCardIcon, 'text-brand'),
          run: () => openPayBill(c.id),
          score: 2,
        })
      }
    }
    const budgetWhat = parseVerb(q, ['budget', 'งบ'])
    if (budgetWhat) {
      for (const c of manageableCategories('expense')) {
        if (scoreItem(queryTerms(budgetWhat), { title: c.label, keywords: c.keywords }) === 0) continue
        const b = spend.settings.categoryBudgets?.[c.id]
        ranked.push({
          id: `do-budget-${c.id}`,
          title: `${c.label} budget`,
          subtitle: b ? `${thb(b)} a month · change it` : 'No limit yet · set one',
          keywords: [],
          group: 'Do it',
          spend: true,
          icon: <c.icon className="h-4 w-4" />,
          iconBox: `border-transparent ${TONES[c.tone].chip}`,
          run: go('/settings#category-budgets'),
          score: 2,
        })
      }
    }

    // Number-like words (65, >1000, 100-500) filter transactions by amount; the rest match text
    const filters: AmountFilter[] = []
    const textTerms: string[] = []
    for (const word of q.toLowerCase().split(/\s+/).filter(Boolean)) {
      const f = parseAmountFilter(word)
      if (f) filters.push(f)
      else textTerms.push(...queryTerms(word))
    }

    // Static items
    if (textTerms.length) {
      for (const it of items) {
        const s = scoreItem(textTerms, it)
        if (s > 0) ranked.push({ ...it, score: s + boost(it) })
      }
    }
    const methodName = (id?: string) => spend.methods.find((m) => m.id === id)?.name ?? ''
    const txnHits: Ranked[] = []
    for (const t of spend.transactions) {
      if (!filters.every((f) => amountMatches(f, t.amount))) continue
      const cat = getCategory(t.categoryId)
      const title = noteTitle(t.note) || (t.type === 'transfer' ? 'Transfer' : cat?.label ?? 'Other')
      const s = textTerms.length
        ? scoreItem(textTerms, {
            title,
            subtitle: [cat?.label, methodName(t.accountId), methodName(t.toAccountId)].filter(Boolean).join(' '),
            keywords: [...(t.tags ?? []).map((tag) => `#${tag}`), ...(cat?.keywords ?? [])],
          })
        : 0.8
      if (s === 0) continue
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''
      txnHits.push({
        id: `txn-${t.id}`,
        title,
        subtitle: `${shortDate(t.date)} · ${sign}${thb(t.amount, true)}${cat ? ` · ${cat.label}` : ''}${t.accountId ? ` · ${methodName(t.accountId)}` : ''}`,
        keywords: [],
        group: 'Transactions',
        spend: true,
        icon: cat ? <cat.icon className="h-4 w-4" /> : ic(TransferIcon),
        iconBox: cat ? `border-transparent ${TONES[cat.tone].chip}` : undefined,
        run: () => (t.source ? navigate(t.source === 'dca' ? '/dca' : '/dividends') : openQuickAdd({ editId: t.id })),
        score: s + (inSpend ? 0.2 : 0) - 0.05,
      })
    }
    // Best match first, then newest
    txnHits.sort((a, b) => b.score - a.score)
    ranked.push(...txnHits)
    if (txnHits.length > GROUP_LIMIT && textTerms.length) {
      ranked.push({
        id: 'txn-all',
        title: `See all ${txnHits.length} matching transactions`,
        keywords: [],
        group: 'Transactions',
        spend: true,
        icon: ic(ListBulletIcon, 'text-brand'),
        run: go(`/spend/txns?q=${encodeURIComponent(textTerms.join(' '))}`),
        score: -1,
      })
    }

    return ranked
  }, [query, items, usage, recent, inSpend, spend.transactions, spend.methods, spend.cards, spend.bills, spend.settings.categoryBudgets, navigate, go])

  // ── Group: best groups first, a few rows each, with counts ──
  const { rows, counts } = useMemo(() => {
    const byGroup = new Map<Group, Ranked[]>()
    for (const r of results) byGroup.set(r.group, [...(byGroup.get(r.group) ?? []), r])
    const counts = new Map<Group, number>()
    for (const [g, list] of byGroup) counts.set(g, list.filter((r) => r.id !== 'txn-all').length)
    const searching = query.trim() !== ''
    const groups = [...byGroup.keys()].sort((a, b) => {
      if (!searching) return GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)
      if (a === 'Do it' || b === 'Do it') return a === 'Do it' ? -1 : 1
      const best = (g: Group) => Math.max(...byGroup.get(g)!.map((r) => r.score))
      return best(b) - best(a) || GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)
    })
    const rows: Ranked[] = []
    for (const g of groups) {
      const list = byGroup.get(g)!
      const sorted = [...list].sort((a, b) => b.score - a.score)
      const limit = !searching && (g === 'Actions' || g === 'Pages') ? 8 : GROUP_LIMIT
      const shown = sorted.filter((r) => r.id !== 'txn-all').slice(0, limit)
      const all = sorted.find((r) => r.id === 'txn-all')
      rows.push(...shown, ...(all ? [all] : []))
    }
    return { rows, counts }
  }, [results, query])

  const pick = (item: Ranked) => {
    if (!item.stay) {
      const q = query.trim()
      if (!item.id.startsWith('recent-')) {
        const next = { ...usage, [item.id]: { n: (usage[item.id]?.n ?? 0) + 1, last: Date.now() } }
        // Keep the 200 most recent so storage stays small
        writeJson(USAGE_KEY, Object.fromEntries(Object.entries(next).sort((a, b) => b[1].last - a[1].last).slice(0, 200)))
      }
      if (q) writeJson(RECENT_KEY, [q, ...recent.filter((r) => r !== q)].slice(0, 5))
      closePalette()
    }
    item.run()
  }

  // Ensure selectedIndex is within bounds
  useEffect(() => {
    if (selectedIndex >= rows.length) setSelectedIndex(Math.max(0, rows.length - 1))
  }, [rows.length, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, rows.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + rows.length) % Math.max(1, rows.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = rows[selectedIndex]
      if (current) pick(current)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    }
  }

  if (!isOpen) return null

  // ── Shortcuts Guide View ──
  if (showShortcuts) {
    const shortcutsList = [
      { key: '⌘ / Ctrl + K', desc: 'Open the command palette' },
      { key: '/', desc: 'Quick search from anywhere' },
      { key: '?', desc: 'Show keyboard shortcuts' },
      { key: 'Esc', desc: 'Close dialog or popup' },
      { key: '↑ / ↓', desc: 'Move through commands' },
      { key: 'Enter', desc: 'Run the selected command' },
    ]

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-ink/40 dark:bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
          onClick={closePalette}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-lift)] animate-sheetUp z-10">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <KeyboardIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Keyboard Shortcuts</h3>
                <p className="text-xs text-ink-muted">Get around Spendiary quickly with your keyboard</p>
              </div>
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="grid h-8 w-8 place-items-center rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink cursor-pointer"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="divide-y divide-line/60 py-2">
            {shortcutsList.map((s) => (
              <div key={s.key} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-ink-soft">{s.desc}</span>
                <kbd className="inline-flex items-center rounded-lg bg-surface-muted border border-line-strong px-2 py-1 text-xs font-bold font-mono text-ink shadow-2xs">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-line flex justify-end">
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="rounded-full bg-ink dark:bg-[#4f46e5] hover:bg-ink-hover dark:hover:bg-[#4338ca] text-white px-5 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              Back to Command Palette
            </button>
          </div>
        </div>
      </div>
    )
  }

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      <div
        className="fixed inset-0 bg-ink/40 dark:bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={closePalette}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-xl rounded-2xl sm:rounded-3xl border border-line bg-surface shadow-[var(--shadow-lift)] overflow-hidden flex flex-col max-h-[75vh] animate-sheetUp z-10"
        onKeyDown={handlePaletteKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 border-b border-line px-4 sm:px-5 py-3.5 bg-surface">
          <SearchIcon className="h-5 w-5 text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder={inSpend ? 'Search or type "65 coffee #tag", "pay ktc", ">1000"' : 'Search pages, holdings, spending… or "65 coffee"'}
            aria-label="Search commands"
            className="w-full bg-transparent text-sm sm:text-base font-medium text-ink placeholder:text-ink-faint outline-none"
          />
          {query ? (
            <button onClick={() => setQuery('')} className="rounded-lg p-1 text-ink-faint hover:text-ink cursor-pointer" title="Clear input">
              <CloseIcon className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center rounded-md bg-surface-muted border border-line px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 select-none space-y-0.5" role="listbox">
          {rows.length === 0 ? (
            <div className="py-12 text-center">
              <CommandIcon className="h-8 w-8 mx-auto text-ink-faint mb-2 opacity-50" />
              <p className="text-sm font-semibold text-ink">Nothing matches</p>
              <p className="text-xs text-ink-muted mt-1">Try a note, #tag, amount like &quot;&gt;500&quot;, a page or a holding</p>
            </div>
          ) : (
            rows.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const showHeader = item.group !== lastGroup
              lastGroup = item.group
              const count = counts.get(item.group) ?? 0
              const shownInGroup = rows.filter((r) => r.group === item.group && r.id !== 'txn-all').length

              return (
                <div key={item.id}>
                  {showHeader && (
                    <div className="flex items-center justify-between px-3 pt-3 pb-1 text-xs font-extrabold uppercase tracking-wider text-ink-muted">
                      <span>{item.group}</span>
                      {query.trim() && count > 0 && (
                        <span className="font-semibold normal-case tracking-normal tnum">
                          {count > shownInGroup ? `${shownInGroup} of ${count}` : count}
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => pick(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? 'bg-brand/10 text-brand-ink dark:bg-brand/20 dark:text-brand-ink' : 'hover:bg-surface-muted text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg border shadow-2xs ${item.iconBox ?? 'bg-surface border-line'}`}>
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate leading-tight">{item.title}</p>
                        {item.subtitle && <p className="text-xs text-ink-muted truncate mt-0.5">{item.subtitle}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span className="hidden sm:inline rounded-md bg-surface-muted border border-line px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
                          {item.badge}
                        </span>
                      )}
                      <ArrowUpRightIcon className={`h-4 w-4 opacity-40 ${isSelected ? 'opacity-100 text-brand' : ''}`} />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between border-t border-line bg-surface-muted px-4 py-2 text-xs text-ink-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-surface border border-line px-1 py-0.5 font-mono text-xs">↑↓</kbd>
              <span className="hidden sm:inline">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-surface border border-line px-1 py-0.5 font-mono text-xs">↵</kbd>
              <span className="hidden sm:inline">to select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-surface border border-line px-1 py-0.5 font-mono text-xs">esc</kbd>
              <span className="hidden sm:inline">to dismiss</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-1 font-semibold text-brand-ink hover:underline cursor-pointer"
          >
            <kbd className="rounded bg-surface border border-line px-1 py-0.5 font-mono text-xs">?</kbd>
            <span>Shortcuts</span>
          </button>
        </div>
      </div>
    </div>
  )
}
