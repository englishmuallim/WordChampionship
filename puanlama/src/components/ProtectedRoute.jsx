import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Giriş yapılmamışsa giriş sayfasına, rolü uymuyorsa ana sayfaya gönderir.
export default function ProtectedRoute({ roles, children }) {
  const { session, staff, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Yükleniyor…</div>
  }
  if (!session || !staff) return <Navigate to="/giris" replace />
  if (roles && !roles.includes(staff.role)) return <Navigate to="/" replace />
  return children
}
