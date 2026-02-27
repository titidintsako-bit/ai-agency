/**
 * StatCard — reusable metric card used on Home and Analytics pages.
 *
 * Props:
 *   label    string    — small uppercase label above the value
 *   value    string    — main display value
 *   sub      string?   — secondary line below value
 *   accent   string?   — bottom bar colour (hex / tailwind colour)
 *   loading  bool?     — show skeleton instead of value
 *   icon     ReactNode? — small icon rendered top-right
 */
export default function StatCard({ label, value, sub, accent = '#6366f1', loading, icon }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2 relative overflow-hidden"
      style={{ background: '#161b22', border: '1px solid #21262d' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-widest leading-none" style={{ color: '#8b949e' }}>
          {label}
        </p>
        {icon && (
          <span className="shrink-0 opacity-40" style={{ color: accent }}>
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-28 rounded-md animate-pulse mt-1" style={{ background: '#21262d' }} />
      ) : (
        <p className="text-3xl font-semibold tabular-nums leading-none mt-1" style={{ color: '#e6edf3' }}>
          {value ?? '—'}
        </p>
      )}

      {sub && !loading && (
        <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>{sub}</p>
      )}
      {loading && sub && (
        <div className="h-3 w-20 rounded animate-pulse mt-0.5" style={{ background: '#21262d' }} />
      )}

      {/* Accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${accent}88 0%, transparent 100%)` }}
      />
    </div>
  )
}
