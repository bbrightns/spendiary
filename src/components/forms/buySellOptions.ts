import type { SegmentOption } from '../ui/SegmentedControl'

export const BUY_SELL_SEGMENT_OPTIONS: SegmentOption<'buy' | 'sell'>[] = [
  {
    value: 'buy',
    label: '+ Buy more',
    activeClassName: 'bg-gain-strong text-white shadow-sm',
    inactiveClassName: 'text-gain-ink hover:bg-gain/10',
  },
  {
    value: 'sell',
    label: '− Sell',
    activeClassName: 'bg-danger text-white shadow-sm',
    inactiveClassName: 'text-loss-ink hover:bg-loss/10',
  },
]
