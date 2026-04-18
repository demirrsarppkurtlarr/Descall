# Descall Mobile Frontend

WhatsApp/Discord-quality mobile-first React chat app.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env → set VITE_API_URL to your backend
npm run dev
```

Open http://localhost:3001 — use DevTools mobile emulation.

## Architecture

```
src/
├── hooks/
│   ├── useMobile.js        — isMobile, isIOS, isAndroid, isPWA, useHaptic
│   ├── useViewport.js      — keyboard height, safe areas, scroll lock
│   ├── useSwipe.js         — swipe gestures, long press, pull-to-refresh
│   ├── useSocket.js        — socket.io + reconnect + background sync
│   ├── useLocalCache.js    — IndexedDB message cache + drafts
│   ├── useOnlineStatus.js  — network online/offline + connection type
│   └── useVirtualList.js   — virtual scrolling for large message lists
├── contexts/
│   ├── AuthContext.jsx     — JWT login/register/logout + authFetch
│   └── NotificationContext.jsx — in-app banners + unread counts
├── components/
│   ├── mobile/
│   │   ├── MobileLayout.jsx      — app shell, swipe-to-drawer
│   │   ├── BottomNav.jsx         — 5-tab thumb-zone navigation
│   │   ├── Drawer.jsx            — spring slide-in sidebar
│   │   ├── BottomSheet.jsx       — drag-to-dismiss modal
│   │   ├── InAppNotification.jsx — top banner alerts
│   │   ├── ConnectionBanner.jsx  — offline/reconnecting state
│   │   └── PWAInstallPrompt.jsx  — install to home screen
│   └── shared/
│       ├── Avatar.jsx            — gradient initials + online dot
│       ├── Ripple.jsx            — touch ripple feedback
│       ├── FAB.jsx               — floating action button
│       ├── MessageBubble.jsx     — long-press actions + reactions
│       ├── TypingIndicator.jsx   — animated typing dots
│       ├── SwipeableRow.jsx      — left/right swipe actions
│       └── PullToRefresh.jsx     — pull-to-refresh container
└── pages/
    ├── AuthScreens.jsx     — Login + Register
    ├── ChannelList.jsx     — channel list with unread badges
    ├── ChatScreen.jsx      — real-time channel chat
    ├── DMList.jsx          — DM conversation list
    ├── DMScreen.jsx        — DM chat + offline cache
    ├── ExplorePage.jsx     — channel discovery grid
    ├── NotificationsPage.jsx — notifications with swipe-to-dismiss
    ├── AdminPanel.jsx      — mobile admin dashboard
    └── ProfileSettings.jsx — profile + toggle settings
```

## PWA

PWA is configured with vite-plugin-pwa. After `npm run build`, the app is installable on both iOS (Add to Home Screen) and Android (Install App prompt).

## Mobile Features

- ✅ Swipe right → open drawer
- ✅ Long press message → actions bottom sheet  
- ✅ Pull to refresh (channel/DM lists)
- ✅ Swipe left on notification → dismiss
- ✅ Keyboard-aware input (visualViewport API)
- ✅ Safe area insets (iPhone notch/Dynamic Island)
- ✅ Haptic feedback (navigator.vibrate)
- ✅ Socket reconnect on network change
- ✅ Background→foreground socket sync
- ✅ IndexedDB offline message cache
- ✅ Optimistic message send
- ✅ PWA installable + offline page
- ✅ In-app notification banners
- ✅ Unread badge system
- ✅ Spring animations (framer-motion)
- ✅ No horizontal scroll anywhere
- ✅ Momentum scroll on all lists
