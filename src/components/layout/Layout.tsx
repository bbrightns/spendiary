import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { SettingsIcon, SparkleIcon } from '../icons'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar />

      {/* Mobile top brand bar */}
      <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-canvas/80 px-5 py-3.5 backdrop-blur-xl lg:hidden">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white">
          <SparkleIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>
        <p className="flex-1 font-display text-[17px] font-extrabold tracking-tight text-ink">Spendiary</p>
        <NavLink
          to="/settings"
          aria-label="Settings"
          className={({ isActive }) =>
            `grid h-9 w-9 place-items-center rounded-xl transition-colors ${
              isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
            }`
          }
        >
          <SettingsIcon className="h-[19px] w-[19px]" />
        </NavLink>
      </div>

      <main className="lg:pl-[252px]">
        <div className="mx-auto w-full max-w-[1080px] px-5 pb-28 pt-6 sm:px-8 sm:pt-10 lg:pb-14">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
