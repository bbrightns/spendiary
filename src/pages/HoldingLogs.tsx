import { useState } from 'react'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ASSET_META } from '../lib/calc'
import type { AssetClass } from '../lib/types'
import { ClockIcon } from '../components/icons'

const ACTION_LABEL = {
  add: 'Added',
  buy_more: 'Bought more',
  edit: 'Edited',
}

const ACTION_STYLE = {
  add: 'bg-gain/10 text-gain',
  buy_more: 'bg-brand/10 text-brand',
  edit: 'bg-surface-muted text-ink-muted',
}

const ACTION_ICON = {
  add: '+',
  buy_more: '↑',
  edit: '✎',
}

const ASSET_FILTERS: { key: AssetClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fund', label: 'Funds' },
  { key: 'stock', label: 'Stocks' },
  { key: 'crypto', label: 'Bitcoin' },
  { key: 'gold', label: 'Gold' },
]

const ACTION_FILTERS = [
  { key: 'all', label: 'All actions' },
  { key: 'add', label: 'Added' },
  { key: 'buy_more', label: 'Bought more' },
  { key: 'edit', label: 'Edited' },
] as const

export function HoldingLogs() {
  const { data } = useData()
  const logs = data.holdingLogs ?? []

  const [assetFilter, setAssetFilter] = useState<AssetClass | 'all'>('all')
  const [actionFilter, setActionFilter] = useState<'all' | 'add' | 'buy_more' | 'edit'>('all')

  const filtered = logs.filter((l) => {
    if (assetFilter !== 'all' && l.assetClass !== assetFilter) return false
    if (actionFilter !== 'all' && l.action !== actionFilter) return false
    return true
  })

  // Group by date
  const groups: { date: string; entries: typeof filtered }[] = []
  for (const log of filtered) {
    const date = new Date(log.timestamp).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    })
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.entries.push(log)
    } else {
      groups.push({ date, entries: [log] })
    }
  }

  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Activity Logs" />

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {ASSET_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setAssetFilter(f.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                assetFilter === f.key ? 'bg-ink text-white dark:bg-[#4f46e5] dark:text-white' : 'bg-surface-muted text-ink-soft hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActionFilter(f.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                actionFilter === f.key ? 'bg-ink text-white dark:bg-[#4f46e5] dark:text-white' : 'bg-surface-muted text-ink-soft hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClockIcon className="h-7 w-7" />}
            title="No activity yet"
            description="Actions you take in Portfolio — adding, buying more, or editing holdings — will appear here."
            accent="var(--color-brand)"
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.date}>
              <p className="mb-2 px-1 text-[12px] font-semibold text-ink-muted">{group.date}</p>
              <Card padded={false}>
                <ul className="divide-y divide-line">
                  {group.entries.map((log) => (
                    <li key={log.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                      <span
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[12px] font-bold"
                        style={{
                          color: ASSET_META[log.assetClass].color,
                          background: `color-mix(in srgb, ${ASSET_META[log.assetClass].color} 12%, white)`,
                        }}
                      >
                        {ACTION_ICON[log.action]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-[14px] font-semibold text-ink">{log.holdingName}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ACTION_STYLE[log.action]}`}>
                            {ACTION_LABEL[log.action]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-ink-muted">{log.note}</p>
                      </div>
                      <time className="shrink-0 text-[11.5px] text-ink-faint">
                        {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
