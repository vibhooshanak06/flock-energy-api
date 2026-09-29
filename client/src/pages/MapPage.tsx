import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { api, ExportMeter } from '../api'

// Status → colour
const STATUS_COLOR: Record<string, string> = {
  Installed: '#22c55e',   // green
  Faulty: '#f59e0b',   // amber
  Decommissioned: '#64748b',   // slate
}

function makeIcon(status: string) {
  const color = STATUS_COLOR[status] ?? '#94a3b8'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
    <circle cx="7" cy="7" r="6" fill="${color}" stroke="white" stroke-width="1.5"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

export default function MapPage() {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [meters, setMeters] = useState<ExportMeter[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ExportMeter | null>(null)
  const [filter, setFilter] = useState<string>('All')
  const navigate = useNavigate()

  // Load all meters once
  useEffect(() => {
    api.export().then(r => {
      setMeters(r.data)
      setLoading(false)
    })
  }, [])

  // Build/rebuild map
  useEffect(() => {
    if (loading || !containerRef.current) return

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: [26.91, 75.79],
        zoom: 12,
        zoomControl: true,
      })
      L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(mapRef.current)
    }

    const map = mapRef.current
    // Clear existing markers
    map.eachLayer(l => { if (l instanceof L.Marker) map.removeLayer(l) })

    const visible = filter === 'All' ? meters : meters.filter(m => m.installStatus === filter)

    visible.forEach(meter => {
      const { lat, lng } = meter.geo
      const marker = L.marker([lat, lng], { icon: makeIcon(meter.installStatus) })
      marker.bindTooltip(
        `<div class="font-mono text-xs">${meter.meterId}</div>
         <div class="text-xs text-slate-400">${meter.installStatus}</div>`,
        { className: 'urja-tooltip', direction: 'top', offset: [0, -8] }
      )
      marker.on('click', () => setSelected(meter))
      marker.addTo(map)
    })
  }, [loading, meters, filter])

  // Cleanup on unmount
  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null }, [])

  const counts = {
    All: meters.length,
    Installed: meters.filter(m => m.installStatus === 'Installed').length,
    Faulty: meters.filter(m => m.installStatus === 'Faulty').length,
    Decommissioned: meters.filter(m => m.installStatus === 'Decommissioned').length,
  }

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-[1000]">
          <div className="text-slate-400 text-sm animate-pulse">Loading meters…</div>
        </div>
      )}

      {/* Filter bar */}
      {!loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-1.5 bg-slate-900/90 backdrop-blur px-2 py-1.5 rounded-xl border border-slate-700 shadow-xl">
          {(['All', 'Installed', 'Faulty', 'Decommissioned'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors
                ${filter === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {s !== 'All' && (
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: STATUS_COLOR[s] }}
                />
              )}
              {s}
              <span className="ml-0.5 text-slate-500">({counts[s]})</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected meter card */}
      {selected && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-72
                        bg-slate-900/95 backdrop-blur border border-slate-700
                        rounded-2xl shadow-2xl p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-mono font-semibold text-white">{selected.meterId}</p>
              <p className="text-xs text-slate-400 mt-0.5">{selected.make} · {selected.phaseType}-phase</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-500 hover:text-white text-lg leading-none"
            >×</button>
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: STATUS_COLOR[selected.installStatus] }}
            />
            <span className="text-xs" style={{ color: STATUS_COLOR[selected.installStatus] }}>
              {selected.installStatus}
            </span>
            <span className="text-slate-600 text-xs ml-auto">{selected.dtCode}</span>
          </div>

          <div className="text-xs text-slate-500 mb-3">
            {selected.hierarchy.zone.name} → {selected.hierarchy.feeder.name}
          </div>

          <button
            onClick={() => navigate(`/meters/${selected.meterId}`)}
            className="w-full py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600
                       text-sm text-white transition-colors"
          >
            View detail & consumption →
          </button>
        </div>
      )}

      {/* Legend */}
      {!loading && (
        <div className="absolute bottom-6 right-4 z-[1000] bg-slate-900/90 backdrop-blur
                        border border-slate-700 rounded-xl px-3 py-2 text-xs space-y-1">
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} className="flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: c }} />
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
