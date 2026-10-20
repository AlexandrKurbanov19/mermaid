import type { FlowchartIR } from '../ir'
import type { StateIR } from '../ir'

/**
 * State → «псевдо-flowchart» — чтобы переиспользовать layoutDiagram и edgeLayout
 * без отдельного алгоритма раскладки.
 *
 * Роли в этом адаптере НЕ важны для раскладки (ELK берёт только id и габариты),
 * поэтому все узлы — 'round'. Габариты считает measureStateNodes.
 */
export function stateToFlowchart(ir: StateIR): FlowchartIR {
  return {
    v: 1,
    type: 'flowchart',
    direction: 'TB',
    nodes: ir.nodes.map((n) => ({
      id: n.id,
      role: 'round',
      label: n.label,
      ...(n.parentId ? { parentId: n.parentId } : {}),
    })),
    edges: ir.transitions.map((t, i) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      kind: 'solid' as const,
      arrow: 'end' as const,
      ...(t.label ? { label: t.label } : {}),
    })),
    groups: ir.groups.map((g) => ({ id: g.id, label: g.label, nodeIds: g.nodeIds, tone: 'neutral' as const })),
    warnings: [],
  }
}
