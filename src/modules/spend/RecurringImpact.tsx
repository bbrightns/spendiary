import type { RecurringUse } from './accountRemoval'

/**
 * Inside a delete confirm: which recurring items use the wallet or card, and what happens to them.
 * Renders nothing when none do.
 */
export function RecurringImpact({ uses, name, undoable }: { uses: RecurringUse[]; name: string; undoable?: boolean }) {
  if (uses.length === 0) return null
  return (
    <div className="rounded-2xl bg-surface-muted p-4">
      <p className="text-sm font-bold text-ink">
        Used by {uses.length} recurring {uses.length === 1 ? 'item' : 'items'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {uses.map(({ rec, role }) => (
          <li key={rec.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-ink-soft">{rec.name}</span>
            <span className="shrink-0 text-xs text-ink-muted">{role}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        {uses.length === 1 ? 'It will be paused' : 'They will be paused'} until you pick another account. Past transactions stay and still show "{name}".
        {undoable && ' Undo it in Activity Logs to bring everything back.'}
      </p>
    </div>
  )
}
