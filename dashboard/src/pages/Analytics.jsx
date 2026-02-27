import { useCallback, useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getCosts, getQuestions, getResolution, getUsage } from '../api/analytics'
import StatCard from '../components/StatCard'

// ── Theme tokens ──────────────────────────────────────────────────────────────

const CHART_THEME = {
  bg:      '#161b22',
  border:  '#21262d',
  grid:    '#21262d',
  text:    '#8b949e',
  tooltip: { bg: '#1c2128', border: '#30363d' },
}
const COLORS = ['#6366f1', '#3fb950', '#f0883e', '#58a6ff', '#f85149', '#d2a8ff']

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, prefix = '', suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs space-y-1"
      style={{ background: CHART_THEME.tooltip.bg, border: `1px solid ${CHART_THEME.tooltip.border}` }}
    >
      <p className="font-medium mb-1" style={{ color: '#e6edf3' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{suffix}
        </p>
      ))}
    </div>
  )
}

// ── Period toggle ─────────────────────────────────────────────────────────────

function PeriodToggle({ value, onChange }) {
  return (
    <div
      className="flex items-center rounded-lg p-0.5 gap-0.5"
      style={{ background: '#0d1117', border: '1px solid #21262d' }}
    >
      {['daily', 'weekly', 'monthly'].map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="px-3 py-1 rounded-md text-xs capitalize transition-all duration-150"
          style={value === p ? { background: '#21262d', color: '#e6edf3' } : { color: '#8b949e' }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({ title, children, action }) {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: CHART_THEME.bg, border: `1px solid ${CHART_THEME.border}` }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: '#e6edf3' }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Analytics page ────────────────────────────────────────────────────────────

export default function Analytics() {
  const [period,     setPeriod]     = useState('daily')
  const [usage,      setUsage]      = useState(null)
  const [costs,      setCosts]      = useState(null)
  const [resolution, setResolution] = useState(null)
  const [questions,  setQuestions]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [u, c, r, q] = await Promise.all([
        getUsage(period),
        getCosts(period),
        getResolution(),
        getQuestions(),
      ])
      setUsage(u)
      setCosts(c)
      setResolution(r)
      setQuestions(q)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchAll() }, [fetchAll])

  const pieData = resolution
    ? [
        { name: 'Completed',  value: resolution.completed,  color: '#3fb950' },
        { name: 'Escalated',  value: resolution.escalated,  color: '#f85149' },
        { name: 'Abandoned',  value: resolution.abandoned,  color: '#6e7681' },
        { name: 'Active',     value: resolution.active,     color: '#6366f1' },
      ].filter(d => d.value > 0)
    : []

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Analytics</h1>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}
        >
          {error}
        </div>
      )}

      {/* Summary stats (from usage data) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tokens"
          value={usage ? ((usage.data.reduce((s, d) => s + d.input_tokens + d.output_tokens, 0)) / 1000).toFixed(1) + 'k' : null}
          sub={`${period} period`}
          accent="#6366f1"
          loading={loading}
        />
        <StatCard
          label="Total Cost"
          value={usage ? `R ${usage.data.reduce((s, d) => s + d.cost_zar, 0).toFixed(2)}` : null}
          sub={`${period} period`}
          accent="#f0883e"
          loading={loading}
        />
        <StatCard
          label="Resolution Rate"
          value={resolution ? `${resolution.resolution_rate}%` : null}
          sub="last 30 days"
          accent="#3fb950"
          loading={loading}
        />
        <StatCard
          label="Total Conversations"
          value={resolution?.total}
          sub="last 30 days"
          accent="#58a6ff"
          loading={loading}
        />
      </div>

      {/* Token usage bar chart */}
      <Panel
        title="Token Usage"
        action={<span className="text-xs" style={{ color: '#8b949e' }}>input + output tokens</span>}
      >
        {loading ? (
          <div className="h-56 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
        ) : !usage?.data?.length ? (
          <p className="text-sm py-10 text-center" style={{ color: '#6e7681' }}>No token data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={usage.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v.slice(5)}  // strip year from "2026-02-27"
              />
              <YAxis
                tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                width={40}
              />
              <Tooltip content={<CustomTooltip suffix=" tokens" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: CHART_THEME.text }} />
              <Bar dataKey="input_tokens"  name="Input"  fill="#6366f1" radius={[3,3,0,0]} maxBarSize={32} />
              <Bar dataKey="output_tokens" name="Output" fill="#3fb950" radius={[3,3,0,0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Cost by client line chart */}
      <Panel
        title="Cost per Client (ZAR)"
        action={<span className="text-xs" style={{ color: '#8b949e' }}>rand spend over time</span>}
      >
        {loading ? (
          <div className="h-56 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
        ) : !costs?.data?.length ? (
          <p className="text-sm py-10 text-center" style={{ color: '#6e7681' }}>No cost data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={costs.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v.slice(5)}
              />
              <YAxis
                tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `R${v}`}
                width={48}
              />
              <Tooltip content={<CustomTooltip prefix="R" />} />
              <Legend wrapperStyle={{ fontSize: 11, color: CHART_THEME.text }} />
              {(costs.clients || []).map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Bottom row: resolution pie + top questions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Resolution rate */}
        <Panel title="Conversation Outcomes (last 30 days)">
          {loading ? (
            <div className="h-48 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
          ) : !pieData.length ? (
            <p className="text-sm py-10 text-center" style={{ color: '#6e7681' }}>No conversation data yet.</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, n) => [v, n]}
                    contentStyle={{ background: CHART_THEME.tooltip.bg, border: `1px solid ${CHART_THEME.tooltip.border}`, fontSize: 12 }}
                    labelStyle={{ color: '#e6edf3' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-sm" style={{ color: '#8b949e' }}>{d.name}</span>
                    </div>
                    <span className="text-sm font-medium tabular-nums" style={{ color: '#e6edf3' }}>{d.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t" style={{ borderColor: '#21262d' }}>
                  <p className="text-sm" style={{ color: '#8b949e' }}>
                    Resolution rate:{' '}
                    <span className="font-semibold" style={{ color: '#3fb950' }}>
                      {resolution?.resolution_rate ?? 0}%
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </Panel>

        {/* Top questions */}
        <Panel title="Recent Customer Questions">
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-8 rounded animate-pulse" style={{ background: '#21262d' }} />
              ))}
            </div>
          ) : !questions?.questions?.length ? (
            <p className="text-sm py-10 text-center" style={{ color: '#6e7681' }}>No conversation data yet.</p>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {questions.questions.slice(0, 20).map((q, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 py-2 px-3 rounded-lg"
                  style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                >
                  <span className="text-xs tabular-nums mt-0.5 shrink-0 w-4" style={{ color: '#6e7681' }}>
                    {i + 1}
                  </span>
                  <p className="text-sm line-clamp-2" style={{ color: '#c9d1d9' }}>{q}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
