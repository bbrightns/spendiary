import { useState } from 'react'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressBar } from '../components/ui/ProgressBar'
import { AddButton } from '../components/ui/AddButton'
import { TransferForm } from '../components/forms/TransferForm'
import { AlertIcon, CheckIcon, TransferIcon } from '../components/icons'
import { FREQUENCY_LABEL, remainingTransfers, transferProgress } from '../lib/calc'
import { daysUntil, formatDate, thb } from '../lib/format'
import type { Transfer } from '../lib/types'

const SOON_THRESHOLD = 14

export function AutoTransfers() {
  const { data } = useData()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transfer | null>(null)

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active Schedules"
          value={String(active.length)}
          icon={<TransferIcon className="h-[18px] w-[18px]" />}
          accent="var(--color-stocks)"
          footer={<span className="text-[12.5px] text-ink-muted">currently running</span>}
        />
        <StatCard
          label="Est. Monthly Outflow"
          value={thb(monthlyOutflow)}
          icon={<TransferIcon className="h-[18px] w-[18px]" />}
          accent="var(--color-brand)"
          footer={<span className="text-[12.5px] text-ink-muted">across all schedules</span>}
        />
        <StatCard
          label="Expiring Soon"
          value={String(expiringSoon.length)}
          icon={<AlertIcon className="h-[18px] w-[18px]" />}
          accent={expiringSoon.length > 0 ? 'var(--color-warn)' : 'var(--color-cash)'}
          footer={
            <span className="text-[12.5px] text-ink-muted">within {SOON_THRESHOLD} days</span>
          }
        />
      </div>

      {/* Expiring soon warning banner */}
      {expiringSoon.length > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-card)] border border-warn/25 bg-warn-soft px-5 py-4 animate-rise">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn">
            <AlertIcon className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-ink">
              {expiringSoon.length} schedule{expiringSoon.length > 1 ? 's' : ''} expiring soon
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {expiringSoon.map((t) => t.recipient).join(' · ')}. Review before the final transfer goes out.
            </p>
          </div>
        </div>
      )}

      {/* Transfer cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {enriched.map((t) => (
          <TransferCard key={t.id} transfer={t} days={t.days} onEdit={() => openEdit(t)} />
        ))}
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

function TransferCard({
  transfer,
  days,
  onEdit,
}: {
  transfer: Transfer
  days: number
  onEdit: () => void
}) {
  const remaining = remainingTransfers(transfer)
  const progress = transferProgress(transfer)
  const done = remaining === 0
  const soon = !done && days <= SOON_THRESHOLD

  return (
    <Card
      hover
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit()
        }
      }}
      className={`cursor-pointer animate-rise focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${soon ? 'ring-1 ring-warn/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-[16px] font-bold text-ink">{transfer.recipient}</p>
          {transfer.note && <p className="mt-0.5 text-[12.5px] text-ink-muted">{transfer.note}</p>}
        </div>
        <Status done={done} soon={soon} days={days} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="font-display text-[26px] font-extrabold tracking-tight tnum text-ink">
            {thb(transfer.amount)}
          </p>
          <p className="text-[12.5px] text-ink-muted">{FREQUENCY_LABEL[transfer.frequency]}</p>
        </div>
        <div className="text-right">
          <p className="text-[12.5px] text-ink-muted">Expires</p>
          <p className="text-[13.5px] font-semibold text-ink">{formatDate(transfer.expiryDate)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
          <span className="font-medium text-ink-soft">
            {transfer.completed} of {transfer.total} sent
          </span>
          <span className="font-semibold tnum text-ink-muted">
            {remaining} remaining
          </span>
        </div>
        <ProgressBar
          value={progress}
          color={done ? 'var(--color-gain)' : soon ? 'var(--color-warn)' : 'var(--color-brand)'}
        />
      </div>
    </Card>
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
