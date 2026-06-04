import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import LoginPage       from './pages/LoginPage'
import RegisterPage    from './pages/RegisterPage'
import AdminPanelPage  from './pages/AdminPanelPage'
import AdminPendingPage from './pages/AdminPendingPage'
import AdminUsersPage  from './pages/AdminUsersPage'
import AdminRolesPage  from './pages/AdminRolesPage'

// Redirige al login si no hay sesión
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loading"><span className="spinner" /> Cargando…</div>
  if (!user)   return <Navigate to="/login" replace />
  return children
}

// Redirige al dashboard si no es admin
function RequireAdmin({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loading"><span className="spinner" /> Cargando…</div>
  if (!user)   return <Navigate to="/login" replace />
  if (user.rol !== 'administrador') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="page-loading"><span className="spinner" /> Iniciando…</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login"    element={user ? <Navigate to={user.rol === 'administrador' ? '/admin' : '/dashboard'} replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

        {/* Admin */}
        <Route path="/admin" element={<RequireAdmin><AdminPanelPage /></RequireAdmin>} />
        <Route path="/admin/pending" element={<RequireAdmin><AdminPendingPage /></RequireAdmin>} />
        <Route path="/admin/users"   element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
        <Route path="/admin/roles"   element={<RequireAdmin><AdminRolesPage /></RequireAdmin>} />

        {/* Dashboard (placeholder para la próxima etapa) */}
        <Route path="/dashboard" element={<RequireAuth><div style={{padding:40,color:'#9a9690'}}>Dashboard — próximamente</div></RequireAuth>} />

        {/* Default */}
        <Route path="*" element={<Navigate to={user ? (user.rol === 'administrador' ? '/admin' : '/dashboard') : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}