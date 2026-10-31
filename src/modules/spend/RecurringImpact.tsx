import type { OtherUse, RecurringUse } from './accountRemoval'

/**
 * Inside a delete confirm: what uses the wallet or card, and what happens to each.
 * Recurring items pause; DCA plans, loans and holdings ask for another account next time.
 * Renders nothing when nothing uses it.
 */
export function RecurringImpact({ uses, others = [], name, undoable }: { uses: RecurringUse[]; others?: OtherUse[]; name: string; undoable?: boolean }) {
  if (uses.length === 0 && others.length === 0) return null
  const rows = [...uses.map(({ rec, role }) => ({ id: rec.id, label: rec.name, role })), ...others]
  return (
    <div className="rounded-2xl bg-surface-muted p-4">
      <p className="text-sm font-bold text-ink">
        Used by {rows.length} {rows.length === 1 ? 'item' : 'items'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-ink-soft">{r.label}</span>
            <span className="shrink-0 text-xs text-ink-muted">{r.role}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        {uses.length > 0 && 'Recurring items will be paused until you pick another account. '}
        {others.length > 0 && 'DCA plans, loans and holdings will ask for another account the next time you use them. '}
        Past transactions stay and still show "{name}".
        {undoable && ' Undo it in Invest → Trades to bring everything back.'}
      </p>
    </div>
  )
}
