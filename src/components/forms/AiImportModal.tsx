import { useState, useRef, useMemo } from 'react'
import { Modal } from '../ui/Modal'
import { FormActions } from './FormActions'
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
  CreditCardIcon,
} from '../icons'
import { useData } from '../../store/DataContext'

const AI_PROMPT_TEMPLATE = `Convert my financial records into a valid JSON import for Spendiary.

Rules:
1. Input Completeness & Resilient Generation:
   - Generate valid JSON for all detected assets, cash accounts, and liabilities that have sufficient information.
   - If current market price is not provided for an asset, leave "price" out. Spendiary counts it at cost and marks it as having no price yet.
   - If any specific holding is missing critical core data (such as unknown unit count or completely missing cost basis) that cannot be reasonably inferred:
     * Exclude that specific incomplete asset from the JSON so valid items can still be imported immediately without blocking the entire import.
     * Provide an itemized numbered checklist in English directly below the JSON detailing which assets were skipped and what missing data is needed to add them later.
   - Only output clean JSON (wrap in \`\`\`json \`\`\` code fence) accompanied only by the clarification checklist if any items were skipped.
2. Preserve every record. Never merge different tickers, accounts, transactions, or logs just because their names look similar. Numbers must be JSON numbers without commas.
3. Asset Classes, Cash, and Liabilities (always set "assetClass" on every holding to one of the values below):
   - "fund": Thai stocks, Thai mutual funds, Thai DR/DRx, and SET/MAI assets. Values are THB.
   - "stock": US stocks and US ETFs. Costs/prices are USD when supplied; also preserve totalThbInvested, totalUsdInvested, and FX data when present.
   - "crypto": BTC, ETH, SOL, and other tokens. For BTC, preserve btcLocations (satoshi, thbSpent) when available. For other tokens, use fractional units (up to 8 decimal places) with avgCost and price in THB.
   - "gold": physical gold or gold holdings. Preserve grams/baht-gold and goldLocations (grams, thbSpent) when present.
   - "real_estate": property, land, or a home, valued in THB.
   - "cashAccounts": liquid cash accounts (Thai banks, digital wallets, broker cash). Fields: name (e.g. "KBank", "Dime Save"), balance, currency ("THB" or "USD"), category ("spending", "savings", "emergency", "investment", "other"), and optional annual interestRate (%).
   - "liabilities": debts, loans, credit cards, and installment plans. Fields: name (e.g. "KTC Credit Card", "iPhone installment"), category ("credit_card", "installment", "mortgage", "auto_loan", "personal_loan", "student_loan", "other"), balance (remaining debt amount in THB), and optional monthlyPayment, interestRate (%), dueDay (1-31), isInstallment (boolean), totalInstallments, paidInstallments.
4. Transaction & Historical Logs Policy:
   - When explicit historical transactions or dividend records are supplied in the input, keep transaction history in "holdingLogs" and dividend history in "dividendRecords" preserving action, timestamp, holdingId, units, proceeds, realizedPnL, fees, cashAccountId, and before/after snapshots.
   - If importing for the first time or if the source records do NOT contain historical transaction logs, simply set "holdingLogs": [] and "dividendRecords": []. Do not halt generation or ask clarification for historical logs if they are simply not part of the source input.
5. Keep DCA plans, recurring transfers, fixed costs, income, personal budget, retirement settings, rebalance settings, planned assets, and net-worth/portfolio history when supplied.
6. Cash sale proceeds are not new deposits. Preserve the original action and amount so Spendiary can distinguish buys, deposits, sales, dividends, and transfers.
7. Live prices & FX policy:
   - Do not invent live prices, FX rates, IDs, dates, tax, or mock transaction history.
   - If current market price is not provided, leave "price" out. Do not copy avgCost into it.

Expected shape:
{
  "schemaVersion": 1,
  "exportedAt": "2026-09-22T00:00:00.000Z",
  "data": {
    "userName": "optional",
    "monthlyIncome": 0,
    "cashAccounts": [
      {
        "id": "optional",
        "name": "KBank Savings",
        "balance": 50000,
        "category": "spending",
        "currency": "THB",
        "interestRate": 0.5
      },
      {
        "id": "optional",
        "name": "Dime Save",
        "balance": 30000,
        "category": "savings",
        "currency": "THB",
        "interestRate": 3.0
      }
    ],
    "holdings": [
      {
        "id": "optional",
        "name": "Ethereum",
        "ticker": "ETH",
        "assetClass": "crypto",
        "units": 0.12567891,
        "avgCost": 120000,
        "price": 135000,
        "totalThbInvested": 15081.47
      },
      {
        "id": "optional",
        "name": "Apple Inc.",
        "ticker": "AAPL",
        "assetClass": "stock",
        "units": 10,
        "avgCost": 220,
        "price": 231.4,
        "totalUsdInvested": 2200,
        "totalThbInvested": 77000
      }
    ],
    "liabilities": [
      {
        "id": "optional",
        "name": "KTC Visa Platinum",
        "category": "credit_card",
        "balance": 18500,
        "monthlyPayment": 18500,
        "dueDay": 25
      },
      {
        "id": "optional",
        "name": "iPhone 16 Pro Installment",
        "category": "installment",
        "balance": 24000,
        "monthlyPayment": 4000,
        "interestRate": 0,
        "dueDay": 15,
        "isInstallment": true,
        "totalInstallments": 10,
        "paidInstallments": 4
      }
    ],
    "holdingLogs": [],
    "dividendRecords": [],
    "dcaPlans": [],
    "transfers": [],
    "retirement": {},
    "plannedAssets": [],
    "netWorthHistory": [],
    "portfolioHistory": [],
    "rebalanceMode": "holding",
    "rebalanceTargets": {
      "fund": 40,
      "gold": 15,
      "stock": 35,
      "crypto": 10
    }
  },
  "preferences": {
    "theme": "light",
    "logsViewMode": "table",
    "goldSellUnit": "grams"
  }
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
  const match = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (match) {
    s = match[1].trim()
  } else {
    if (s.startsWith('```json')) {
      s = s.slice(7)
    } else if (s.startsWith('```')) {
      s = s.slice(3)
    }
    if (s.endsWith('```')) {
      s = s.slice(0, -3)
    }
    s = s.trim()
  }
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

  const hasExistingData = data.holdings.length > 0 || data.cashAccounts.length > 0 || (data.liabilities?.length ?? 0) > 0

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

  // New text clears the last import error
  const changeJson = (text: string) => {
    setJsonText(text)
    setErrorMsg(null)
  }

  // Parse JSON on the fly for preview & validation
  const parsedPreview = useMemo(() => {
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

      // Handle root array of holdings or root object (supporting both direct and backup 'data' envelope)
      let holdings: unknown[] = []
      let cashAccounts: unknown[] = []
      let liabilities: unknown[] = []

      if (Array.isArray(obj)) {
        holdings = obj
      } else {
        const rawObj = obj as Record<string, unknown>
        const d = (rawObj.data && typeof rawObj.data === 'object' && !Array.isArray(rawObj.data))
          ? (rawObj.data as Record<string, unknown>)
          : rawObj

        if (Array.isArray(d.holdings)) holdings = d.holdings
        if (Array.isArray(d.cashAccounts)) cashAccounts = d.cashAccounts
        if (Array.isArray(d.liabilities)) liabilities = d.liabilities

        // Fallback: If user pasted a single holding object directly
        if (holdings.length === 0 && cashAccounts.length === 0 && liabilities.length === 0) {
          if (d.ticker || d.assetClass || typeof d.units === 'number') {
            holdings = [d]
          } else if (typeof d.balance === 'number') {
            if (d.category && ['credit_card', 'installment', 'mortgage', 'auto_loan', 'personal_loan', 'student_loan'].includes(String(d.category))) {
              liabilities = [d]
            } else {
              cashAccounts = [d]
            }
          }
        }
      }

      return {
        holdingsCount: holdings.length,
        cashCount: cashAccounts.length,
        liabilitiesCount: liabilities.length,
        holdings,
        cashAccounts,
        liabilities,
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
        changeJson(content)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    setErrorMsg(null)
    setSuccessMsg(null)

    const totalItems = parsedPreview
      ? parsedPreview.holdingsCount + parsedPreview.cashCount + parsedPreview.liabilitiesCount
      : 0

    if (!parsedPreview || totalItems === 0) {
      setErrorMsg('No valid holdings, cash accounts, or liabilities found. Please check your JSON format.')
      return
    }

    const res = importPortfolioAndCash(
      {
        holdings: parsedPreview.holdings,
        cashAccounts: parsedPreview.cashAccounts,
        liabilities: parsedPreview.liabilities,
      },
      mode,
    )

    if (res.ok) {
      const holdingsMsg = res.count.holdings > 0 ? `${res.count.holdings} holdings` : ''
      const cashMsg = res.count.cashAccounts > 0 ? `${res.count.cashAccounts} cash accounts` : ''
      const debtsMsg = (res.count.liabilities && res.count.liabilities > 0) ? `${res.count.liabilities} liabilities` : ''
      const summary = [holdingsMsg, cashMsg, debtsMsg].filter(Boolean).join(', ')

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

  const importCount = parsedPreview ? parsedPreview.holdingsCount + parsedPreview.cashCount + parsedPreview.liabilitiesCount : 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import with AI"
      description="Bring in your assets from Excel or notes using ChatGPT, Claude or Gemini."
      size="lg"
      footer={
        <FormActions
          editing={false}
          canSave={importCount > 0}
          onSave={handleImport}
          submitLabel={importCount > 0 ? `Import ${importCount} ${importCount === 1 ? 'item' : 'items'}` : 'Import'}
          hint="Paste the AI's answer above to see what will be imported"
        />
      }
    >
      <div className="space-y-5 pt-1">
        {/* Step-by-Step Instructions */}
        <div className="rounded-2xl bg-surface-muted p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-link">
            <SparkleIcon className="h-4 w-4" />
            <span>How it works in 3 easy steps</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-surface border border-line/60">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand/15 text-xs text-link">1</span>
                Copy prompt
              </span>
              <p className="text-ink-muted leading-relaxed">
                Click <strong>"Copy AI Prompt"</strong> below. It tells AI the exact JSON format Spendiary needs.
              </p>
            </div>

            <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-surface border border-line/60">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand/15 text-xs text-link">2</span>
                Ask ChatGPT / AI
              </span>
              <p className="text-ink-muted leading-relaxed">
                Paste the prompt and your Excel rows into ChatGPT, Claude, or Gemini to get the JSON output.
              </p>
            </div>

            <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-surface border border-line/60">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand/15 text-xs text-link">3</span>
                Paste & import
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
                  <CheckIcon className="h-3.5 w-3.5 text-gain-ink mr-1.5" />
                  Prompt copied to clipboard!
                </>
              ) : (
                <>
                  <CopyIcon className="h-3.5 w-3.5 mr-1.5" />
                  Copy AI prompt
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
              Paste JSON or upload file
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
                className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline cursor-pointer"
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
            onChange={(e) => changeJson(e.target.value)}
            placeholder={`Paste the JSON code block from ChatGPT here, e.g.\n{\n  "holdings": [\n    { "ticker": "PTT", "units": 1000, "avgCost": 34.5, "assetClass": "fund", "currency": "THB" },\n    { "ticker": "AAPL", "units": 10, "avgCost": 180.5, "assetClass": "stock", "currency": "USD" }\n  ]\n}`}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 font-mono text-xs text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10 dark:bg-black/20"
          />

          {/* Validation Feedback & Preview Badges */}
          {jsonText.trim().length > 0 && !parsedPreview && (
            <div className="flex items-center gap-2 rounded-xl bg-loss/10 border border-loss/20 px-3 py-2 text-xs text-loss-ink">
              <AlertIcon className="h-4 w-4 shrink-0" />
              <span>Invalid JSON format. Make sure you pasted the entire JSON code block from AI.</span>
            </div>
          )}

          {parsedPreview && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-medium text-ink-muted">Detected:</span>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-gain/10 border border-gain/25 px-2.5 py-0.5 text-xs font-semibold text-gain-ink">
                <PortfolioIcon className="h-3.5 w-3.5" />
                {parsedPreview.holdingsCount} {parsedPreview.holdingsCount === 1 ? 'Holding' : 'Holdings'}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/25 px-2.5 py-0.5 text-xs font-semibold text-brand-ink">
                <WalletIcon className="h-3.5 w-3.5" />
                {parsedPreview.cashCount} {parsedPreview.cashCount === 1 ? 'Cash Account' : 'Cash Accounts'}
              </div>
              {parsedPreview.liabilitiesCount > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-loss/10 border border-loss/25 px-2.5 py-0.5 text-xs font-semibold text-loss-ink">
                  <CreditCardIcon className="h-3.5 w-3.5" />
                  {parsedPreview.liabilitiesCount} {parsedPreview.liabilitiesCount === 1 ? 'Debt / Liability' : 'Debts / Liabilities'}
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-loss/10 border border-loss/20 px-3 py-2 text-xs text-loss-ink">
              <AlertIcon className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-gain/10 border border-gain/20 px-3 py-2 text-xs text-gain-ink">
              <CheckIcon className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Import Mode: Merge vs Replace */}
        {hasExistingData && (
          <div className="rounded-xl border border-line p-3.5 space-y-2 bg-surface">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Import action</span>
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
                : 'Replace: Clears your existing holdings, cash accounts, and debts and replaces them with this import.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
