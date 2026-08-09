import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOut } from '../lib/auth'

export default function NavBar() {
  const { profile } = useAuth()

  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
        <span className="nav-icon">✅</span>
        Today
      </NavLink>
      <NavLink to="/leaderboard" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
        <span className="nav-icon">🏆</span>
        Leaderboard
      </NavLink>
      <button type="button" className="nav-link nav-signout" onClick={() => signOut()}>
        <span className="nav-icon">👋</span>
        {profile?.name ?? 'Sign out'}
      </button>
    </nav>
  )
}
