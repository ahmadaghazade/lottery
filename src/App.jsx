import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedAdmin from './components/ProtectedAdmin'
import AdminHomePage from './pages/AdminHomePage'
import LoginPage from './pages/LoginPage'
import NewRafflePage from './pages/NewRafflePage'
import PublicLivePage from './pages/PublicLivePage'
import RaffleDrawPage from './pages/RaffleDrawPage'
import RafflePrizesPage from './pages/RafflePrizesPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/live/:raffleId" element={<PublicLivePage />} />
      <Route path="/admin" element={<ProtectedAdmin />}>
        <Route index element={<AdminHomePage />} />
        <Route path="raffles/new" element={<NewRafflePage />} />
        <Route path="raffles/:raffleId/draw" element={<RaffleDrawPage />} />
        <Route path="raffles/:raffleId" element={<RafflePrizesPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
