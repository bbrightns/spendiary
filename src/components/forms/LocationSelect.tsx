import { SelectField, TextField } from '../ui/Field'
import type { AssetClass, HoldingLocation } from '../../lib/types'
import { formatLocationQty, locationNoun, NEW_LOCATION, qtyEpsilon } from '../../lib/locations'


interface Props {
  assetClass: AssetClass | undefined
  locations: HoldingLocation[]
  /** A location id, or NEW_LOCATION */
  value: string
  onChange: (id: string) => void
  /** Name typed for a new location; leave out to offer existing locations only (selling) */
  newName?: string
  onNewNameChange?: (name: string) => void
  label?: string
  /** Show how much each location holds next to its name */
  showQty?: boolean
  /** Hide locations that hold nothing (where you take out); keep them where you put in */
  hideEmpty?: boolean
  error?: string
}

/** Picks the wallet, vault or broker a buy goes into or a sale comes from. */
export function LocationSelect({
  assetClass, locations, value, onChange, newName, onNewNameChange, label, showQty, hideEmpty, error,
}: Props) {
  const noun = locationNoun(assetClass)
  const canCreate = onNewNameChange !== undefined
  const eps = qtyEpsilon(assetClass)
  const listed = hideEmpty ? locations.filter((l) => l.qty > eps || l.id === value) : locations
  const options = [
    ...listed.map((l) => ({
      value: l.id,
      label: `${l.name}${l.isLocked ? ' (locked)' : ''}${showQty ? ` · ${formatLocationQty(assetClass, l.qty)}` : ''}`,
    })),
    ...(canCreate ? [{ value: NEW_LOCATION, label: `+ New ${noun}…` }] : []),
  ]
  const placeholder =
    assetClass === 'stock' ? 'e.g. Webull, Dime, IBKR' : assetClass === 'gold' ? 'e.g. Home safe, Bank vault' : 'e.g. Binance, Cold wallet'

  return (
    <>
      <SelectField
        label={label ?? (assetClass === 'stock' ? 'Broker' : 'Storage / location')}
        value={value}
        onChange={onChange}
        options={options}
      />
      {canCreate && value === NEW_LOCATION && (
        <TextField
          label={`New ${noun} name`}
          value={newName ?? ''}
          onChange={(v) => onNewNameChange?.(v)}
          placeholder={placeholder}
          error={error}
        />
      )}
    </>
  )
}
