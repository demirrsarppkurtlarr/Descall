import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useHaptic } from '../hooks/useMobile'

function InputField({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          marginTop: 6,
          padding: '14px 16px',
          background: 'var(--bg-elevated)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: 16,
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  )
}

export function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const haptic = useHaptic()

  const handleSubmit = async () => {
    if (!username || !password) { setError('Fill in all fields'); return }
    setLoading(true)
    setError('')
    try {
      await login(username, password)
      haptic.success()
      navigate('/channels')
    } catch (e) {
      haptic.error()
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      paddingTop: 'var(--sat)',
      paddingBottom: 'var(--sab)',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed',
        top: -100,
        right: -100,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,92,252,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 24px',
        maxWidth: 440,
        margin: '0 auto',
        width: '100%',
      }}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            background: 'linear-gradient(135deg, var(--accent), #c084fc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            fontWeight: 800,
            color: '#fff',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(124,92,252,0.4)',
          }}>
            D
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 15 }}>
            Sign in to your Descall account
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <InputField
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="your_username"
            autoComplete="username"
          />
          <InputField
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: 'rgba(231,76,60,0.15)',
                border: '1px solid rgba(231,76,60,0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--danger)',
              }}
            >
              {error}
            </motion.div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--accent), #9370ff)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: loading ? 'var(--text-muted)' : '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: loading ? 'none' : '0 4px 20px rgba(124,92,252,0.4)',
            }}
          >
            {loading ? (
              <div style={{
                width: 20,
                height: 20,
                border: '2px solid var(--text-muted)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }} />
            ) : 'Sign In'}
          </motion.button>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Register
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export function RegisterScreen() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const haptic = useHaptic()

  const handleSubmit = async () => {
    if (!username || !password) { setError('Fill in all required fields'); return }
    setLoading(true)
    setError('')
    try {
      await register(username, password, displayName)
      haptic.success()
      navigate('/channels')
    } catch (e) {
      haptic.error()
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      paddingTop: 'var(--sat)',
      paddingBottom: 'var(--sab)',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 24px',
        maxWidth: 440,
        margin: '0 auto',
        width: '100%',
      }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 40 }}
        >
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            background: 'linear-gradient(135deg, var(--accent), #c084fc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            fontWeight: 800,
            color: '#fff',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(124,92,252,0.4)',
          }}>D</div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Create account</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Join the Descall community</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <InputField label="Username *" value={username} onChange={e => setUsername(e.target.value)} placeholder="cool_username" autoComplete="username" />
          <InputField label="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Cool Name" autoComplete="name" />
          <InputField label="Password *" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />

          {error && (
            <div style={{
              background: 'rgba(231,76,60,0.15)',
              border: '1px solid rgba(231,76,60,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--danger)',
            }}>{error}</div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: 16,
              background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--accent), #9370ff)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: loading ? 'var(--text-muted)' : '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              marginTop: 8,
              boxShadow: loading ? 'none' : '0 4px 20px rgba(124,92,252,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? (
              <div style={{
                width: 20,
                height: 20,
                border: '2px solid var(--text-muted)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }} />
            ) : 'Create Account'}
          </motion.button>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
