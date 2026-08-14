import { Route, Routes } from 'react-router-dom'
import { ScrollToTop } from './components/ScrollToTop'
import { DataProvider, useData } from './store/DataContext' // 💡 เพิ่ม useData เข้ามา
import { ToastProvider } from './store/ToastContext'
import { ToastContainer } from './components/ui/Toast'
import { useTheme } from './hooks/useTheme'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Portfolio } from './pages/Portfolio'
import { DcaPlanner } from './pages/DcaPlanner'
import { Retirement } from './pages/Retirement'
import { Settings } from './pages/Settings'
import { HoldingLogs } from './pages/HoldingLogs'

// 💡 1. สร้าง Component ย่อยด้านในเพื่อแยกเช็คสิทธิ์ผู้ใช้
function AppContent() {
  const { user, loginWithGoogle, loginAsGuest, loginAsTestMode, authError } = useData()

  // 💡 ถ้ายังไม่ได้ล็อกอิน ให้แสดงหน้าจอ Sign In ตรงกลางหน้าจอ เด่นชัด สไตล์ Fastwork.com
  if (!user) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-sans select-none text-slate-900 bg-[#faf6f4] px-4 py-8">
        <style>{`
          .fastwork-canvas {
            background-color: #faf6f4;
            background-image: 
              radial-gradient(circle at 12% 15%, rgba(254, 243, 199, 0.8) 0%, rgba(255, 248, 235, 0.95) 30%, transparent 60%),
              radial-gradient(circle at 88% 85%, rgba(239, 229, 232, 0.9) 0%, rgba(243, 232, 255, 0.7) 35%, transparent 65%),
              linear-gradient(135deg, #fff3dd 0%, #faf6f4 45%, #efe5e8 100%);
            background-attachment: fixed;
          }
        `}</style>

        {/* Ambient Glows */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden fastwork-canvas" />

        {/* Top Floating Pill Badge */}
        <div className="relative z-10 mb-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-slate-200/80 shadow-xs text-xs font-semibold text-slate-700 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Smart Wealth Cockpit · 2026 Edition</span>
        </div>

        {/* ── Main Centered Sign-In Card (เด่นสุด กลางหน้าจอ) ── */}
        <div className="relative z-10 w-full max-w-[390px] bg-white/95 backdrop-blur-2xl rounded-[28px] border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.08),0_1px_3px_rgba(0,0,0,0.04)] p-8 sm:p-9 transition-all duration-300">
          {/* Fastwork Brand Icon */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-13 h-13 rounded-2xl bg-[#0066FF] text-white flex items-center justify-center shadow-lg shadow-blue-500/25 mb-3.5 transition-transform hover:scale-105">
              <svg className="w-6.5 h-6.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display text-center">
              Sign In to Spendiary
            </h1>
            <p className="text-slate-500 mt-1.5 text-xs text-center">
              Spend smarter.{' '}
              <span className="text-[#0066FF] font-extrabold italic">
                Live wealthier.
              </span>
            </p>

            {/* Feature Micro-Chips */}
            <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500 font-medium">
              <span className="px-2 py-0.5 rounded-full bg-slate-100/90 border border-slate-200/60">🛡️ Private</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100/90 border border-slate-200/60">⚡ Smart DCA</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100/90 border border-slate-200/60">🎯 FIRE</span>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs leading-relaxed text-center font-medium">
              {authError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full">
            {/* Google Sign In */}
            <button 
              type="button"
              onClick={loginWithGoogle}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 font-bold rounded-full shadow-xs hover:shadow-md active:scale-[0.99] transition-all duration-200 text-xs tracking-wider uppercase flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Sign in with Google</span>
            </button>

            {/* Guest / Local Mode */}
            <button
              type="button"
              onClick={loginAsGuest}
              className="w-full py-3.5 px-4 bg-[#0066FF] hover:bg-[#0052cc] text-white font-bold rounded-full shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all duration-200 text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4 text-blue-100" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>เข้าใช้งานแบบ Guest / Local Mode</span>
            </button>
          </div>

          {/* Security Assurance Indicator */}
          <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-center text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 text-slate-500">
              <svg className="w-3.5 h-3.5 text-[#0066FF]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Secure Cloud Synchronization · 100% Privacy
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="relative z-10 text-center mt-6 text-xs text-slate-500 font-medium tracking-wide flex flex-col items-center gap-1.5">
          <div>© 2026 Spendiary by bbrightns. Every choice shapes your wealth.</div>
          <div>
            <button
              type="button"
              onClick={loginAsTestMode}
              className="text-slate-500 hover:text-[#0066FF] transition-colors underline underline-offset-2 cursor-pointer font-medium text-xs"
            >
              Test Mode
            </button>
          </div>
        </footer>
      </div>
    )
  }

  // 💡 ถ้าล็อกอินผ่านแล้ว ให้แสดงผลหน้าตาแอปและ Router ปกติ
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/dca" element={<DcaPlanner />} />
        <Route path="/retirement" element={<Retirement />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/logs" element={<HoldingLogs />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  )
}

// 💡 2. Component หลัก ทำหน้าที่หุ้มตัวแอปด้วย DataProvider
export default function App() {
  useTheme() // initializes + syncs theme to <html> class

  return (
    <DataProvider>
      <ToastProvider>
        <AppContent />
        <ToastContainer />
      </ToastProvider>
    </DataProvider>
  )
}