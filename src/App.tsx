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

  // 💡 ถ้ายังไม่ได้ล็อกอิน ให้แสดงหน้าจอ Sign In ธีม Fastwork.com
  if (!user) {
    return (
      <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden font-sans select-none text-slate-900 bg-[#faf6f4]">
        <style>{`
          .fastwork-canvas {
            background-color: #faf6f4;
            background-image: 
              radial-gradient(circle at 10% 12%, rgba(254, 243, 199, 0.75) 0%, rgba(255, 248, 235, 0.9) 30%, transparent 60%),
              radial-gradient(circle at 90% 88%, rgba(239, 229, 232, 0.85) 0%, rgba(243, 232, 255, 0.6) 35%, transparent 65%),
              linear-gradient(135deg, #fff3dd 0%, #faf6f4 45%, #efe5e8 100%);
            background-attachment: fixed;
          }
        `}</style>

        {/* Ambient Glows */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden fastwork-canvas" />

        {/* ── Top Header / Navbar ── */}
        <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 sm:py-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0066FF] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="font-display font-extrabold text-[21px] tracking-tight text-slate-900">
              spendiary
            </span>
          </div>

          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-full px-3.5 py-1.5 shadow-xs text-xs font-semibold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Smart Wealth · 2026 Edition</span>
          </div>
        </header>

        {/* ── Main Content / Hero + Features + Sign In ── */}
        <main className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-2 pb-12 flex flex-col items-center">
          {/* Center Announcement Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/85 border border-slate-200/80 shadow-xs text-xs font-medium text-slate-700 mb-6">
            <span className="text-[#0066FF] font-bold">✦</span>
            <span>The intelligent personal wealth cockpit</span>
          </div>

          {/* Hero Headline */}
          <h1 className="font-display font-black text-4xl sm:text-5xl md:text-6xl text-slate-950 text-center tracking-tight leading-[1.12] max-w-2xl mb-4">
            Spend smarter.{' '}
            <span 
              className="block mt-1 sm:mt-2 italic font-black bg-clip-text text-transparent bg-gradient-to-l from-[#405DFF] to-[#DFAA41]"
              style={{
                backgroundImage: 'linear-gradient(to left, #405DFF 0%, #DFAA41 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Now live wealthier.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-600 text-sm sm:text-base text-center max-w-xl leading-relaxed mb-8">
            An intelligent personal wealth manager reinventing how you track portfolio assets, optimize DCA targets, and plan financial freedom.
          </p>

          {/* ── Sign In Action Box (Centered directly in the middle) ── */}
          <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[24px] border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.06)] p-7 sm:p-8 mb-12">
            <div className="text-center mb-6">
              <h2 className="font-display font-extrabold text-xl text-slate-900 tracking-tight">
                Sign in to Spendiary
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Choose your preferred sign-in method to continue
              </p>
            </div>

            {authError && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs leading-relaxed text-center font-medium">
                {authError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {/* Google Sign In */}
              <button
                type="button"
                onClick={loginWithGoogle}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 font-bold rounded-full shadow-xs hover:shadow transition-all duration-200 text-xs tracking-wider uppercase flex items-center justify-center gap-3 cursor-pointer"
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

            {/* Test Mode */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={loginAsTestMode}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#0066FF] text-xs font-semibold transition-colors py-1 cursor-pointer"
              >
                <span>✨</span>
                <span className="underline underline-offset-2">ทดลองใช้งานโหมดตัวอย่าง (Test Mode)</span>
              </button>
            </div>

            {/* Security Assurance Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1.5 text-slate-500">
                <svg className="w-3.5 h-3.5 text-[#0066FF]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Secure Cloud Synchronization · 100% Client Privacy
              </span>
            </div>
          </div>

          {/* ── 3 Feature Cards (Fastwork 3-Column Style - Placed Below Sign In) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {/* Card 1 */}
            <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center mb-3.5 font-bold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-slate-900 text-sm mb-1.5">
                Bank-grade Privacy
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Your financial records stay local on your device or encrypted with secure Supabase cloud sync.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3.5 font-bold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-slate-900 text-sm mb-1.5">
                Smart Portfolio & DCA
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Track stocks, crypto, funds, and gold with automated rebalancing & smart buy notifications.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3.5 font-bold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-slate-900 text-sm mb-1.5">
                Retirement Freedom
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Simulate FIRE milestones, calculate dividend yields, and plan early financial freedom.
              </p>
            </div>
          </div>
        </main>

        {/* ── Footer ── */}
        <footer className="relative z-10 w-full text-center py-6 text-xs text-slate-500 font-medium border-t border-slate-200/50 bg-white/40 backdrop-blur-sm">
          © 2026 Spendiary by bbrightns. Every choice shapes your wealth.
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