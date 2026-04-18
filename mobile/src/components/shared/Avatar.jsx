const COLORS = [
  ['#7c5cfc', '#c084fc'], ['#06b6d4', '#3b82f6'],
  ['#f97316', '#ef4444'], ['#10b981', '#14b8a6'],
  ['#ec4899', '#f43f5e'], ['#8b5cf6', '#6366f1'],
]

function getColor(name = '') {
  const i = name.charCodeAt(0) % COLORS.length
  return COLORS[i]
}

export default function Avatar({ name = '?', src, size = 36, online, away }) {
  const [from, to] = getColor(name)
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const statusColor = online ? 'var(--online)' : away ? 'var(--away)' : null

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: src ? 'transparent' : `linear-gradient(135deg, ${from}, ${to})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontSize: size * 0.38,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
      }}>
        {src ? (
          <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : initials}
      </div>
      {statusColor && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: '50%',
          background: statusColor,
          border: '2px solid var(--bg-secondary)',
        }} />
      )}
    </div>
  )
}
