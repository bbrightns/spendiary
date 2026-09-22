import { useState, useRef, useMemo } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  SparkleIcon,
  CopyIcon,
  CheckIcon,
  UploadIcon,
  AlertIcon,
  PortfolioIcon,
  WalletIcon,
} from '../icons'
import { useData } from '../../store/DataContext'

const AI_PROMPT_TEMPLATE = `Convert my financial records into a valid JSON import for Spendiary.

Rules:
1. Return RAW JSON only. Do not add Markdown or commentary. If a unit, currency, date, transaction direction, cost, or current price is ambiguous, ask a clarification question instead of guessing.
2. Preserve every record. Never merge different tickers, accounts, transactions, or logs just because their names look similar. Numbers must be JSON numbers without commas.
3. Use these asset classes:
   - "fund": Thai stocks, Thai mutual funds, Thai DR/DRx, and SET/MAI assets. Values are THB.
   - "stock": US stocks and US ETFs. Costs/prices are USD when supplied; also preserve totalThbInvested, totalUsdInvested, and FX data when present.
   - "crypto": BTC, ETH, SOL, and other tokens. For BTC, preserve BTC-specific satoshi/location data when available. For other tokens, use fractional units (up to 8 decimal places) with avgCost and price in THB.
   - "gold": physical gold or gold holdings. Preserve grams/baht-gold and location data when present.
   - "real_estate": property, land, or a home, valued in THB.
   - "cash": only for cash-account records, never for an investment holding.
4. Keep transaction history in "holdingLogs" and dividend history in "dividendRecords". Preserve action, timestamp, holdingId, units, proceeds, realizedPnL, fees, cashAccountId, and before/after snapshots when supplied.
5. Keep DCA plans, recurring transfers, liabilities, fixed costs, income, personal budget, retirement settings, rebalance settings, planned assets, and net-worth/portfolio history when supplied.
6. Cash sale proceeds are not new deposits. Preserve the original action and amount so Spendiary can distinguish buys, deposits, sales, dividends, and transfers.
7. Do not invent live prices, FX rates, IDs, dates, tax, or transaction history. If a current price is unavailable for a THB asset, use avgCost only when the source explicitly says the current value is unknown; otherwise ask.

Expected shape:
{
  "userName": "optional",
  "monthlyIncome": 0,
  "monthlyFixedCost": 0,
  "monthlyPersonal": 0,
  "cashAccounts": [{ "id": "optional", "name": "KBank", "balance": 50000, "currency": "THB" }],
  "holdings": [{
    "id": "optional", "name": "Ethereum", "ticker": "ETH", "assetClass": "crypto",
    "units": 0.12567891, "avgCost": 120000, "price": 135000, "currency": "THB",
    "totalThbInvested": 15084.39
  }],
  "holdingLogs": [],
  "dividendRecords": [],
  "dcaPlans": [],
  "transfers": [],
  "fixedCostItems": [],
  "liabilities": [],
  "retirement": {},
  "plannedAssets": [],
  "netWorthHistory": [],
  "portfolioHistory": [],
  "rebalanceMode": "class",
  "rebalanceTargets": {}
}

Here are my records:
[PASTE EXCEL, CSV, notes, statements, or existing JSON HERE]`

interface AiImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

function cleanJsonString(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```json')) {
    s = s.slice(7)
  } else if (s.startsWith('```')) {
    s = s.slice(3)
  }
  if (s.endsWith('```')) {
    s = s.slice(0, -3)
  }
  s = s.trim()
  // Strip trailing comma if present (e.g. when copying an item from an array)
  s = s.replace(/,\s*$/, '').trim()
  return s
}

export function AiImportModal({ open, onClose, onSuccess }: AiImportModalProps) {
  const { importPortfolioAndCash, data } = useData()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [copied, setCopied] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showPromptPreview, setShowPromptPreview] = useState(false)

  const hasExistingData = data.holdings.length > 0 || data.cashAccounts.length > 0

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback if clipboard API is blocked
      const textArea = document.createElement('textarea')
      textArea.value = AI_PROMPT_TEMPLATE
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  // Parse JSON on the fly for preview & validation
  const parsedPreview = useMemo(() => {
    setErrorMsg(null)
    const cleaned = cleanJsonString(jsonText)
    if (!cleaned) return null

    try {
      let obj: unknown
      try {
        obj = JSON.parse(cleaned)
      } catch {
        // Fallback: try wrapping with brackets if user pasted a list of comma-separated objects
        obj = JSON.parse(`[${cleaned}]`)
      }

      if (typeof obj !== 'object' || obj === null) {
        return null
      }

      // Handle root array of holdings or root object
      let holdings: unknown[] = []
      let cashAccounts: unknown[] = []

      if (Array.isArray(obj)) {
        holdings = obj
      } else {
        const d = obj as Record<string, unknown>
        if (Array.isArray(d.holdings)) holdings = d.holdings
        if (Array.isArray(d.cashAccounts)) cashAccounts = d.cashAccounts
        // Fallback: If user pasted a single holding object directly
        if (holdings.length === 0 && cashAccounts.length === 0) {
          if (d.ticker || d.assetClass || typeof d.units === 'number') {
            holdings = [d]
          } else if (typeof d.balance === 'number') {
            cashAccounts = [d]
          }
        }
      }

      return {
        holdingsCount: holdings.length,
        cashCount: cashAccounts.length,
        holdings,
        cashAccounts,
      }
    } catch {
      return null
    }
  }, [jsonText])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setJsonText(content)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!parsedPreview || (parsedPreview.holdingsCount === 0 && parsedPreview.cashCount === 0)) {
      setErrorMsg('No valid holdings or cash accounts found. Please check your JSON format.')
      return
    }

    const res = importPortfolioAndCash(
      {
        holdings: parsedPreview.holdings,
        cashAccounts: parsedPreview.cashAccounts,
      },
      mode,
    )

    if (res.ok) {
      const holdingsMsg = res.count.holdings > 0 ? `${res.count.holdings} holdings` : ''
      const cashMsg = res.count.cashAccounts > 0 ? `${res.count.cashAccounts} cash accounts` : ''
      const summary = [holdingsMsg, cashMsg].filter(Boolean).join(' and ')

      setSuccessMsg(`Successfully imported ${summary}!`)
      setTimeout(() => {
        onSuccess?.()
        onClose()
        setJsonText('')
        setSuccessMsg(null)
      }, 1200)
    } else {
      setErrorMsg(res.error)
    }
  }

  const handleClose = () => {
    setJsonText('')
    setErrorMsg(null)
    setSuccessMsg(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import with AI (Excel / JSON)"
      description="Quickly import your assets from Excel or notes using ChatGPT, Claude, or Gemini."
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Button variant="secondary" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!parsedPreview || (parsedPreview.holdingsCount === 0 && parsedPreview.cashCount === 0)}
            className="w-full sm:w-auto"
          >
            <SparkleIcon className="h-4 w-4 mr-1.5" />
            Import {parsedPreview && (parsedPreview.holdingsCount > 0 || parsedPreview.cashCount > 0)
              ? `(${parsedPreview.holdingsCount + parsedPreview.cashCount} items)`
              : ''}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        {/* Step-by-Step Instructions */}
        <div className="rounded-2xl border border-line bg-surface-muted/60 p-4 sm:p-4.5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand">
            <SparkleIcon className="h-4 w-4" />
            <span>How It Works in 3 Easy Steps</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-surface border border-line/60">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand/15 text-xs text-brand">1</span>
                Copy Prompt
              </span>
              <p className="text-ink-muted leading-relaxed">
                Click <strong>"Copy AI Prompt"</strong> below. It tells AI the exact JSON format Spendiary needs.
              </p>
            </div>

            <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-surface border border-line/60">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand/15 text-xs text-brand">2</span>
                Ask ChatGPT / AI
              </span>
              <p className="text-ink-muted leading-relaxed">
                Paste the prompt and your Excel rows into ChatGPT, Claude, or Gemini to get the JSON output.
              </p>
            </div>

            <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-surface border border-line/60">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand/15 text-xs text-brand">3</span>
                Paste & Import
              </span>
              <p className="text-ink-muted leading-relaxed">
                Paste the generated JSON block in the box below and click <strong>Import</strong>.
              </p>
            </div>
          </div>

          {/* Copy Prompt Action Bar */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => setShowPromptPreview((v) => !v)}
              className="text-xs font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              {showPromptPreview ? 'Hide prompt template ▲' : 'View prompt template ▼'}
            </button>

            <Button
              type="button"
              variant={copied ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleCopyPrompt}
              className="cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-500 mr-1.5" />
                  Prompt Copied to Clipboard!
                </>
              ) : (
                <>
                  <CopyIcon className="h-3.5 w-3.5 mr-1.5" />
                  Copy AI Prompt
                </>
              )}
            </Button>
          </div>

          {/* Collapsible Prompt Preview */}
          {showPromptPreview && (
            <div className="relative mt-2 rounded-xl bg-ink/5 dark:bg-black/40 p-3 border border-line/50 text-xs font-mono text-ink-muted max-h-48 overflow-y-auto whitespace-pre-wrap">
              {AI_PROMPT_TEMPLATE}
            </div>
          )}
        </div>

        {/* JSON Input Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="json-paste-area" className="text-sm font-semibold text-ink">
              Paste JSON or Upload File
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline cursor-pointer"
              >
                <UploadIcon className="h-3.5 w-3.5" />
                Upload .json file
              </button>
            </div>
          </div>

          <textarea
            id="json-paste-area"
            rows={6}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={`Paste the JSON code block from ChatGPT here, e.g.\n{\n  "holdings": [\n    { "ticker": "PTT", "units": 1000, "avgCost": 34.5, "assetClass": "fund", "currency": "THB" },\n    { "ticker": "AAPL", "units": 10, "avgCost": 180.5, "assetClass": "stock", "currency": "USD" }\n  ]\n}`}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 font-mono text-xs text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10 dark:bg-black/20"
          />

          {/* Validation Feedback & Preview Badges */}
          {jsonText.trim().length > 0 && !parsedPreview && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              <AlertIcon className="h-4 w-4 shrink-0" />
              <span>Invalid JSON format. Make sure you pasted the entire JSON code block from AI.</span>
            </div>
          )}

          {parsedPreview && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-medium text-ink-muted">Detected:</span>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <PortfolioIcon className="h-3.5 w-3.5" />
                {parsedPreview.holdingsCount} {parsedPreview.holdingsCount === 1 ? 'Holding' : 'Holdings'}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/25 px-2.5 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <WalletIcon className="h-3.5 w-3.5" />
                {parsedPreview.cashCount} {parsedPreview.cashCount === 1 ? 'Cash Account' : 'Cash Accounts'}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              <AlertIcon className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckIcon className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Import Mode: Merge vs Replace */}
        {hasExistingData && (
          <div className="rounded-xl border border-line p-3.5 space-y-2 bg-surface">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Import Action</span>
              <SegmentedControl
                value={mode}
                onChange={(val) => setMode(val as 'merge' | 'replace')}
                options={[
                  { value: 'merge', label: 'Merge' },
                  { value: 'replace', label: 'Replace' },
                ]}
              />
            </div>
            <p className="text-xs text-ink-muted">
              {mode === 'merge'
                ? 'Merge: Adds new items and updates existing ones without deleting other records.'
                : 'Replace: Clears your existing holdings and cash accounts and replaces them with this import.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
