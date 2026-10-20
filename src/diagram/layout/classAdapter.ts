import type { ClassIR, FlowchartIR } from '../ir'

/** Class -> псевдо-flowchart, чтобы переиспользовать layoutDiagram и edgeLayout. */
export function classToFlowchart(ir: ClassIR): FlowchartIR {
  return {
    v: 1,
    type: 'flowchart',
    direction: 'TB',
    nodes: ir.nodes.map((n) => ({ id: n.id, role: 'round', label: n.name })),
    edges: ir.relations.map((r) => ({
      id: r.id,
      from: r.from,
      to: r.to,
      kind: r.style === 'dependency' ? ('dashed' as const) : ('solid' as const),
      arrow: 'end' as const,
      ...(r.title ? { label: { lines: [[{ text: r.title }]] } } : {}),
    })),
    groups: [],
    warnings: [],
  }
}
