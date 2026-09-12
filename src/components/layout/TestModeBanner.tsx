import { useData } from '../../store/DataContext'
import { FlaskIcon, LogOutIcon } from '../icons'

export function TestModeBanner() {
  const { user, logout } = useData()
  const isTestMode = user?.id === 'test-user-local'

  if (!isTestMode) return null

  return (
    <aside
      aria-label="Test Mode Environment Warning"
      className="fixed top-0 inset-x-0 z-50 h-9 bg-amber-400 dark:bg-amber-500 text-amber-950 px-3 sm:px-4 flex items-center justify-between shadow-xs select-none border-b border-amber-500/40 dark:border-amber-600/50"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-950/15 shrink-0 text-amber-950">
          <FlaskIcon className="w-3.5 h-3.5" />
        </span>
        <div className="flex items-center gap-2 text-[11.5px] sm:text-[12px] font-bold tracking-tight truncate">
          <span className="uppercase tracking-wider font-black text-[10px] sm:text-[10.5px] bg-amber-950/15 px-1.5 py-0.5 rounded shrink-0">
            Test Mode
          </span>
          <span className="hidden sm:inline font-medium text-amber-950/90 truncate">
            คุณกำลังอยู่ในโหมดทดสอบ — ข้อมูลจำลองจะไม่ถูกบันทึกลงบัญชีจริง
          </span>
          <span className="sm:hidden font-medium text-amber-950/90 truncate">
            ข้อมูลจำลองไม่ถูกบันทึกจริง
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md text-[11px] sm:text-[11.5px] font-bold bg-amber-950/15 hover:bg-amber-950/25 active:scale-95 text-amber-950 border border-amber-950/20 transition-all cursor-pointer"
        title="ออกจากโหมดทดสอบและกลับสู่หน้าหลัก"
      >
        <LogOutIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">ออกจากโหมดทดสอบ</span>
        <span className="sm:hidden">ออก</span>
      </button>
    </aside>
  )
}
