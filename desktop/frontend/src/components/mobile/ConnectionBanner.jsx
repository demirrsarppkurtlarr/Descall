import { AnimatePresence, motion } from "framer-motion";

export default function ConnectionBanner({ connected, reconnecting }) {
  const show = !connected;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 32, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            overflow: "hidden",
            background: reconnecting ? "var(--warning, #f59e0b)" : "var(--danger, #ef4444)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {reconnecting ? (
            <>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
              Reconnecting…
            </>
          ) : (
            <>
              <span>⚡</span>
              No connection
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
