import { motion } from "framer-motion";

export default function TypingIndicator({ names = [] }) {
  if (!names.length) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names.slice(0, 2).join(", ")} and ${names.length - 2} others are typing`;

  return (
    <motion.div
      className="typing-indicator"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
    >
      <span className="typing-dots" aria-hidden>
        <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: 0 }} />
        <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: 0.15 }} />
        <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: 0.3 }} />
      </span>
      <span className="typing-label">{label}</span>
    </motion.div>
  );
}
