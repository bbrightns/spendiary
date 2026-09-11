import type { NetWorthSnapshot } from '../../lib/types'
import { InteractiveTrendChart } from './InteractiveTrendChart'

export { InteractiveTrendChart }
export type { InteractiveTrendChartProps, TimeFrame } from './InteractiveTrendChart'

export interface InteractiveNetWorthChartProps {
  history: NetWorthSnapshot[]
}

export function InteractiveNetWorthChart({ history }: InteractiveNetWorthChartProps) {
  return (
    <InteractiveTrendChart
      title="Net Worth Performance"
      history={history}
      accentColor="var(--color-cash)"
      gradientId="nwInteractiveGrad"
    />
  )
}
