import type { FlowchartIR, InlineRun } from '../ir'
import type { Layout, Point } from '../layout/layoutElk'
import type { FontSpec, TextMeasurer } from '../measure/textMetrics'
import { type as typography } from '../theme'

/**
 * Геометрия рёбер: развод параллельных связей и размещение подписей.
 *
 * Зачем отдельным шагом: подпись нужно мерить РЕАЛЬНЫМИ метриками шрифта
 * и проверять, что она не легла на блок или на другую подпись.
 */

export interface LabelBox {
  text: string
  /** центр подписи */
  x: number
  y: number
  width: number
  height: number
}

export interface EdgeGeometry {
  id: string
  points: Point[]
  label?: LabelBox
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const overlaps = (a: Rect, b: Rect, pad = 0): boolean =>
  a.x - pad < b.x + b.width &&
  a.x + a.width + pad > b.x &&
  a.y - pad < b.y + b.height &&
  a.y + a.height + pad > b.y

/** Сколько сдвигать параллельные рёбра между одной парой узлов. */
const PARALLEL_GAP = 12

export function buildEdgeGeometries(
  ir: FlowchartIR,
  layout: Layout,
  font: FontSpec,
  measurer: TextMeasurer,
): EdgeGeometry[] {
  // пары узлов -> сколько рёбер между ними (A→B и B→A считаем одной парой)
  const pairCount = new Map<string, number>()
  for (const edge of ir.edges) {
    const key = [edge.from, edge.to].sort().join('\u0000')
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
  }
  const pairSeen = new Map<string, number>()

  const nodeRects: Rect[] = Object.values(layout.nodes).map((n) => ({
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
  }))

  const placedLabels: Rect[] = []
  const fontSize = typography.edgeLabel.size
  const labelHeight = Math.round(fontSize * typography.edgeLabel.lineHeight)
  const spec: FontSpec = { ...font, size: fontSize }

  const result: EdgeGeometry[] = []

  for (const edge of ir.edges) {
    const placement = layout.edges.find((e) => e.id === edge.id)
    if (!placement || placement.points.length < 2) {
      result.push({ id: edge.id, points: [] })
      continue
    }

    const key = [edge.from, edge.to].sort().join('\u0000')
    const count = pairCount.get(key) ?? 1
    const index = pairSeen.get(key) ?? 0
    pairSeen.set(key, index + 1)

    let points = placement.points
    if (count > 1 && edge.from !== edge.to) {
      const shift = (index - (count - 1) / 2) * PARALLEL_GAP
      const first = points[0]
      const last = points[points.length - 1]
      const horizontal = Math.abs(last.x - first.x) >= Math.abs(last.y - first.y)
      points = points.map((p) =>
        horizontal ? { x: p.x, y: p.y + shift } : { x: p.x + shift, y: p.y },
      )
    }

    const label = edge.label?.lines.length
      ? placeLabel(
          edge.label.lines.map((line: InlineRun[]) => line.map((r: InlineRun) => r.text).join('')).join(' '),
          points,
          nodeRects,
          placedLabels,
          spec,
          labelHeight,
          measurer,
        )
      : undefined

    if (label) {
      placedLabels.push({
        x: label.x - label.width / 2,
        y: label.y - label.height / 2,
        width: label.width,
        height: label.height,
      })
    }

    result.push({ id: edge.id, points, label })
  }

  return result
}

function placeLabel(
  text: string,
  points: Point[],
  nodeRects: Rect[],
  placedLabels: Rect[],
  spec: FontSpec,
  labelHeight: number,
  measurer: TextMeasurer,
): LabelBox | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined

  const width = Math.ceil(measurer.measure(trimmed, spec)) + 10

  // кандидаты: середины сегментов, от длинных к коротким
  const segments: Array<{ length: number; point: Point }> = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    segments.push({
      length: Math.hypot(b.x - a.x, b.y - a.y),
      point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    })
  }
  segments.sort((s1, s2) => s2.length - s1.length)
  if (!segments.length) return undefined

  for (const segment of segments) {
    if (segment.length < width * 0.6) continue

    const box: Rect = {
      x: segment.point.x - width / 2,
      y: segment.point.y - labelHeight / 2,
      width,
      height: labelHeight,
    }

    const hitsNode = nodeRects.some((n) => overlaps(box, n, 2))
    const hitsLabel = placedLabels.some((l) => overlaps(box, l, 4))
    if (!hitsNode && !hitsLabel) {
      return { text: trimmed, x: segment.point.x, y: segment.point.y, width, height: labelHeight }
    }
  }

  // запасной вариант — самый длинный сегмент, даже если подпись к чему-то прижалась
  const fallback = segments[0].point
  return { text: trimmed, x: fallback.x, y: fallback.y, width, height: labelHeight }
}
