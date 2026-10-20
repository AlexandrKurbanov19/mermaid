import type { StateIR, StateNode } from '../ir'
import type { NodeBox } from './measureNode'
import { measureNode } from './measureNode'
import type { FontSpec, TextMeasurer } from './textMetrics'

/** Диаметр кружка start/end. */
export const START_END_SIZE = 28
/** Бар fork/join. */
export const FORK_JOIN_SIZE = { width: 48, height: 12 }

const emptyFit = (fontSize: number): NodeBox['fit'] => ({
  fontSize,
  lineHeight: fontSize * 1.3,
  lines: [],
  width: 0,
  height: 0,
  truncated: false,
})

/**
 * Габариты узлов state-диаграммы.
 * start/end/fork/join — фиксированные, choice — ромб, состояние — блок
 * (в блок входит и description, чтобы ничего не обрезалось).
 */
export function measureStateNodes(
  ir: StateIR,
  font: FontSpec,
  measurer: TextMeasurer,
): Record<string, NodeBox> {
  const result: Record<string, NodeBox> = {}

  const mergedLabel = (node: StateNode) =>
    node.description.length
      ? { lines: [...node.label.lines, ...node.description.flatMap((d) => d.lines)] }
      : node.label

  for (const node of ir.nodes) {
    if (node.kind === 'start' || node.kind === 'end') {
      result[node.id] = {
        width: START_END_SIZE,
        height: START_END_SIZE,
        fit: emptyFit(14),
      }
    } else if (node.kind === 'fork' || node.kind === 'join') {
      result[node.id] = {
        width: FORK_JOIN_SIZE.width,
        height: FORK_JOIN_SIZE.height,
        fit: emptyFit(14),
      }
    } else if (node.kind === 'choice') {
      result[node.id] = measureNode(node.label, 'decision', font, measurer)
    } else {
      result[node.id] = measureNode(mergedLabel(node), 'round', font, measurer)
    }
  }

  return result
}
