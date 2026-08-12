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
import { AutoTransfers } from './pages/AutoTransfers'
import { Retirement } from './pages/Retirement'
import { Settings } from './pages/Settings'
import { HoldingLogs } from './pages/HoldingLogs'

// 💡 1. สร้าง Component ย่อยด้านในเพื่อแยกเช็คสิทธิ์ผู้ใช้
function AppContent() {
  const { user, loginWithGoogle, loginAsGuest, loginAsTestMode, authError } = useData()

  // 💡 ถ้ายังไม่ได้ล็อกอิน ให้บังคับแสดงหน้าจอนี้ ห้ามผ่านเข้าแอปหลัก
  if (!user) {
    return (
      <div className="relative cosmic-nebula flex flex-col items-center justify-center min-h-screen text-slate-100 overflow-hidden font-sans select-none px-4 py-6">
        <style>{`
          .cosmic-nebula {
            background: radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 15% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
                        radial-gradient(circle at 50% 50%, rgba(3, 2, 6, 1) 0%, rgba(10, 8, 20, 1) 100%);
          }
          .ambient-glow-source {
            filter: blur(140px);
          }
          .glass-card-border {
            position: relative;
          }
          .glass-card-border::after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 28px;
            padding: 1px;
            background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(99, 102, 241, 0.2) 70%, rgba(139, 92, 246, 0.4) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
          }
          .solar-glow-center {
            background: radial-gradient(circle at center, rgba(253, 186, 116, 0.95) 0%, rgba(249, 115, 22, 0.6) 45%, rgba(251, 146, 60, 0) 80%);
          }
        `}</style>
        
        {/* Ambient Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] right-[10%] w-[450px] h-[450px] rounded-full bg-indigo-600/15 ambient-glow-source opacity-80 animate-pulse duration-[8s]" />
          <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full bg-purple-600/10 ambient-glow-source opacity-70 animate-pulse duration-[11s]" />
        </div>

        {/* Card */}
        <div className="glass-card-border w-full max-w-[360px] bg-[#0c0a14]/85 shadow-2xl rounded-[28px] p-8 pb-10 transition-all duration-700 backdrop-blur-3xl relative overflow-hidden group z-10">
          {/* Aura inside card */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/20 rounded-full filter blur-[50px] pointer-events-none group-hover:bg-indigo-500/25 transition-all duration-700" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-purple-500/10 rounded-full filter blur-[50px] pointer-events-none" />

          {/* High-tech Icon */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-10 h-10 mb-4 relative flex items-center justify-center">
              <svg className="w-8 h-8 text-white filter drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                <path d="M4 10V4h6M20 14v6h-6M4 14v6h6M20 10V4h-6" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="10" y="10" width="4" height="4" rx="1" fill="currentColor" className="text-indigo-400" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
              Sign in to Spendiary
            </h1>
            <p className="text-slate-400 mt-1 text-xs text-center max-w-[280px]">
              Spend smarter. Live wealthier.
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs leading-relaxed text-center">
              {authError}
            </div>
          )}

          {/* Primary Log In Button with Golden Solar-Flare (mapped to Google Auth) */}
          <div className="relative pt-2 group/btn w-full">
            {/* Solar backlighting element - shows only on hover */}
            <div className="absolute inset-x-4 bottom-2 h-10 solar-glow-center rounded-full opacity-0 group-hover/btn:opacity-95 blur-lg transition-opacity duration-300 pointer-events-none" />
            
            <button 
              onClick={loginWithGoogle}
              className="w-full relative py-3.5 bg-white hover:bg-slate-50 text-slate-950 font-bold rounded-full shadow-md active:scale-[0.98] transition-all duration-300 text-xs tracking-widest uppercase flex items-center justify-center overflow-hidden cursor-pointer"
            >
              <svg className="w-4 h-4 mr-2.5 relative z-10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span className="relative z-10">Sign in with Google</span>
            </button>
          </div>

          <div className="mt-3 w-full">
            <button
              onClick={loginAsGuest}
              className="w-full py-3 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-200 font-semibold rounded-full shadow transition-all duration-300 text-xs flex items-center justify-center cursor-pointer"
            >
              <svg className="w-4 h-4 mr-2 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              เข้าใช้งานแบบ Guest / Local Mode
            </button>
          </div>
          
          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center text-[10px] text-slate-500 font-medium">
            <span className="flex items-center text-slate-400">
              <svg className="w-3.5 h-3.5 mr-1 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Secure Cloud Synchronization
            </span>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full text-center mt-6 text-[10.5px] text-slate-500 z-10 font-medium tracking-wide flex flex-col items-center gap-1.5">
          <div>© 2026 Spendiary by bbrightns. Every choice shapes your wealth.</div>
          <div>
            <button
              type="button"
              onClick={loginAsTestMode}
              className="text-slate-500 hover:text-indigo-400 transition-colors underline underline-offset-2 cursor-pointer font-medium text-[10.5px]"
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
        <Route path="/transfers" element={<AutoTransfers />} />
        <Route path="/retirement" element={<Retirement />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/logs" element={<HoldingLogs />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  )
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