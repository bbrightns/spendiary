import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../store/DataContext'
import { useTheme } from '../../hooks/useTheme'
import { useToast } from '../../store/ToastContext'
import { thb } from '../../lib/format'
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
  DownloadIcon,
  SparkleIcon,
  PlusIcon,
  CloseIcon,
  ArrowUpRightIcon,
} from '../icons'

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('spendiary:open-command-palette'))
}

export function openShortcutsGuide() {
  window.dispatchEvent(new CustomEvent('spendiary:open-shortcuts-guide'))
}

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  badge?: string
  keywords: string[]
  category: 'Actions' | 'Navigation' | 'Holdings' | 'System'
  icon: React.ReactNode
  onSelect: () => void
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const navigate = useNavigate()
  const { data, exportData } = useData()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Listen for global custom events and keyboard shortcuts
  useEffect(() => {
    function handleOpenEvent() {
      setShowShortcuts(false)
      setIsOpen(true)
      setQuery('')
      setSelectedIndex(0)
    }

    function handleShortcutsEvent() {
      setShowShortcuts(true)
      setIsOpen(true)
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Check if focus is inside an editable field
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
        setIsOpen((prev) => {
          if (!prev) {
            setShowShortcuts(false)
            setQuery('')
            setSelectedIndex(0)
          }
          return !prev
        })
        return
      }

      // '?' key to open keyboard shortcuts (when not typing in an input)
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setShowShortcuts(true)
        setIsOpen(true)
        return
      }

      // '/' key to focus command palette (when not typing in an input)
      if (e.key === '/' && !isInput && !isOpen) {
        e.preventDefault()
        setShowShortcuts(false)
        setIsOpen(true)
        setQuery('')
        setSelectedIndex(0)
        return
      }

      // Escape key to close
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
  }, [isOpen])

  // Focus input on open
  useEffect(() => {
    if (isOpen && !showShortcuts) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, showShortcuts])

  const closePalette = useCallback(() => {
    setIsOpen(false)
    setShowShortcuts(false)
    setQuery('')
  }, [])

  // Build command items catalog
  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      // ── Quick Actions ──
      {
        id: 'action-new-holding',
        title: 'Record New Holding',
        subtitle: 'บันทึกสินทรัพย์ / หุ้น / กองทุน / คริปโตใหม่',
        badge: 'Action',
        keywords: ['add', 'holding', 'buy', 'stock', 'fund', 'crypto', 'gold', 'เพิ่ม', 'ซื้อ', 'หุ้น', 'สินทรัพย์', 'ทอง'],
        category: 'Actions',
        icon: <PlusIcon className="h-4 w-4 text-brand" strokeWidth={2.4} />,
        onSelect: () => {
          navigate('/portfolio?action=new')
          closePalette()
        },
      },
      {
        id: 'action-new-debt',
        title: 'Record Debt / Liability',
        subtitle: 'บันทึกหนี้สิน / ผ่อนชำระ / สินเชื่อ',
        badge: 'Action',
        keywords: ['add', 'debt', 'loan', 'liability', 'installment', 'บัตรเครดิต', 'ผ่อน', 'หนี้', 'กู้', 'เพิ่มหนี้'],
        category: 'Actions',
        icon: <DebtIcon className="h-4 w-4 text-rose-500" strokeWidth={2} />,
        onSelect: () => {
          navigate('/debts?action=new')
          closePalette()
        },
      },
      {
        id: 'action-new-dca',
        title: 'Create DCA Plan',
        subtitle: 'ตั้งเป้าหมายการลงทุนแบบถัวเฉลี่ยรายเดือน',
        badge: 'Action',
        keywords: ['dca', 'plan', 'recurring', 'monthly', 'แผน', 'ออม', 'ซื้อถัว'],
        category: 'Actions',
        icon: <DcaIcon className="h-4 w-4 text-amber-500" strokeWidth={2.2} />,
        onSelect: () => {
          navigate('/dca?action=new')
          closePalette()
        },
      },
      {
        id: 'action-new-account',
        title: 'Add Cash Account',
        subtitle: 'เพิ่มบัญชีเงินฝากธนาคาร / กระเป๋าเงินสด',
        badge: 'Action',
        keywords: ['bank', 'cash', 'account', 'saving', 'ธนาคาร', 'เงินสด', 'บัญชี', 'เงินฝาก'],
        category: 'Actions',
        icon: <WalletIcon className="h-4 w-4 text-emerald-500" strokeWidth={2.2} />,
        onSelect: () => {
          navigate('/cash?action=new')
          closePalette()
        },
      },

      // ── Navigation ──
      {
        id: 'nav-dashboard',
        title: 'Go to Dashboard',
        subtitle: 'ภาพรวมความมั่งคั่งและสินทรัพย์สุทธิ',
        badge: 'G D',
        keywords: ['dashboard', 'home', 'net worth', 'หน้าแรก', 'แดชบอร์ด', 'ภาพรวม'],
        category: 'Navigation',
        icon: <DashboardIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/')
          closePalette()
        },
      },
      {
        id: 'nav-portfolio',
        title: 'Go to Portfolio',
        subtitle: 'พอร์ตสินทรัพย์และการถือครองทั้งหมด',
        badge: 'G P',
        keywords: ['portfolio', 'holdings', 'stocks', 'funds', 'พอร์ต', 'หุ้น', 'สินทรัพย์'],
        category: 'Navigation',
        icon: <PortfolioIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/portfolio')
          closePalette()
        },
      },
      {
        id: 'nav-rebalance',
        title: 'Go to Rebalance Hub',
        subtitle: 'วิเคราะห์และปรับสมดุลสัดส่วนพอร์ต',
        badge: 'G R',
        keywords: ['rebalance', 'allocation', 'target', 'drift', 'ปรับพอร์ต', 'สมดุล'],
        category: 'Navigation',
        icon: <SparkleIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/rebalance')
          closePalette()
        },
      },
      {
        id: 'nav-dca',
        title: 'Go to DCA Planner',
        subtitle: 'วางแผนและบันทึกการซื้อประจำงวด',
        badge: 'G A',
        keywords: ['dca', 'planner', 'recurring', 'งวด', 'ออมหุ้น'],
        category: 'Navigation',
        icon: <DcaIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/dca')
          closePalette()
        },
      },
      {
        id: 'nav-dividends',
        title: 'Go to Dividends',
        subtitle: 'ปันผลรับและประมาณการกระแสเงินสด',
        badge: 'G V',
        keywords: ['dividend', 'passive income', 'yield', 'ปันผล', 'เงินปันผล'],
        category: 'Navigation',
        icon: <ReceiptPercentIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/dividends')
          closePalette()
        },
      },
      {
        id: 'nav-debts',
        title: 'Go to Debts & Liabilities',
        subtitle: 'ภาระหนี้สินและการผ่อนชำระ',
        badge: 'G B',
        keywords: ['debt', 'liabilities', 'loan', 'หนี้', 'ผ่อน', 'ดอกเบี้ย'],
        category: 'Navigation',
        icon: <DebtIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/debts')
          closePalette()
        },
      },
      {
        id: 'nav-cash',
        title: 'Go to Cash & Liquidity',
        subtitle: 'เงินสด สภาพคล่อง และดอกเบี้ยเงินฝาก',
        badge: 'G C',
        keywords: ['cash', 'liquidity', 'emergency', 'เงินสด', 'บัญชี', 'สภาพคล่อง'],
        category: 'Navigation',
        icon: <WalletIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/cash')
          closePalette()
        },
      },
      {
        id: 'nav-retirement',
        title: 'Go to Retirement (FIRE)',
        subtitle: 'จำลองอิสรภาพทางการเงินและการเกษียณ',
        badge: 'G F',
        keywords: ['retirement', 'fire', 'financial freedom', 'เกษียณ', 'อิสรภาพ'],
        category: 'Navigation',
        icon: <SparkleIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/retirement')
          closePalette()
        },
      },
      {
        id: 'nav-logs',
        title: 'Go to Activity Logs',
        subtitle: 'ประวัติธุรกรรม ซื้อ ขาย ปันผล และภาษี',
        badge: 'G L',
        keywords: ['logs', 'history', 'activity', 'transactions', 'ประวัติ', 'บันทึก'],
        category: 'Navigation',
        icon: <ClockIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/logs')
          closePalette()
        },
      },
      {
        id: 'nav-settings',
        title: 'Go to Settings',
        subtitle: 'ตั้งค่าระบบ สำรองข้อมูล และโปรไฟล์',
        badge: 'G S',
        keywords: ['settings', 'preferences', 'backup', 'ตั้งค่า', 'สำรอง'],
        category: 'Navigation',
        icon: <SettingsIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          navigate('/settings')
          closePalette()
        },
      },

      // ── System & Preferences ──
      {
        id: 'sys-theme-toggle',
        title: `Switch Theme to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: `สลับธีมเป็นโหมด ${theme === 'dark' ? 'สว่าง (Light)' : 'มืด (Dark)'}`,
        badge: 'Theme',
        keywords: ['theme', 'dark', 'light', 'mode', 'color', 'สว่าง', 'มืด', 'ธีม'],
        category: 'System',
        icon: <SparkleIcon className="h-4 w-4 text-brand" strokeWidth={2} />,
        onSelect: () => {
          const nextTheme = theme === 'dark' ? 'light' : 'dark'
          setTheme(nextTheme)
          showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info')
          closePalette()
        },
      },
      {
        id: 'sys-export-backup',
        title: 'Export Backup Data (JSON)',
        subtitle: 'ดาวน์โหลดไฟล์สำรองข้อมูลการเงินทั้งหมด',
        badge: 'Backup',
        keywords: ['export', 'backup', 'download', 'json', 'ส่งออก', 'สำรองข้อมูล'],
        category: 'System',
        icon: <DownloadIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          exportData()
          showToast('Backup JSON downloaded successfully', 'success')
          closePalette()
        },
      },
      {
        id: 'sys-shortcuts',
        title: 'View Keyboard Shortcuts',
        subtitle: 'ดูคีย์ลัดสำหรับควบคุม Spendiary ทั้งหมด',
        badge: '?',
        keywords: ['shortcut', 'shortcuts', 'keyboard', 'hotkey', 'คีย์ลัด', 'ปุ่ม'],
        category: 'System',
        icon: <KeyboardIcon className="h-4 w-4 text-ink-muted" strokeWidth={2} />,
        onSelect: () => {
          setShowShortcuts(true)
        },
      },
    ]

    // ── User Holdings dynamic search items ──
    if (data.holdings && data.holdings.length > 0) {
      data.holdings.forEach((h) => {
        const valThb = (h.units ?? 0) * (h.price ?? 0)
        list.push({
          id: `holding-${h.id}`,
          title: `${h.ticker} · ${h.name}`,
          subtitle: `${h.assetClass.toUpperCase()} · ${thb(valThb)} (${(h.units ?? 0).toLocaleString()} units)`,
          badge: h.assetClass,
          keywords: [h.ticker, h.name, h.assetClass, 'holding', 'asset', 'หุ้น'],
          category: 'Holdings',
          icon: (
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand/10 text-brand text-xs font-bold">
              {h.ticker.slice(0, 2).toUpperCase()}
            </span>
          ),
          onSelect: () => {
            navigate(`/portfolio?search=${encodeURIComponent(h.ticker)}`)
            closePalette()
          },
        })
      })
    }

    return list
  }, [data.holdings, theme, setTheme, showToast, exportData, navigate, closePalette])

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Return actions + navigation + system by default
      return items.filter((item) => item.category !== 'Holdings')
    }

    return items.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q)
      const matchSubtitle = item.subtitle?.toLowerCase().includes(q)
      const matchKeywords = item.keywords.some((k) => k.toLowerCase().includes(q))
      return matchTitle || matchSubtitle || matchKeywords
    })
  }, [items, query])

  // Ensure selectedIndex is within bounds
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1))
    }
  }, [filteredItems.length, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Handle key navigation inside palette
  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = filteredItems[selectedIndex]
      if (current) {
        current.onSelect()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    }
  }

  if (!isOpen) return null

  // ── Shortcuts Guide View ──
  if (showShortcuts) {
    const shortcutsList = [
      { key: '⌘ / Ctrl + K', desc: 'Open Command Palette (เปิดกล่องคำสั่งด่วน)' },
      { key: '/', desc: 'Quick Search from anywhere (ค้นหาด่วน)' },
      { key: '?', desc: 'Open Keyboard Shortcuts Guide (ดูคีย์ลัดทั้งหมด)' },
      { key: 'Esc', desc: 'Close dialog / dismiss popup (ปิดหน้าต่าง)' },
      { key: '↑ / ↓', desc: 'Navigate commands (เลื่อนแถบเลือกคำสั่ง)' },
      { key: 'Enter', desc: 'Execute selected command (สั่งการทำงาน)' },
    ]

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-ink/40 dark:bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
          onClick={closePalette}
          aria-hidden="true"
        />

        {/* Modal Card */}
        <div className="relative w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-lift)] animate-sheetUp z-10">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <KeyboardIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Keyboard Shortcuts</h3>
                <p className="text-xs text-ink-muted">ควบคุม Spendiary ได้อย่างรวดเร็วผ่านคีย์บอร์ด</p>
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

  // Group items by category
  let lastCategory = ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 dark:bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={closePalette}
        aria-hidden="true"
      />

      {/* Palette Container */}
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
            placeholder="Type a command or search assets (e.g. Portfolio, Add, BTC)..."
            className="w-full bg-transparent text-sm sm:text-base font-medium text-ink placeholder:text-ink-faint outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="rounded-lg p-1 text-ink-faint hover:text-ink cursor-pointer"
              title="Clear input"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center rounded-md bg-surface-muted border border-line px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 divide-y-0 select-none space-y-0.5"
          role="listbox"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center">
              <CommandIcon className="h-8 w-8 mx-auto text-ink-faint mb-2 opacity-50" />
              <p className="text-sm font-semibold text-ink">No matching commands or assets</p>
              <p className="text-xs text-ink-muted mt-1">ลองพิมพ์ชื่อหุ้น, กองทุน, หรือคำสั่งเช่น &quot;DCA&quot;, &quot;หนี้&quot;</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const showCategoryHeader = item.category !== lastCategory
              if (showCategoryHeader) {
                lastCategory = item.category
              }

              return (
                <div key={item.id}>
                  {showCategoryHeader && (
                    <div className="px-3 pt-3 pb-1 text-xs font-extrabold uppercase tracking-wider text-ink-faint">
                      {item.category === 'Actions'
                        ? '⚡ Quick Actions'
                        : item.category === 'Navigation'
                        ? '🧭 Navigation'
                        : item.category === 'Holdings'
                        ? '💼 Your Holdings'
                        : '⚙️ Preferences & System'}
                    </div>
                  )}

                  <div
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => item.onSelect()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand/10 text-brand-ink dark:bg-brand/20 dark:text-brand-ink'
                        : 'hover:bg-surface-muted text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface border border-line shadow-2xs">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate leading-tight">
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-ink-muted truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span className="rounded-md bg-surface-muted border border-line px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
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
            className="flex items-center gap-1 font-semibold text-brand hover:underline cursor-pointer"
          >
            <kbd className="rounded bg-surface border border-line px-1 py-0.5 font-mono text-xs">?</kbd>
            <span>Shortcuts</span>
          </button>
        </div>
      </div>
    </div>
  )
}
