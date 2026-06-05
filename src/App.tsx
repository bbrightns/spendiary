import { Route, Routes } from 'react-router-dom'
import { DataProvider } from './store/DataContext'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Portfolio } from './pages/Portfolio'
import { DcaPlanner } from './pages/DcaPlanner'
import { AutoTransfers } from './pages/AutoTransfers'
import { Retirement } from './pages/Retirement'
import { Settings } from './pages/Settings'
import { HoldingLogs } from './pages/HoldingLogs'

export default function App() {
  return (
    <DataProvider>
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
    </DataProvider>
  )
}
