import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import SeasonsExams from './pages/SeasonsExams'
import Students from './pages/Students'
import StudentImport from './pages/StudentImport'
import ScoreEntry from './pages/ScoreEntry'

// Tüm sayfaları saran kök: oturum bilgisi her sayfada kullanılabilir.
function Kok() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

// Yalnızca yönetici için sayfa
const yonetici = (sayfa) => <ProtectedRoute roles={['admin']}>{sayfa}</ProtectedRoute>

// useBlocker (kaydedilmemiş değişiklik uyarısı) için "veri yönlendiricisi" kullanılıyor.
const router = createBrowserRouter([
  {
    element: <Kok />,
    children: [
      { path: '/giris', element: <Login /> },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        ),
      },
      { path: '/sezon-sinavlar', element: yonetici(<SeasonsExams />) },
      { path: '/ogrenciler', element: yonetici(<Students />) },
      { path: '/ogrenciler/ice-aktar', element: yonetici(<StudentImport />) },
      // Şimdilik yalnızca yönetici. Öğretmene açmak için roles={['admin', 'teacher']} yapılır
      // (ve Home.jsx'te menü satırı güncellenir); veritabanı kuralları öğretmeni zaten şubeyle sınırlar.
      { path: '/puan-girisi', element: yonetici(<ScoreEntry />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
