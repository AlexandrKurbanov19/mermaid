import type { ERIR, FlowchartIR } from '../ir'

/** ER -> псевдо-flowchart для ELK-раскладки. */
export function erToFlowchart(ir: ERIR): FlowchartIR {
  return {
    v: 1,
    type: 'flowchart',
    direction: 'TB',
    nodes: ir.entities.map((e) => ({ id: e.id, role: 'round', label: { lines: [[{ text: e.name }]] } })),
    edges: ir.relationships.map((r) => ({
      id: r.id,
      from: r.from,
      to: r.to,
      kind: r.identifying ? ('solid' as const) : ('dashed' as const),
      arrow: 'none' as const,
      ...(r.roleA ? { label: { lines: [[{ text: r.roleA }]] } } : {}),
    })),
    groups: [],
    warnings: [],
  }
}
