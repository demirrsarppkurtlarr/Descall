import { motion, AnimatePresence } from "framer-motion";
import { useHaptic } from "../../hooks/useMobile";
import Avatar from "../ui/Avatar";

export default function MobileDrawer({ open, onClose, me, onNavigate, onLogout }) {
  const haptic = useHaptic();

  const go = (tab) => {
    haptic.tap();
    onNavigate(tab);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: "min(280px, 80vw)",
            background: "var(--bg-secondary)",
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            paddingTop: "var(--sat, 0px)",
            paddingBottom: "var(--sab, 0px)",
            boxShadow: "4px 0 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Server header */}
          <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, var(--accent, #7c5cfc), #c084fc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                D
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Descall</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Community Server</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            <div
              style={{
                padding: "8px 16px 4px",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Navigation
            </div>
            {[
              { tab: "general", label: "# general", emoji: "💬" },
              { tab: "dm", label: "Direct Messages", emoji: "📩" },
              { tab: "notifications", label: "Notifications", emoji: "🔔" },
              { tab: "profile", label: "Profile & Settings", emoji: "⚙️" },
              ...(me?.username === "admin" ? [{ tab: "admin", label: "Admin Panel", emoji: "👑" }] : []),
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => go(item.tab)}
                style={{
                  width: "calc(100% - 16px)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "left",
                  cursor: "pointer",
                  margin: "1px 8px",
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* User strip */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Avatar name={me?.displayName || me?.username} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {me?.displayName || me?.username}
              </div>
              <div style={{ fontSize: 11, color: "var(--online, #22c55e)" }}>Online</div>
            </div>
            <button
              onClick={() => { onLogout(); onClose(); }}
              title="Logout"
              style={{
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                padding: 6,
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
