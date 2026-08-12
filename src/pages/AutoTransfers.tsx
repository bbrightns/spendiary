import { useState } from 'react'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressBar } from '../components/ui/ProgressBar'
import { AddButton } from '../components/ui/AddButton'
import { TransferForm } from '../components/forms/TransferForm'
import { AlertIcon, CheckIcon, TransferIcon, PencilIcon, TrashIcon } from '../components/icons'
import { FREQUENCY_LABEL, remainingTransfers, transferProgress } from '../lib/calc'
import { daysUntil, formatDate, thb } from '../lib/format'
import type { Transfer } from '../lib/types'

const SOON_THRESHOLD = 14

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

export function AutoTransfers() {
  const { data } = useData()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transfer | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (t: Transfer) => {
    setEditing(t)
    setFormOpen(true)
  }

  if (data.transfers.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Schedules" title="Auto Transfers" />
        <Card>
          <EmptyState
            icon={<TransferIcon className="h-7 w-7" />}
            title="No transfer schedules"
            description="Track recurring bank transfers, allowances, savings, and premiums. Get a heads-up before each schedule expires."
            accent="var(--color-stocks)"
            action={
              <AddButton onClick={openAdd} label="Add transfer" />
            }
          />
        </Card>
        <TransferForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      </>
    )
  }

  const enriched = data.transfers
    .map((t) => ({ ...t, days: daysUntil(t.expiryDate), remaining: remainingTransfers(t) }))
    .sort((a, b) => a.days - b.days)

  const active = enriched.filter((t) => t.remaining > 0)
  const expiringSoon = active.filter((t) => t.days <= SOON_THRESHOLD)
  const monthlyOutflow = active.reduce((sum, t) => sum + estMonthly(t), 0)

  return (
    <>
      <PageHeader
        eyebrow="Schedules"
        title="Auto Transfers"
        subtitle="Recurring outgoing transfers and when they wind down."
        action={<AddButton onClick={openAdd} label="Add transfer" />}
      />

      {/* 3-Card Responsive Top Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Schedules */}
        <Card className="animate-rise p-4 text-center">
          <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Active Schedules</span>
          <p className="mt-1 font-display text-[26px] font-extrabold tnum text-ink leading-tight">
            {active.length}
          </p>
          <span className="mt-0.5 text-[11.5px] text-ink-muted">running recurring transfers</span>
        </Card>

        {/* Monthly Outflow */}
        <Card className="animate-rise p-4 text-center">
          <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Est. Monthly Outflow</span>
          <p className="mt-1 font-display text-[26px] font-extrabold tnum text-brand leading-tight">
            {thb(monthlyOutflow)}
          </p>
          <span className="mt-0.5 text-[11.5px] text-ink-muted">total monthly allocation</span>
        </Card>

        {/* Expiring Soon */}
        <Card className="animate-rise p-4 text-center">
          <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Expiring Soon</span>
          <p className={`mt-1 font-display text-[26px] font-extrabold tnum leading-tight ${expiringSoon.length > 0 ? 'text-warn' : 'text-gain'}`}>
            {expiringSoon.length}
          </p>
          <span className="mt-0.5 text-[11.5px] text-ink-muted">
            {expiringSoon.length > 0 ? `within next ${SOON_THRESHOLD} days` : 'all schedules on track'}
          </span>
        </Card>
      </div>

      {/* Expiring soon warning banner */}
      {expiringSoon.length > 0 && (
        <div className="mt-5 flex items-start gap-3.5 rounded-2xl border border-warn/25 bg-warn-soft px-5 py-4 animate-rise">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn">
            <AlertIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[14.5px] font-bold text-ink">
              {expiringSoon.length} schedule{expiringSoon.length > 1 ? 's' : ''} ending soon
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {expiringSoon.map((t) => t.recipient).join(' · ')}. Review these before your final auto-transfers execute.
            </p>
          </div>
        </div>
      )}

      {/* Transfer List */}
      <div className="mt-5">
        <Card padded={false} className="overflow-hidden animate-rise">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h3 className="font-display text-[16px] font-bold text-ink">
              All Recurring Transfers ({enriched.length})
            </h3>
            <span className="text-[12px] text-ink-muted">Click row to view progress & notes</span>
          </div>
          <ul className="divide-y divide-line">
            {enriched.map((t) => (
              <TransferRow
                key={t.id}
                transfer={t}
                days={t.days}
                onEdit={() => openEdit(t)}
                isExpanded={expandedId === t.id}
                onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
              />
            ))}
          </ul>
        </Card>
      </div>

      <TransferForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
    </>
  )
}

function estMonthly(t: Transfer): number {
  const perMonth: Record<Transfer['frequency'], number> = {
    weekly: 4.33,
    biweekly: 2.17,
    monthly: 1,
    quarterly: 1 / 3,
  }
  return t.amount * perMonth[t.frequency]
}

function TransferRow({
  transfer,
  days,
  onEdit,
  isExpanded,
  onToggle,
}: {
  transfer: Transfer
  days: number
  onEdit: () => void
  isExpanded: boolean
  onToggle: () => void
}) {
  const { removeTransfer } = useData()
  const remaining = remainingTransfers(transfer)
  const progress = transferProgress(transfer)
  const done = remaining === 0
  const soon = !done && days <= SOON_THRESHOLD

  return (
    <li className="overflow-hidden transition-colors hover:bg-surface-muted/50">
      {/* Compact Row Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className={`flex cursor-pointer items-center justify-between gap-3 px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${soon ? 'bg-warn-soft/10' : ''}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{
              color: done ? 'var(--color-gain)' : soon ? 'var(--color-warn)' : 'var(--color-brand)',
              background: `color-mix(in srgb, ${done ? 'var(--color-gain)' : soon ? 'var(--color-warn)' : 'var(--color-brand)'} 12%, transparent)`
            }}
          >
            <TransferIcon className="h-[17px] w-[17px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[14.5px] font-bold text-ink">{transfer.recipient}</p>
              <p className="shrink-0 font-display text-[15px] font-bold tnum text-ink">
                {thb(transfer.amount)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-ink-muted">
                {FREQUENCY_LABEL[transfer.frequency]} · {remaining} remaining
              </p>
              <p className="shrink-0 text-[11.5px] text-ink-muted">
                {done ? 'Complete' : `Expires ${formatDate(transfer.expiryDate)}`}
              </p>
            </div>
            <div className="mt-2.5">
              <ProgressBar
                value={progress}
                color={done ? 'var(--color-gain)' : soon ? 'var(--color-warn)' : 'var(--color-brand)'}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <ChevronIcon open={isExpanded} />
        </div>
      </div>

      {/* Expanded Inline Detail Panel */}
      {isExpanded && (
        <div className="border-t border-line bg-surface-muted px-5 py-4 space-y-4 animate-rise">
          {transfer.note && (
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">Note</p>
              <p className="mt-0.5 text-[13px] text-ink-soft">{transfer.note}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-medium text-ink-soft">
              {transfer.completed} of {transfer.total} sent
            </span>
            <span className="text-ink-faint">·</span>
            <span className="font-semibold text-ink-muted">{progress.toFixed(0)}% completed</span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Status done={done} soon={soon} days={days} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-muted active:scale-95 cursor-pointer"
              >
                <PencilIcon className="h-3.5 w-3.5 text-ink-muted" /> Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Remove support schedule for "${transfer.recipient}"?`)) {
                    removeTransfer(transfer.id)
                  }
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-semibold text-loss transition-colors hover:bg-loss-soft hover:border-loss/30 active:scale-95 cursor-pointer"
              >
                <TrashIcon className="h-3.5 w-3.5 text-loss/70" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function Status({ done, soon, days }: { done: boolean; soon: boolean; days: number }) {
  if (done) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gain-soft px-2.5 py-1 text-[12px] font-semibold text-gain">
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.2} /> Complete
      </span>
    )
  }
  if (soon) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-[12px] font-semibold text-warn">
        <AlertIcon className="h-3.5 w-3.5" /> {days <= 0 ? 'Due now' : `${days}d left`}
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-ink-soft">
      {days}d left
    </span>
  )
}


