import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ScrollToTop } from './components/ScrollToTop'
import { DataProvider, useData } from './store/DataContext'
import { ToastProvider } from './store/ToastContext'
import { ToastContainer } from './components/ui/Toast'
import { useTheme } from './hooks/useTheme'
import { Layout } from './components/layout/Layout'
import { Footer } from './components/layout/Footer'
import { Dashboard } from './pages/Dashboard'
import { Portfolio } from './pages/Portfolio'
import { DcaPlanner } from './pages/DcaPlanner'

const Retirement = lazy(() => import('./pages/Retirement').then(m => ({ default: m.Retirement })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
const HoldingLogs = lazy(() => import('./pages/HoldingLogs').then(m => ({ default: m.HoldingLogs })))
const Rebalance = lazy(() => import('./pages/Rebalance').then(m => ({ default: m.Rebalance })))
const Dividends = lazy(() => import('./pages/Dividends').then(m => ({ default: m.Dividends })))
const Debts = lazy(() => import('./pages/Debts').then(m => ({ default: m.Debts })))
const CashLiquidity = lazy(() => import('./pages/CashLiquidity').then(m => ({ default: m.CashLiquidity })))

function PageLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  )
}

// 💡 1. สร้าง Component ย่อยด้านในเพื่อแยกเช็คสิทธิ์ผู้ใช้
function AppContent() {
  const { user, loginWithGoogle, loginAsTestMode, authError } = useData()

  // 💡 ถ้ายังไม่ได้ล็อกอิน ให้แสดงหน้าจอ Sign In ธีม Fastwork.com
  if (!user) {
    return (
      <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden font-sans select-none text-slate-900 bg-[#faf6f4]">
        <style>{`
          .fastwork-canvas {
            background-color: #faf6f4;
            background-image: 
              radial-gradient(circle at 85% 18%, rgba(237, 233, 254, 0.8) 0%, transparent 50%),
              radial-gradient(circle at 10% 12%, rgba(254, 243, 199, 0.85) 0%, rgba(255, 248, 235, 0.9) 30%, transparent 60%),
              radial-gradient(circle at 90% 88%, rgba(239, 229, 232, 0.85) 0%, rgba(243, 232, 255, 0.6) 35%, transparent 65%),
              linear-gradient(135deg, #fff3dd 0%, #faf6f4 45%, #efe5e8 100%);
            background-attachment: fixed;
          }
        `}</style>

        {/* Ambient Glows */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden fastwork-canvas" />

        {/* ── Top Header / Navbar ── */}
        <header className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-8 py-5 sm:py-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <img src="/logo.png" alt="Spendiary Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0" />
            <span className="font-display font-extrabold sm:font-black text-[22px] sm:text-[25px] tracking-tight leading-none text-slate-900">
              spendiary
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/85 backdrop-blur-md border border-slate-200/80 rounded-full px-3 py-1 sm:px-3.5 sm:py-1.5 shadow-xs text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="sm:hidden">2026 Edition</span>
            <span className="hidden sm:inline">Smart Wealth · 2026 Edition</span>
          </div>
        </header>

        {/* ── Main Content / Hero + Features + Sign In ── */}
        <main className="relative z-10 w-full max-w-4xl mx-auto px-6 sm:px-8 pt-2 sm:pt-4 pb-12 sm:pb-16 flex flex-col items-center">
          {/* Center Announcement Pill */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full bg-white/85 border border-slate-200/80 shadow-xs text-[11px] sm:text-xs font-medium text-slate-700 mb-4 sm:mb-6 text-center">
            <span className="text-[#0066FF] font-bold">✦</span>
            <span>The intelligent personal wealth cockpit</span>
          </div>

          {/* Hero Headline */}
          <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-slate-950 text-center tracking-tight leading-[1.15] max-w-2xl mb-3 sm:mb-4 px-2 text-balance">
            Spend smarter.{' '}
            <span className="block mt-1 sm:mt-2 font-black text-brand tracking-tight">
              Now live wealthier.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-600 text-xs sm:text-base text-center max-w-[340px] sm:max-w-xl leading-relaxed mb-6 sm:mb-8 px-2 text-pretty">
            An intelligent personal wealth manager reinventing how you track portfolio assets, optimize DCA targets, and plan financial freedom.
          </p>

          {/* ── Sign In Action Box (Centered directly in the middle) ── */}
          <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[22px] sm:rounded-[24px] border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.06)] p-5 sm:p-8 mb-8 sm:mb-12">
            <div className="text-center mb-5 sm:mb-6">
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                Welcome to Spendiary
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Your private dashboard for wealth and investments
              </p>
            </div>

            {authError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 text-center">
                {authError}
              </div>
            )}

            {/* 1. Google Sign-In Button */}
            <button
              onClick={loginWithGoogle}
              className="w-full h-11 sm:h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
            >
              <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-3 sm:my-3.5">
              <div className="h-px flex-1 bg-slate-200/80" />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">or</span>
              <div className="h-px flex-1 bg-slate-200/80" />
            </div>

            {/* 2. Test / Offline Mode */}
            <button
              onClick={loginAsTestMode}
              className="w-full h-11 sm:h-12 bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm border border-slate-200/60 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Explore Demo / Offline Mode</span>
            </button>

            {/* Trust badge under sign-in */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <span className="inline-flex items-center gap-1.5 text-center">
                <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="sm:hidden">Secure Cloud Sync · 100% Client Privacy</span>
                <span className="hidden sm:inline">Secure Cloud Synchronization · 100% Client Privacy</span>
              </span>
            </div>
          </div>

          {/* ── 3 Feature Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 w-full max-w-md md:max-w-4xl">
            {/* Card 1 */}
            <div className="bg-white/75 hover:bg-white/90 backdrop-blur-md rounded-[20px] border border-white/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 bg-blue-50 text-blue-600 border border-blue-100/80 shadow-xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-slate-800 text-[14.5px] leading-tight mb-1">
                  Bank-grade Privacy
                </h3>
                <p className="text-slate-500 text-[12.5px] leading-relaxed">
                  Your financial records stay local on your device or encrypted with secure Supabase cloud sync.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white/75 hover:bg-white/90 backdrop-blur-md rounded-[20px] border border-white/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600 border border-indigo-100/80 shadow-xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-slate-800 text-[14.5px] leading-tight mb-1">
                  Smart Portfolio & DCA
                </h3>
                <p className="text-slate-500 text-[12.5px] leading-relaxed">
                  Track stocks, crypto, funds, and gold with automated rebalancing & smart buy notifications.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white/75 hover:bg-white/90 backdrop-blur-md rounded-[20px] border border-white/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 bg-violet-50 text-violet-600 border border-violet-100/80 shadow-xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-slate-800 text-[14.5px] leading-tight mb-1">
                  Retirement Freedom
                </h3>
                <p className="text-slate-500 text-[12.5px] leading-relaxed">
                  Simulate FIRE milestones, calculate dividend yields, and plan early financial freedom.
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* ── Footer ── */}
        <div className="relative z-10 w-full mt-6 px-6 sm:px-8">
          <div className="max-w-md md:max-w-4xl mx-auto">
            <Footer className="mt-0 pt-7 pb-9" lightOnly />
          </div>
        </div>
      </div>
    )
  }

  // 💡 ถ้าล็อกอินผ่านแล้ว ให้แสดงผลหน้าตาแอปและ Router ปกติ
  return (
    <Layout>
      <ScrollToTop />
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/rebalance" element={<Rebalance />} />
          <Route path="/dca" element={<DcaPlanner />} />
          <Route path="/dividends" element={<Dividends />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/cash" element={<CashLiquidity />} />
          <Route path="/cashflow/cash" element={<CashLiquidity />} />
          <Route path="/cashflow/dca" element={<DcaPlanner />} />
          <Route path="/cashflow/dividends" element={<Dividends />} />
          <Route path="/cashflow/debts" element={<Debts />} />
          <Route path="/retirement" element={<Retirement />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<HoldingLogs />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Suspense>
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