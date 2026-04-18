import { motion } from "framer-motion";
import RippleButton from "../ui/RippleButton";

export default function SettingsPanel({
  onClose,
  compactBlur,
  setCompactBlur,
  reduceMotion,
  setReduceMotion,
  theme,
  setTheme,
  me,
  onLogout,
}) {
  return (
    <motion.div
      className="settings-panel glass"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
    >
      <header className="settings-head">
        <h3>Settings</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </header>
      <section className="settings-section">
        <h4>Account</h4>
        <p className="settings-muted">
          <strong>{me?.username}</strong>
          <br />
          <span className="settings-id">User ID: {me?.id}</span>
        </p>
      </section>
      <section className="settings-section">
        <h4>Appearance</h4>
        <label className="settings-row check">
          <span>Theme</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="settings-select"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="settings-row">
          <span>Glass blur</span>
          <input
            type="range"
            min={4}
            max={24}
            value={compactBlur}
            onChange={(e) => setCompactBlur(Number(e.target.value))}
          />
        </label>
        <label className="settings-row check">
          <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
          <span>Reduce motion</span>
        </label>
      </section>
      <section className="settings-section">
        <RippleButton type="button" className="btn-secondary full-width danger-outline" onClick={onLogout}>
          Log out
        </RippleButton>
      </section>
    </motion.div>
  );
}
