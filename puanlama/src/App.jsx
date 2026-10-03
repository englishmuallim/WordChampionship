import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import SeasonsExams from './pages/SeasonsExams'
import Students from './pages/Students'
import StudentImport from './pages/StudentImport'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/giris" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sezon-sinavlar"
            element={
              <ProtectedRoute roles={['admin']}>
                <SeasonsExams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ogrenciler"
            element={
              <ProtectedRoute roles={['admin']}>
                <Students />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ogrenciler/ice-aktar"
            element={
              <ProtectedRoute roles={['admin']}>
                <StudentImport />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
