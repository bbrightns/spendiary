import { SegmentedControl } from '../ui/SegmentedControl'
import { TextField } from '../ui/Field'
import type { AcquisitionSource } from '../../lib/types'

interface Props {
  source: AcquisitionSource
  onSourceChange: (source: AcquisitionSource) => void
  receivedFrom: string
  onReceivedFromChange: (value: string) => void
}

/** "Bought" vs "Received" (gift / inheritance) picker shared by the add and buy-more forms. */
export function AcquisitionSourceField({ source, onSourceChange, receivedFrom, onReceivedFromChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium text-ink-soft">How did you get it?</label>
        <SegmentedControl
          size="sm"
          value={source}
          onChange={onSourceChange}
          options={[
            { value: 'bought', label: 'Bought' },
            { value: 'received', label: '🎁 Gift / Inheritance' },
          ]}
        />
      </div>
      {source === 'received' && (
        <>
          <TextField
            label="Received from"
            value={receivedFrom}
            onChange={onReceivedFromChange}
            placeholder="e.g. Brother, Mom, Grandpa"
          />
          <p className="rounded-xl bg-surface-muted px-3 py-2 text-xs text-ink-muted">
            No cash is taken. The cost is the market value on the day you received it, so profit and loss count from that day.
          </p>
        </>
      )}
    </div>
  )
}
