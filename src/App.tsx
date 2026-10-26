import { Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ScrollToTop } from './components/ScrollToTop'
import { DataProvider, useData } from './store/DataContext'
import { ToastProvider } from './store/ToastContext'
import { ToastContainer } from './components/ui/Toast'
import { useTheme } from './hooks/useTheme'
import { Layout } from './app/Layout'
import { PageErrorBoundary } from './app/PageErrorBoundary'
import { lazyPage } from './lib/lazyPage'
import { Landing } from './app/Landing'
import { Dashboard } from './pages/Dashboard'
import { Portfolio } from './pages/Portfolio'
import { DcaPlanner } from './pages/DcaPlanner'
// Spend Home is where the app opens, so it loads with the app instead of lazily (no skeleton flash)
import { SpendOverview } from './modules/spend/pages/SpendOverview'

const Retirement = lazyPage(() => import('./pages/Retirement').then(m => m.Retirement))
const Settings = lazyPage(() => import('./pages/Settings').then(m => m.Settings))
const HoldingLogs = lazyPage(() => import('./pages/HoldingLogs').then(m => m.HoldingLogs))
const ActivitySummary = lazyPage(() => import('./pages/ActivitySummary').then(m => m.ActivitySummary))
const Rebalance = lazyPage(() => import('./pages/Rebalance').then(m => m.Rebalance))
const Dividends = lazyPage(() => import('./pages/Dividends').then(m => m.Dividends))
const CashLiquidity = lazyPage(() => import('./pages/CashLiquidity').then(m => m.CashLiquidity))
const SpendTransactions = lazyPage(() => import('./modules/spend/pages/SpendTransactions').then(m => m.SpendTransactions))
const SpendRecurringPage = lazyPage(() => import('./modules/spend/pages/SpendRecurring').then(m => m.SpendRecurringPage))
const SpendLoansPage = lazyPage(() => import('./modules/spend/pages/SpendLoans').then(m => m.SpendLoansPage))
const SpendAnalysis = lazyPage(() => import('./modules/spend/pages/SpendAnalysis').then(m => m.SpendAnalysis))
const SpendAccounts = lazyPage(() => import('./modules/spend/pages/SpendAccounts').then(m => m.SpendAccounts))
import { PageSkeleton } from './components/ui/PageSkeleton'
import { Card } from './components/ui/Card'
import { EmptyState } from './components/ui/EmptyState'
import { Button } from './components/ui/Button'
import { settingsPath } from './lib/settingsSections'

function PageLoadingFallback() {
  return <PageSkeleton />
}

const SYNC_PROBLEM_COPY = {
  loadError: {
    title: "Couldn't load your data",
    description: 'Your saved data is safe. We paused saving so nothing gets overwritten. Check your connection and try again.',
    action: 'Try again',
  },
  conflict: {
    title: 'Changed on another device',
    description:
      "Your data was saved from another tab or device after this one opened. We didn't save here, so nothing was overwritten. Load the latest version, then redo your last change.",
    action: 'Load latest',
  },
  slow: {
    title: 'Still loading your data',
    description:
      "This is taking longer than usual. Your saved data is safe: nothing is shown or saved until it arrives. Check your connection, or try again.",
    action: 'Try again',
  },
}

/** Shown when saving is paused (failed or stalled load, or newer data saved elsewhere), so the cloud data stays untouched. */
function SyncProblemScreen({ kind, onRetry }: { kind: keyof typeof SYNC_PROBLEM_COPY; onRetry: () => void }) {
  const copy = SYNC_PROBLEM_COPY[kind]
  return (
    <Card className="mx-auto mt-6 max-w-md animate-rise">
      <EmptyState
        accent="var(--color-loss)"
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        }
        title={copy.title}
        description={copy.description}
        action={<Button onClick={onRetry}>{copy.action}</Button>}
      />
    </Card>
  )
}

/** Old Debts links (bookmarks, ?action=new) land on Spend's loans page with their query intact. */
function LoansRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/spend/loans${search}`} replace />
}

/** Spend's settings joined Settings; old links (and their #section) still land in the right section */
function SpendSettingsRedirect() {
  const { hash } = useLocation()
  return <Navigate to={settingsPath(hash || 'spend')} replace />
}

// 1. สร้าง Component ย่อยด้านในเพื่อแยกเช็คสิทธิ์ผู้ใช้
function AppContent() {
  const { user, dataReady, loadError, syncConflict, retryLoad } = useData()
  const { pathname } = useLocation()

  // Safety net: if the load stalls (silent network), offer a retry after a while instead of a skeleton forever.
  // The pages stay hidden: they'd show empty data, and anything added there would be replaced when the load lands.
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  useEffect(() => {
    setLoadTimedOut(false)
    if (dataReady || !user) return
    const t = window.setTimeout(() => setLoadTimedOut(true), 8000)
    return () => window.clearTimeout(t)
  }, [dataReady, user, loadAttempt])
  const retrySlowLoad = () => {
    setLoadAttempt((n) => n + 1)
    retryLoad()
  }

  if (!user) return <Landing />

  // ถ้าล็อกอินผ่านแล้ว ให้แสดงผลหน้าตาแอปและ Router ปกติ
  return (
    <Layout>
      <ScrollToTop />
      {/* Hold back the pages until the first load finishes, so users never see fake empty states */}
      {loadError || syncConflict ? (
        <SyncProblemScreen kind={loadError ? 'loadError' : 'conflict'} onRetry={retryLoad} />
      ) : !dataReady ? (
        loadTimedOut ? <SyncProblemScreen kind="slow" onRetry={retrySlowLoad} /> : <PageLoadingFallback />
      ) : (
      <PageErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          {/* The app opens on Spend Home (used every day); Invest Home lives at /invest */}
          <Route path="/" element={<SpendOverview />} />
          <Route path="/invest" element={<Dashboard />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/rebalance" element={<Rebalance />} />
          <Route path="/dca" element={<DcaPlanner />} />
          <Route path="/dividends" element={<Dividends />} />
          {/* Debts moved to Spend → Loans & installments */}
          <Route path="/debts" element={<LoansRedirect />} />
          <Route path="/cash" element={<CashLiquidity />} />
          <Route path="/cashflow/cash" element={<CashLiquidity />} />
          <Route path="/cashflow/dca" element={<DcaPlanner />} />
          <Route path="/cashflow/dividends" element={<Dividends />} />
          <Route path="/cashflow/debts" element={<LoansRedirect />} />
          <Route path="/retirement" element={<Retirement />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/:section" element={<Settings />} />
          <Route path="/logs" element={<HoldingLogs />} />
          <Route path="/logs/summary" element={<ActivitySummary />} />
          {/* Spend Home used to be /spend; old links and bookmarks still land */}
          <Route path="/spend" element={<Navigate to="/" replace />} />
          <Route path="/spend/txns" element={<SpendTransactions />} />
          <Route path="/spend/accounts" element={<SpendAccounts />} />
          <Route path="/spend/settings" element={<SpendSettingsRedirect />} />
          <Route path="/spend/analysis" element={<SpendAnalysis />} />
          <Route path="/spend/recurring" element={<SpendRecurringPage />} />
          <Route path="/spend/loans" element={<SpendLoansPage />} />
          <Route path="/spend/wallets" element={<Navigate to="/spend/accounts" replace />} />
          {/* Unknown paths go home, so the Spend/Invest switch matches the page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </PageErrorBoundary>
      )}
    </Layout>
  )
}

// 2. Component หลัก ทำหน้าที่หุ้มตัวแอปด้วย DataProvider
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