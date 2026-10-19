import { describe, expect, it } from 'vitest'
import { buildEdgeGeometries } from './edgeLayout'
import { fallbackMeasurer as measurer } from '../measure/textMetrics'
import type { FlowchartIR } from '../ir'
import type { Layout } from '../layout/layoutElk'
import { font, type as typography } from '../theme'

const FONT = { family: font.family, weight: 400, size: typography.node.size }

function ir(edges: FlowchartIR['edges']): FlowchartIR {
  return { v: 1, type: 'flowchart', direction: 'TB', nodes: [], edges, groups: [], warnings: [] }
}

function layout(nodes: Layout['nodes'], edges: Layout['edges']): Layout {
  return { width: 500, height: 500, nodes, groups: {}, edges }
}

const nodes = {
  A: { id: 'A', x: 100, y: 40, width: 120, height: 56 },
  B: { id: 'B', x: 100, y: 200, width: 120, height: 56 },
}

describe('buildEdgeGeometries', () => {
  it('одно ребро не сдвигается', () => {
    const geometries = buildEdgeGeometries(
      ir([{ id: 'e1', from: 'A', to: 'B', kind: 'solid', arrow: 'end' }]),
      layout(nodes, [
        {
          id: 'e1',
          points: [
            { x: 160, y: 96 },
            { x: 160, y: 200 },
          ],
        },
      ]),
      FONT,
      measurer,
    )
    expect(geometries[0].points).toEqual([
      { x: 160, y: 96 },
      { x: 160, y: 200 },
    ])
  })

  it('пара рёбер A→B и B→A разводится в стороны', () => {
    const geometries = buildEdgeGeometries(
      ir([
        { id: 'e1', from: 'A', to: 'B', kind: 'solid', arrow: 'end' },
        { id: 'e2', from: 'B', to: 'A', kind: 'solid', arrow: 'end' },
      ]),
      layout(nodes, [
        { id: 'e1', points: [{ x: 160, y: 96 }, { x: 160, y: 200 }] },
        { id: 'e2', points: [{ x: 160, y: 200 }, { x: 160, y: 96 }] },
      ]),
      FONT,
      measurer,
    )

    const xs = geometries.map((g) => g.points[0].x)
    expect(xs[0]).not.toBe(xs[1]) // разведены по X, потому что ребро вертикальное
    expect(Math.abs(xs[0] - xs[1])).toBeCloseTo(12, 5)
  })

  it('подпись получает ширину по метрикам и не садится на узел', () => {
    const geometries = buildEdgeGeometries(
      ir([
        {
          id: 'e1',
          from: 'A',
          to: 'B',
          kind: 'solid',
          arrow: 'end',
          label: { lines: [[{ text: 'да' }]] },
        },
      ]),
      layout(nodes, [
        {
          id: 'e1',
          points: [
            { x: 160, y: 96 },
            { x: 160, y: 200 },
          ],
        },
      ]),
      FONT,
      measurer,
    )

    const label = geometries[0].label
    expect(label?.text).toBe('да')
    // ширина посчитана по метрикам (две буквы при 16px), а не «длина строки на глаз»
    expect(label!.width).toBeGreaterThan(10)
    expect(label!.width).toBeLessThan(40)
    // середина вертикального сегмента — между узлами
    expect(label!.y).toBeCloseTo(148, 0)
  })

  it('пустая подпись не создаёт бокс', () => {
    const geometries = buildEdgeGeometries(
      ir([
        {
          id: 'e1',
          from: 'A',
          to: 'B',
          kind: 'solid',
          arrow: 'end',
          label: { lines: [[{ text: '   ' }]] },
        },
      ]),
      layout(nodes, [{ id: 'e1', points: [{ x: 160, y: 96 }, { x: 160, y: 200 }] }]),
      FONT,
      measurer,
    )
    expect(geometries[0].label).toBeUndefined()
  })

  it('ребро без геометрии не ломает результат', () => {
    const geometries = buildEdgeGeometries(
      ir([{ id: 'e1', from: 'A', to: 'B', kind: 'solid', arrow: 'end' }]),
      layout(nodes, []),
      FONT,
      measurer,
    )
    expect(geometries[0].points).toEqual([])
  })
})
