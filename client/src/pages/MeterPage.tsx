import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { api, MeterDetail, Reading } from '../api'

const STATUS_COLOR: Record<string, string> = {
  Installed:      '#22c55e',
  Faulty:         '#f59e0b',
  Decommissioned: '#64748b',
}

/** Compute per-interval kWh delta from cumulative register values */
function computeDeltas(readings: Reading[]) {
  return readings
    .filter(r => r.kwh !== null)
    .map((r, i, arr) => {
      const prev = arr[i - 1]
      const delta = prev ? Math.max(0, r.kwh! - prev.kwh!) : null
      // Format timestamp to HH:mm DD/MM for the chart axis
      const d = new Date(r.timestamp)
      const label = `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')} ${d.getUTCDate()}/${d.getUTCMonth()+1}`
      return { label, kwh: r.kwh, delta, voltR: r.voltR }
    })
    .filter(r => r.delta !== null)
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-800 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="text-sm text-slate-200 font-medium">{value}</span>
    </div>
  )
}

export default function MeterPage() {
  const { id } = useParams<{ id: string }>()
  const [meter, setMeter] = useState<MeterDetail | null>(null)
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError('')
    Promise.all([api.meter(id), api.consumption(id)])
      .then(([m, c]) => { setMeter(m); setReadings(c.readings) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm animate-pulse">
      Loading meter {id}…
    </div>
  )
  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 text-sm">{error}</div>
  )
  if (!meter) return null

  const deltas = computeDeltas(readings)
  const latest = readings[readings.length - 1]
  const statusColor = STATUS_COLOR[meter.installStatus] ?? '#94a3b8'

  // Summarise recent consumption
  const last24 = deltas.slice(-48)
  const totalKwh = last24.reduce((s, r) => s + (r.delta ?? 0), 0)

  const HIER_LEVELS = [
    ['Zone', meter.hierarchy.zone],
    ['Circle', meter.hierarchy.circle],
    ['Division', meter.hierarchy.division],
    ['Subdivision', meter.hierarchy.subdivision],
    ['Substation', meter.hierarchy.substation],
    ['Feeder', meter.hierarchy.feeder],
    ['DT', meter.hierarchy.dt],
  ] as [string, { name: string; code: string }][]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Back */}
        <Link to="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← Back to map
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold font-mono text-white">{meter.meterId}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {meter.make} · {meter.phaseType}-phase · {meter.installType}
            </p>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium border"
            style={{ color: statusColor, borderColor: statusColor + '40', background: statusColor + '15' }}
          >
            {meter.installStatus}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Latest kWh', value: latest?.kwh?.toLocaleString() ?? '—' },
            { label: 'Last 24h consumed', value: totalKwh > 0 ? `${totalKwh.toFixed(2)} kWh` : '—' },
            { label: 'Readings available', value: readings.length.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs mb-1">{label}</p>
              <p className="text-white text-lg font-semibold font-mono">{value}</p>
            </div>
          ))}
        </div>

        {/* Consumption chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">
            Consumption (kWh per interval)
          </h2>
          <p className="text-xs text-slate-600 mb-4">
            Computed from cumulative register reads · timestamps in UTC
          </p>
          {deltas.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">No readings available</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={deltas} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="kwhGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  interval={Math.floor(deltas.length / 6)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                  itemStyle={{ color: '#22c55e', fontSize: 12 }}
                  formatter={(v: number) => [`${v.toFixed(3)} kWh`, 'Consumed']}
                />
                <Area
                  type="monotone"
                  dataKey="delta"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  fill="url(#kwhGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Voltage chart */}
        {deltas.some(d => d.voltR) && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">R-phase Voltage (V)</h2>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={deltas} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="voltGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }}
                  interval={Math.floor(deltas.length / 6)} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 10 }}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                  itemStyle={{ color: '#f59e0b', fontSize: 12 }}
                  formatter={(v: number) => [`${v} V`, 'Voltage R']}
                />
                <Area type="monotone" dataKey="voltR" stroke="#f59e0b" strokeWidth={1.5}
                  fill="url(#voltGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Nameplate */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Nameplate</h2>
            <Field label="Meter ID"    value={meter.meterId} />
            <Field label="Serial No"   value={meter.serialNo} />
            <Field label="Make"        value={meter.make} />
            <Field label="Phase"       value={meter.phaseType} />
            <Field label="Install type" value={meter.installType} />
            <Field label="Build"       value={meter.build} />
            <Field label="DT"          value={meter.dtCode} />
          </div>

          {/* Hierarchy */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Network position</h2>
            <div className="space-y-1">
              {HIER_LEVELS.map(([level, node], i) => (
                <div key={level} className="flex items-center gap-2">
                  <span
                    className="text-slate-600 text-xs w-20 shrink-0"
                    style={{ paddingLeft: i * 4 }}
                  >
                    {level}
                  </span>
                  <span className="text-xs text-slate-300">{node.name}</span>
                  <span className="text-xs text-slate-600 font-mono ml-auto">{node.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Location</h2>
          <p className="text-slate-400 text-sm font-mono">
            {meter.geo.lat.toFixed(6)}, {meter.geo.lng.toFixed(6)}
          </p>
          <a
            href={`https://www.google.com/maps?q=${meter.geo.lat},${meter.geo.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1 inline-block"
          >
            Open in Google Maps ↗
          </a>
        </div>

      </div>
    </div>
  )
}
