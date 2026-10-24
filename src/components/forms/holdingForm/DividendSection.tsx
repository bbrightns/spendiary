import type { Dispatch, SetStateAction } from 'react'
import { NumberField, SelectField } from '../../ui/Field'
import { ChevronDownIcon } from '../../icons'
import { useToast } from '../../../store/ToastContext'
import { THAI_MONTHS_SHORT } from '../../../lib/calc'
import type { CashAccount } from '../../../lib/types'

/** The "Dividends & payouts" accordion of the holding form (funds and stocks). */
export function DividendSection({
  isStock, units, expanded, setExpanded, paysDividend, setPaysDividend, dividendMonths, setDividendMonths,
  payoutDpsMap, setPayoutDpsMap, cashAccounts, defaultCashAccountId, setDefaultCashAccountId,
}: {
  isStock: boolean
  /** Units held, for the yearly estimate */
  units: number
  expanded: boolean
  setExpanded: Dispatch<SetStateAction<boolean>>
  paysDividend: boolean
  setPaysDividend: (on: boolean) => void
  dividendMonths: number[]
  setDividendMonths: Dispatch<SetStateAction<number[]>>
  payoutDpsMap: Record<number, number | string>
  setPayoutDpsMap: Dispatch<SetStateAction<Record<number, number | string>>>
  cashAccounts: CashAccount[] | undefined
  defaultCashAccountId: string
  setDefaultCashAccountId: (id: string) => void
}) {
  const { showToast } = useToast()
  const currencyPrefix = isStock ? '$' : '฿'
  const currencyUnit = isStock ? '$/share' : '฿/share'

  const totalAnnualDps = dividendMonths.reduce((sum, m) => {
    const raw = payoutDpsMap[m]
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
    return sum + (isNaN(num) ? 0 : num)
  }, 0)

  const currentUnits = units
  const estAnnualGross = currentUnits * totalAnnualDps
  const estAnnualNet = estAnnualGross * 0.90 // 10% tax estimate

  const handleToggleMonth = (mNum: number) => {
    setDividendMonths((prev) => {
      const isSelected = prev.includes(mNum)
      if (isSelected) {
        setPayoutDpsMap((prevMap) => {
          const next = { ...prevMap }
          delete next[mNum]
          return next
        })
        return prev.filter((m) => m !== mNum)
      } else {
        const existingValues = Object.values(payoutDpsMap).filter((v) => v !== '' && Number(v) > 0)
        const defaultVal = existingValues.length > 0 ? existingValues[0] : ''
        setPayoutDpsMap((prevMap) => ({
          ...prevMap,
          [mNum]: prevMap[mNum] ?? defaultVal,
        }))
        return [...prev, mNum].sort((a, b) => a - b)
      }
    })
  }

  const handleApplyDpsToAll = () => {
    const sorted = dividendMonths.slice().sort((a, b) => a - b)
    const firstSelectedMonth = sorted.find((m) => {
      const v = payoutDpsMap[m]
      return v !== '' && !isNaN(Number(v)) && Number(v) > 0
    }) ?? sorted[0]
    const sourceVal = firstSelectedMonth ? (payoutDpsMap[firstSelectedMonth] ?? '') : ''
    if (sourceVal === '' || Number(sourceVal) <= 0) return

    setPayoutDpsMap(() => {
      const next: Record<number, number | string> = {}
      dividendMonths.forEach((m) => {
        next[m] = sourceVal
      })
      return next
    })
    showToast('Copied the dividend amount to every payout', 'info')
  }


  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left bg-surface-muted transition-colors cursor-pointer select-none"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <span className="text-sm font-bold text-ink truncate">
            Dividends & payouts
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0 ${
              paysDividend
                ? 'bg-gain/10 text-gain font-bold'
                : 'bg-surface-muted text-ink-muted'
            }`}
          >
            {paysDividend ? `${dividendMonths.length} per year` : 'Off'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!expanded && (
            <span className="text-xs text-brand font-medium">Tap to view / edit</span>
          )}
          <ChevronDownIcon
            className={`h-4 w-4 text-ink-muted transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="p-3.5 sm:p-4 pt-1 space-y-3 border-t border-line/60">
          <div className="flex items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
              <input
                type="checkbox"
                checked={paysDividend}
                onChange={(e) => setPaysDividend(e.target.checked)}
                className="h-4 w-4 rounded-md border-line text-gain focus:ring-gain/30 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-sm font-bold text-ink flex items-center gap-1.5 whitespace-nowrap">
                  Track dividends
                </span>
                <p className="text-xs text-ink-muted truncate">
                  Turn on dividend tracking to estimate your income
                </p>
              </div>
            </label>
            <span className="text-xs font-medium text-ink-muted whitespace-nowrap shrink-0">
              (optional)
            </span>
          </div>

      {paysDividend && (
        <div className="space-y-4 pt-2 border-t border-line/60">
          {/* 12 Months selection pills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 whitespace-nowrap">
              <label className="text-xs font-semibold text-ink-soft whitespace-nowrap">
                Months it pays dividends
              </label>
              {dividendMonths.length > 0 && (
                <span className="text-xs font-bold text-gain whitespace-nowrap shrink-0">
                  {dividendMonths.length} per year
                </span>
              )}
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-xs">
              {THAI_MONTHS_SHORT.map((mName, idx) => {
                const mNum = idx + 1
                const isSelected = dividendMonths.includes(mNum)

                return (
                  <button
                    key={mNum}
                    type="button"
                    onClick={() => handleToggleMonth(mNum)}
                    className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-gain-strong text-white border-gain-strong shadow-2xs scale-105'
                        : 'bg-surface text-ink-muted border-line hover:text-ink hover:border-line-strong'
                    }`}
                  >
                    {mName}
                  </button>
                )
              })}
            </div>
            {dividendMonths.length > 0 && (
              <p className="text-xs text-gain font-medium pt-0.5">
                Dividend reminders in: {dividendMonths.slice().sort((a, b) => a - b).map((m) => THAI_MONTHS_SHORT[m - 1]).join(', ')}
              </p>
            )}
          </div>

          {/* Per-round DPS input section */}
          {dividendMonths.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface/40 p-3 text-center">
              <p className="text-xs text-ink-muted">
                Tap the months above that it pays a dividend
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    Dividend per share for each payout
                  </span>
                  <p className="text-xs text-ink-muted">
                    Enter the dividend per share for each payout
                  </p>
                </div>
                {dividendMonths.length > 1 && (
                  <button
                    type="button"
                    onClick={handleApplyDpsToAll}
                    className="inline-flex items-center text-xs font-semibold text-gain hover:underline cursor-pointer"
                  >
                    Use the same amount every time
                  </button>
                )}
              </div>

              <div className={`grid gap-2.5 ${dividendMonths.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {dividendMonths.slice().sort((a, b) => a - b).map((mNum, roundIdx) => (
                  <div key={mNum} className="rounded-xl border border-line bg-surface/80 p-2.5 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gain/15 text-gain text-xs font-bold">
                          {roundIdx + 1}
                        </span>
                        {THAI_MONTHS_SHORT[mNum - 1]} payout
                      </span>
                      <span className="text-xs font-medium text-ink-muted">
                        {currencyUnit}
                      </span>
                    </div>
                    <NumberField
                      label=""
                      prefix={currencyPrefix}
                      placeholder="0.00"
                      value={payoutDpsMap[mNum] ?? ''}
                      onChange={(val) => {
                        setPayoutDpsMap((prev) => ({ ...prev, [mNum]: val }))
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Summary box */}
              <div className="rounded-xl border border-gain/20 bg-gain/5 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-ink-muted block text-xs">Total dividend per year:</span>
                  <span className="font-display font-extrabold text-sm text-gain tnum">
                    {currencyPrefix}{totalAnnualDps.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    <span className="text-xs font-normal text-ink-muted ml-1">/{isStock ? 'share' : 'share'}</span>
                  </span>
                </div>
                {currentUnits > 0 && estAnnualGross > 0 && (
                  <div className="text-right">
                    <span className="text-ink-muted block text-xs">Estimated dividends per year ({currentUnits.toLocaleString()} shares):</span>
                    <span className="font-display font-bold text-sm text-ink tnum">
                      ~{currencyPrefix}{estAnnualNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs text-ink-muted ml-1 font-normal">(after 10% tax)</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Default Cash Account */}
          <SelectField
            label="Default cash account"
            value={defaultCashAccountId}
            options={[
              { value: '', label: 'None' },
              ...(cashAccounts ?? []).map((c) => ({
                value: c.id,
                label: `${c.name} (${c.currency === 'USD' ? '$' : '฿'}${c.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
              })),
            ]}
            onChange={setDefaultCashAccountId}
          />
        </div>
      )}
      </div>
    )}
    </div>
  )
}
