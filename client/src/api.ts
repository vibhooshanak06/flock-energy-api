/**
 * Thin typed wrapper over our NestJS API.
 * All fetch calls go to /api/v1 — proxied by Vite to localhost:3000.
 */

const BASE = '/api/v1'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HierarchyNode { name: string; code: string }

export interface MeterSummary {
  meterId: string
  serialNo: string
  make: string
  phaseType: string
  installStatus: 'Installed' | 'Faulty' | 'Decommissioned'
  dtCode: string
}

export interface MeterDetail extends MeterSummary {
  installType: string
  build: string
  hierarchy: {
    zone: HierarchyNode; circle: HierarchyNode; division: HierarchyNode
    subdivision: HierarchyNode; substation: HierarchyNode
    feeder: HierarchyNode; dt: HierarchyNode
  }
  geo: { lat: number; lng: number }
}

export interface ExportMeter extends MeterDetail {}

export interface Reading {
  timestamp: string
  kwh: number | null
  kvah: number | null
  voltR: number | null
}

export interface ConsumptionResponse {
  meterId: string
  readings: Reading[]
  count: number
}

export interface DtNode {
  code: string; name: string; meterCount: number
}
export interface FeederNode {
  code: string; name: string; dts: DtNode[]
}
export interface SubstationNode {
  code: string; name: string; feeders: FeederNode[]
}
export interface SubdivisionNode {
  code: string; name: string; substations: SubstationNode[]
}
export interface DivisionNode {
  code: string; name: string; subdivisions: SubdivisionNode[]
}
export interface CircleNode {
  code: string; name: string; divisions: DivisionNode[]
}
export interface ZoneNode {
  code: string; name: string; circles: CircleNode[]
}
export interface HierarchyTree {
  zones: ZoneNode[]
  totalMeters: number
}

export interface BulkExport {
  data: ExportMeter[]
  total: number
}

export interface PaginatedMeters {
  data: MeterSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const api = {
  meters: (page = 1, q = '') =>
    get<PaginatedMeters>(`/meters?page=${page}&limit=20&q=${encodeURIComponent(q)}`),

  meter: (id: string) => get<MeterDetail>(`/meters/${id}`),

  consumption: (id: string) => get<ConsumptionResponse>(`/meters/${id}/consumption`),

  export: () => get<BulkExport>('/network/export'),

  hierarchy: () => get<HierarchyTree>('/network/hierarchy'),
}
