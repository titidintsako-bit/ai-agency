/**
 * StatCard — reusable metric card used on Home and Analytics pages.
 *
 * Props:
 *   label    string     — small uppercase label above the value
 *   value    string     — main display value
 *   sub      string?    — secondary line below value
 *   accent   string?    — left bar colour (hex)
 *   loading  bool?      — show skeleton instead of value
 *   icon     ReactNode? — small icon rendered top-right
 */
export default function StatCard({ label, value, sub, accent = '#6366f1', loading, icon }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1.5 relative overflow-hidden"
      style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-xs font-semibold uppercase tracking-widest leading-none"
          style={{ color: '#6e7681', letterSpacing: '0.08em' }}
        >
          {label}
        </p>
        {icon && (
          <span className="shrink-0" style={{ color: accent, opacity: 0.5 }}>
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <>
          <div className="h-9 w-24 rounded-md animate-pulse mt-2" style={{ background: '#21262d' }} />
          <div className="h-3 w-16 rounded animate-pulse mt-1" style={{ background: '#21262d' }} />
        </>
      ) : (
        <>
          <p
            className="text-3xl font-bold tabular-nums leading-none mt-1"
            style={{ color: '#e6edf3', letterSpacing: '-0.02em' }}
          >
            {value ?? '—'}
          </p>
          {sub && (
            <p className="text-xs mt-0.5" style={{ color: '#6e7681' }}>{sub}</p>
          )}
        </>
      )}
    </div>
  )
}
