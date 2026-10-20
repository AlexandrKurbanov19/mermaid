import type { StateIR } from '../ir'
import type { NodeBox } from './measureNode'
import { measureNode } from './measureNode'
import type { FontSpec, TextMeasurer } from './textMetrics'

/** Диаметр кружка start/end — маленькая фиксированная точка. */
export const START_END_SIZE = 28

/**
 * Габариты узлов state-диаграммы.
 * start/end — фиксированные кружки, состояния — обычные блоки.
 */
export function measureStateNodes(
  ir: StateIR,
  font: FontSpec,
  measurer: TextMeasurer,
): Record<string, NodeBox> {
  const result: Record<string, NodeBox> = {}

  for (const node of ir.nodes) {
    if (node.kind === 'start' || node.kind === 'end') {
      result[node.id] = {
        width: START_END_SIZE,
        height: START_END_SIZE,
        fit: { fontSize: 14, lineHeight: 18, lines: [], width: 0, height: 0, truncated: false },
      }
    } else {
      result[node.id] = measureNode(node.label, 'round', font, measurer)
    }
  }

  return result
}
