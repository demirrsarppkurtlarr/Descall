import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHaptic } from '../../hooks/useMobile'

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const haptic = useHaptic()

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    const inStandalone = window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem('pwa_install_dismissed')

    if (inStandalone || dismissed) return

    if (ios) {
      setIsIOS(true)
      setTimeout(() => setShow(true), 3000)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setTimeout(() => setShow(true), 2000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    haptic.success()
    if (prompt) {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setShow(false)
    }
  }

  const handleDismiss = () => {
    haptic.tap()
    setShow(false)
    localStorage.setItem('pwa_install_dismissed', '1')
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-height) + var(--sab) + 12px)',
            left: 12,
            right: 12,
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-xl)',
            padding: 16,
            zIndex: 'var(--z-modal)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* App icon */}
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, var(--accent), #c084fc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
            color: '#fff',
            flexShrink: 0,
          }}>
            D
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Install Descall</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {isIOS
                ? 'Tap Share → Add to Home Screen'
                : 'Add to home screen for the best experience'
              }
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            {!isIOS && (
              <button onClick={handleInstall} style={{
                padding: '6px 14px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}>
                Install
              </button>
            )}
            <button onClick={handleDismiss} style={{
              padding: '6px 14px',
              background: 'var(--bg-hover)',
              border: 'none',
              borderRadius: 10,
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}>
              Later
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
