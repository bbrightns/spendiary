import { useData } from '../../store/DataContext'
import { FlaskIcon, LogOutIcon } from '../icons'

export function TestModeBanner() {
  const { user, logout } = useData()
  const isTestMode = user?.id === 'test-user-local'

  if (!isTestMode) return null

  return (
    <aside
      aria-label="Test Mode Environment Warning"
      className="fixed top-0 inset-x-0 z-50 h-9 bg-amber-400 dark:bg-amber-500 text-amber-950 px-3 sm:px-4 flex items-center justify-between shadow-xs select-none border-b border-amber-500/40 dark:border-amber-600/50 box-border"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-950/15 shrink-0 text-amber-950">
          <FlaskIcon className="w-3.5 h-3.5" />
        </span>
        <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-amber-950/15 text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-amber-950 leading-none shrink-0">
          Test Mode
        </span>
        <span className="hidden sm:inline font-medium text-amber-950/90 text-[11.5px] sm:text-[12px] leading-none truncate">
          Sandbox environment — Simulated mock data, changes will not affect real accounts
        </span>
        <span className="sm:hidden font-medium text-amber-950/90 text-[11.5px] sm:text-[12px] leading-none truncate">
          Mock data only, changes are not saved
        </span>
      </div>

      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center justify-center gap-1.5 shrink-0 h-[26px] px-2.5 rounded-md text-[11px] sm:text-[11.5px] font-bold leading-none bg-amber-950/15 hover:bg-amber-950/25 active:scale-95 text-amber-950 border border-amber-950/20 transition-all cursor-pointer"
        title="Exit test mode and return to sign in"
      >
        <LogOutIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline leading-none">Exit Test Mode</span>
        <span className="sm:hidden leading-none">Exit</span>
      </button>
    </aside>
  )
}
