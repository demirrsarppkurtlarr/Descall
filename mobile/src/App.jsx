import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import MobileLayout from './components/mobile/MobileLayout'
import { useSocket } from './hooks/useSocket'
import './styles/global.css'

// Lazy-loaded pages for code splitting
const LoginScreen    = lazy(() => import('./pages/AuthScreens').then(m => ({ default: m.LoginScreen })))
const RegisterScreen = lazy(() => import('./pages/AuthScreens').then(m => ({ default: m.RegisterScreen })))
const ChannelList    = lazy(() => import('./pages/ChannelList'))
const ChatScreen     = lazy(() => import('./pages/ChatScreen'))
const DMList         = lazy(() => import('./pages/DMList'))
const DMScreen       = lazy(() => import('./pages/DMScreen'))
const AdminPanel     = lazy(() => import('./pages/AdminPanel'))
const ExplorePage    = lazy(() => import('./pages/ExplorePage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ProfilePage    = lazy(() => import('./pages/ProfileSettings').then(m => ({ default: m.ProfilePage })))
const SettingsPage   = lazy(() => import('./pages/ProfileSettings').then(m => ({ default: m.SettingsPage })))

function SplashScreen() {
  return (
    <div style={{
      height: '100dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-primary)',
      flexDirection: 'column', gap: 20,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: 'linear-gradient(135deg, #7c5cfc, #c084fc)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, fontWeight: 800, color: '#fff',
        boxShadow: '0 0 40px rgba(124,92,252,0.5)',
        animation: 'pulse 2s ease-in-out infinite',
      }}>D</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)', opacity: 0.5,
            animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

function ProtectedLayout() {
  const { user, token, loading } = useAuth()
  const { connected, reconnecting } = useSocket(token)

  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace />

  return <MobileLayout connected={connected} reconnecting={reconnecting} />
}

function AppRoutes() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/channels" replace />} />
          <Route path="/channels" element={<ChannelList />} />
          <Route path="/channels/:channelId" element={<ChatScreen />} />
          <Route path="/dm" element={<DMList />} />
          <Route path="/dm/:dmId" element={<DMScreen />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
