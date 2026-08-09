import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import NavBar from './components/NavBar'
import LoginPage from './pages/LoginPage'
import TodayPage from './pages/TodayPage'
import LeaderboardPage from './pages/LeaderboardPage'

function ProtectedLayout({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return <div className="centered-message">Loading…</div>
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="app-shell">
      <main className="app-content">{children}</main>
      <NavBar />
    </div>
  )
}

function AppRoutes() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && session ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedLayout>
            <TodayPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedLayout>
            <LeaderboardPage />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
