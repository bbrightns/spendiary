import { Route, Routes } from 'react-router-dom'
import { DataProvider, useData } from './store/DataContext' // 💡 เพิ่ม useData เข้ามา
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
  const { user, loginWithGoogle } = useData()

  // 💡 ถ้ายังไม่ได้ล็อกอิน ให้บังคับแสดงหน้าจอนี้ ห้ามผ่านเข้าแอปหลัก
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
        <div className="p-8 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-center max-w-sm w-full border border-gray-100 dark:border-zinc-700">
          <h1 className="text-2xl font-bold mb-1 tracking-tight">Spendiary</h1>
          <p className="text-gray-400 dark:text-zinc-400 mb-6 text-sm">Please sign in to sync your data on Cloud</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full py-2.5 px-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  // 💡 ถ้าล็อกอินผ่านแล้ว ให้แสดงผลหน้าตาแอปและ Router ปกติ
  return (
    <Layout>
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
}

// 💡 2. Component หลัก ทำหน้าที่หุ้มตัวแอปด้วย DataProvider
export default function App() {
  useTheme() // initializes + syncs theme to <html> class

  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  )
}