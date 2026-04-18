import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BottomNav from './BottomNav'
import Drawer from './Drawer'
import InAppNotification from './InAppNotification'
import ConnectionBanner from './ConnectionBanner'
import PWAInstallPrompt from './PWAInstallPrompt'
import { useSwipe } from '../../hooks/useSwipe'
import { useMobile } from '../../hooks/useMobile'
import { useViewport } from '../../hooks/useViewport'
import { useAuth } from '../../contexts/AuthContext'

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  enter: { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }
}

export default function MobileLayout({ connected, reconnecting }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isMobile, isTablet } = useMobile()
  const { keyboardVisible } = useViewport()

  const swipe = useSwipe({
    onSwipeRight: () => {
      if (!drawerOpen) setDrawerOpen(true)
    },
    onSwipeLeft: () => {
      if (drawerOpen) setDrawerOpen(false)
    },
    threshold: 60,
  })

  // Prevent body scroll when keyboard is closed
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--keyboard-height', keyboardVisible ? 'var(--keyboard-height, 0px)' : '0px'
    )
  }, [keyboardVisible])

  const showBottomNav = !keyboardVisible

  return (
    <div
      className="mobile-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--bg-primary)',
      }}
      {...swipe}
    >
      {/* Connection Banner */}
      <ConnectionBanner connected={connected} reconnecting={reconnecting} />

      {/* In-app Notifications */}
      <InAppNotification />

      {/* Drawer Overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 'var(--z-drawer)',
              backdropFilter: 'blur(2px)',
            }}
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          paddingTop: 'var(--sat)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            style={{ height: '100%', overflow: 'hidden' }}
          >
            <Outlet context={{ openDrawer: () => setDrawerOpen(true) }} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <AnimatePresence>
        {showBottomNav && (
          <motion.div
            initial={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 1, 1] }}
          >
            <BottomNav />
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  )
}
