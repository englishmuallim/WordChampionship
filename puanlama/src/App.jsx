import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import SeasonsExams from './pages/SeasonsExams'
import Students from './pages/Students'
import StudentImport from './pages/StudentImport'
import ScoreEntry from './pages/ScoreEntry'
import ChangePassword from './pages/ChangePassword'
import Ranking from './pages/Ranking'
import UnitResults from './pages/UnitResults'
import OdevKontrolu from './pages/OdevKontrolu'
import OdevOzeti from './pages/OdevOzeti'

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
      // Puan girişini yönetici de öğretmen de kullanır (rol kısıtı yok; aktif personel olmak yeterli).
      // Öğretmen yalnızca veritabanı kurallarının izin verdiği kademe/şubeleri görür ve yazar.
      {
        path: '/puan-girisi',
        element: (
          <ProtectedRoute>
            <ScoreEntry />
          </ProtectedRoute>
        ),
      },
      // Sıralamayı yönetici de öğretmen de görür (rol kısıtı yok; aktif personel olmak yeterli).
      // Ünite puanları ise veritabanı kurallarıyla öğretmenin yetkili olduğu şubelerle sınırlıdır.
      {
        path: '/siralama',
        element: (
          <ProtectedRoute>
            <Ranking />
          </ProtectedRoute>
        ),
      },
      // Ünite Sonuçları: yönetici de öğretmen de kullanır; veri wc_unit_results ile tüm kademe için gelir (salt okunur).
      {
        path: '/unite-sonuclari',
        element: (
          <ProtectedRoute>
            <UnitResults />
          </ProtectedRoute>
        ),
      },
      // Ödev Kontrolü: yönetici de öğretmen de kullanır. Okuma ve yazma, puan kaydıyla aynı erişim kurallarına (RLS)
      // bağlıdır: öğretmen yalnızca yetkili şubelerinin öğrencileri için yazabilir.
      {
        path: '/odev-kontrolu',
        element: (
          <ProtectedRoute>
            <OdevKontrolu />
          </ProtectedRoute>
        ),
      },
      // Ödev Özeti: yönetici de öğretmen de görür (salt okunur). Veriler erişim kurallarıyla (RLS) süzülür:
      // öğretmen yalnızca yetkili şubelerinin öğrencilerini ve kayıtlarını görür.
      {
        path: '/odev-ozeti',
        element: (
          <ProtectedRoute>
            <OdevOzeti />
          </ProtectedRoute>
        ),
      },
      // Giriş yapan herkes kendi şifresini değiştirebilir.
      {
        path: '/sifre-degistir',
        element: (
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
