import { motion } from "framer-motion";
import { useHaptic } from "../../hooks/useMobile";

const NAV_ITEMS = [
  {
    id: "general",
    label: "General",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "dm",
    label: "DMs",
    badge: "dm",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Alerts",
    badge: "notif",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Me",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 1 0-16 0" />
      </svg>
    ),
  },
];

export default function MobileBottomNav({ activeTab, onTabChange, dmUnread = 0, notifUnread = 0 }) {
  const haptic = useHaptic();

  const handleNav = (id) => {
    haptic.tap();
    onTabChange(id);
  };

  const getBadge = (item) => {
    if (item.badge === "dm") return dmUnread;
    if (item.badge === "notif") return notifUnread;
    return 0;
  };

  return (
    <nav
      style={{
        height: "calc(56px + var(--sab, 0px))",
        paddingBottom: "var(--sab, 0px)",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "stretch",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        position: "relative",
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const badge = getBadge(item);

        return (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: isActive ? "var(--accent, #7c5cfc)" : "var(--text-muted)",
              position: "relative",
              minWidth: 0,
              padding: "8px 4px",
              transition: "color 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-nav-indicator"
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 32,
                  height: 2,
                  background: "var(--accent, #7c5cfc)",
                  borderRadius: "0 0 2px 2px",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}

            {badge > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: "50%",
                  marginRight: -18,
                  background: "var(--danger, #ef4444)",
                  color: "#fff",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  border: "2px solid var(--bg-secondary)",
                }}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}

            <motion.div
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              {item.icon}
            </motion.div>

            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, letterSpacing: 0.2 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
