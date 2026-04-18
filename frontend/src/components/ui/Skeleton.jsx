import { motion } from "framer-motion";

export function SkeletonLine({ width = "100%" }) {
  return (
    <motion.div
      className="skeleton-line"
      style={{ width }}
      animate={{ opacity: [0.45, 0.9, 0.45] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function MessageSkeleton({ count = 3 }) {
  return (
    <div className="skeleton-messages">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <SkeletonLine width={40} />
          <div className="skeleton-col">
            <SkeletonLine width="30%" />
            <SkeletonLine width="85%" />
          </div>
        </div>
      ))}
    </div>
  );
}
