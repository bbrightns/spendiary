import { useData } from '../../store/DataContext'
import { isValidRate } from '../../lib/fx'
import { AlertIcon } from '../icons'

/**
 * Shown when this device has never loaded a real USD/THB rate but the user has US-dollar amounts.
 * Those amounts are then left unconverted rather than worked out at a made-up rate, and this says why.
 */
export function FxMissingNotice() {
  const { data, usdThb } = useData()
  if (isValidRate(usdThb)) return null
  const hasUsdAmounts =
    data.cashAccounts.some((a) => a.currency === 'USD') ||
    data.holdings.some((h) => h.assetClass === 'stock' || h.assetClass === 'crypto')
  if (!hasUsdAmounts) return null

  return (
    <div role="status" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm">
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warn-ink" />
      <p className="text-ink-soft">
        <span className="font-semibold text-ink">No USD/THB exchange rate yet.</span>{' '}
        Amounts in US dollars aren't converted or added to baht totals until a rate loads. Check your internet connection.
      </p>
    </div>
  )
}
