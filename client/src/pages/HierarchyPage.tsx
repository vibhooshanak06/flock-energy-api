import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, HierarchyTree, ZoneNode, CircleNode, DivisionNode,
         SubdivisionNode, SubstationNode, FeederNode, DtNode } from '../api'

// ---------------------------------------------------------------------------
// Generic collapsible tree node
// ---------------------------------------------------------------------------

function TreeNode({
  label,
  badge,
  depth = 0,
  children,
  isLeaf = false,
  onClick,
}: {
  label: string
  badge?: string | number
  depth?: number
  children?: React.ReactNode
  isLeaf?: boolean
  onClick?: () => void
}) {
  const [open, setOpen] = useState(depth < 1)

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer
                    hover:bg-slate-800 transition-colors group select-none`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={onClick ?? (() => !isLeaf && setOpen(o => !o))}
      >
        {!isLeaf && (
          <span className="text-slate-600 group-hover:text-slate-400 text-xs w-3 shrink-0 transition-transform"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>
            ▶
          </span>
        )}
        {isLeaf && <span className="w-3 shrink-0 text-slate-700 text-xs">—</span>}
        <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{label}</span>
        {badge !== undefined && (
          <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono shrink-0">
            {badge}
          </span>
        )}
      </div>
      {!isLeaf && open && <div>{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Level-specific nodes
// ---------------------------------------------------------------------------

function DtLeaf({ dt, depth }: { dt: DtNode; depth: number }) {
  const navigate = useNavigate()
  return (
    <TreeNode
      label={`${dt.name}`}
      badge={`${dt.meterCount} meters`}
      depth={depth}
      isLeaf={false}
    >
      <div
        style={{ paddingLeft: (depth + 1) * 16 + 8 }}
        className="py-1 text-xs text-slate-500 cursor-pointer hover:text-slate-300"
        onClick={() => {/* navigate into DT meter list — future */}}
      >
        <span className="font-mono">{dt.code}</span>
        {' · '}
        <span>{dt.meterCount} meters installed</span>
      </div>
    </TreeNode>
  )
}

function FeederBranch({ feeder, depth }: { feeder: FeederNode; depth: number }) {
  const total = feeder.dts.reduce((s, d) => s + d.meterCount, 0)
  return (
    <TreeNode label={feeder.name} badge={total} depth={depth}>
      {feeder.dts.map(dt => <DtLeaf key={dt.code} dt={dt} depth={depth + 1} />)}
    </TreeNode>
  )
}

function SubstationBranch({ ss, depth }: { ss: SubstationNode; depth: number }) {
  const total = ss.feeders.flatMap(f => f.dts).reduce((s, d) => s + d.meterCount, 0)
  return (
    <TreeNode label={ss.name} badge={total} depth={depth}>
      {ss.feeders.map(f => <FeederBranch key={f.code} feeder={f} depth={depth + 1} />)}
    </TreeNode>
  )
}

function SubdivisionBranch({ sd, depth }: { sd: SubdivisionNode; depth: number }) {
  const total = sd.substations.flatMap(ss => ss.feeders).flatMap(f => f.dts).reduce((s, d) => s + d.meterCount, 0)
  return (
    <TreeNode label={sd.name} badge={total} depth={depth}>
      {sd.substations.map(ss => <SubstationBranch key={ss.code} ss={ss} depth={depth + 1} />)}
    </TreeNode>
  )
}

function DivisionBranch({ div, depth }: { div: DivisionNode; depth: number }) {
  const total = div.subdivisions.flatMap(sd => sd.substations).flatMap(ss => ss.feeders).flatMap(f => f.dts).reduce((s, d) => s + d.meterCount, 0)
  return (
    <TreeNode label={div.name} badge={total} depth={depth}>
      {div.subdivisions.map(sd => <SubdivisionBranch key={sd.code} sd={sd} depth={depth + 1} />)}
    </TreeNode>
  )
}

function CircleBranch({ circle, depth }: { circle: CircleNode; depth: number }) {
  const total = circle.divisions.flatMap(d => d.subdivisions).flatMap(sd => sd.substations).flatMap(ss => ss.feeders).flatMap(f => f.dts).reduce((s, d) => s + d.meterCount, 0)
  return (
    <TreeNode label={circle.name} badge={total} depth={depth}>
      {circle.divisions.map(d => <DivisionBranch key={d.code} div={d} depth={depth + 1} />)}
    </TreeNode>
  )
}

function ZoneBranch({ zone }: { zone: ZoneNode }) {
  const total = zone.circles.flatMap(c => c.divisions).flatMap(d => d.subdivisions).flatMap(sd => sd.substations).flatMap(ss => ss.feeders).flatMap(f => f.dts).reduce((s, d) => s + d.meterCount, 0)
  return (
    <TreeNode label={zone.name} badge={total} depth={0}>
      {zone.circles.map(c => <CircleBranch key={c.code} circle={c} depth={1} />)}
    </TreeNode>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HierarchyPage() {
  const [tree, setTree] = useState<HierarchyTree | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.hierarchy().then(setTree).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm animate-pulse">
      Building hierarchy tree…
    </div>
  )
  if (!tree) return null

  const dtCount = tree.zones
    .flatMap(z => z.circles).flatMap(c => c.divisions)
    .flatMap(d => d.subdivisions).flatMap(sd => sd.substations)
    .flatMap(ss => ss.feeders).flatMap(f => f.dts).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Network Hierarchy</h1>
          <p className="text-slate-500 text-sm mt-1">
            {tree.zones.length} zones · {dtCount} DTs · {tree.totalMeters} meters
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-5 text-xs text-slate-500">
          {['Zone', 'Circle', 'Division', 'Subdivision', 'Substation', 'Feeder', 'DT'].map((l, i) => (
            <span key={l} className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-slate-600 inline-block" style={{ marginLeft: i * 2 }} />
              {l}
            </span>
          ))}
        </div>

        {/* Tree */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          {tree.zones.map(z => <ZoneBranch key={z.code} zone={z} />)}
        </div>

        <p className="text-xs text-slate-700 mt-4 text-center">
          Badge = total meter count beneath that node
        </p>
      </div>
    </div>
  )
}
