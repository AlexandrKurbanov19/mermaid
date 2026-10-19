import ELK from 'elkjs/lib/elk.bundled.js'
import type { DiagramIR, Direction } from '../ir'
import type { NodeBox } from '../measure/measureNode'
import { size } from '../theme'

/**
 * Шаг [3] пайплайна: IR + габариты узлов -> координаты.
 *
 * ELK, а не dagre (дефолт mermaid), потому что в референсах Нетологии рёбра
 * ОРТОГОНАЛЬНЫЕ — прямые углы и вертикальные «падающие» стрелки.
 * ELK даёт это из коробки через `elk.edgeRouting: ORTHOGONAL`.
 */

export interface Point {
  x: number
  y: number
}

export interface NodePlacement {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface EdgePlacement {
  id: string
  points: Point[]
  /** точка для подписи ребра (середина самого длинного сегмента) */
  labelPoint?: Point
}

export interface Layout {
  width: number
  height: number
  nodes: Record<string, NodePlacement>
  edges: EdgePlacement[]
}

const DIRECTION_TO_ELK: Record<Direction, string> = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
}

/** Лэйаут синхронный по интерфейсу: ELK-промис просто дожидаемся наверху. */
const elk = new ELK()

export interface LayoutOptions {
  layerSpacing?: number
  nodeSpacing?: number
  padding?: number
}

export async function layoutDiagram(
  ir: DiagramIR,
  boxes: Record<string, NodeBox>,
  opts: LayoutOptions = {},
): Promise<Layout> {
  const padding = opts.padding ?? size.canvasPadding
  const layerSpacing = opts.layerSpacing ?? size.layerSpacing
  const nodeSpacing = opts.nodeSpacing ?? size.nodeSpacing

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': DIRECTION_TO_ELK[ir.direction],
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
      'elk.spacing.nodeNode': String(nodeSpacing),
      'elk.spacing.edgeNode': '24',
      'elk.spacing.edgeEdge': '16',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // Разрыв циклов по порядку объявления в разметке. По умолчанию ELK разворачивает
      // обратное ребро так, что узел «уезжает» в первый слой (в примере D вставал рядом с A).
      // MODEL_ORDER даёт ожидаемую картинку: A -> B -> {C, D}, а D -> B идёт обратно вверх.
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
      'elk.padding': `[top=${padding},left=${padding},bottom=${padding},right=${padding}]`,
    },
    children: ir.nodes.map((n) => ({
      id: n.id,
      width: boxes[n.id]?.width ?? size.nodeMinWidth,
      height: boxes[n.id]?.height ?? size.nodeMinHeight,
    })),
    edges: ir.edges.map((e) => ({
      id: e.id,
      sources: [e.from],
      targets: [e.to],
    })),
  }

  const result = await elk.layout(graph as any)

  const nodes: Record<string, NodePlacement> = {}
  for (const child of result.children ?? []) {
    nodes[child.id] = {
      id: child.id,
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? 0,
      height: child.height ?? 0,
    }
  }

  const edges: EdgePlacement[] = (result.edges ?? []).map((e: any) => {
    const section = e.sections?.[0]
    const points: Point[] = []
    if (section) {
      points.push({ x: section.startPoint.x, y: section.startPoint.y })
      for (const bp of section.bendPoints ?? []) points.push({ x: bp.x, y: bp.y })
      points.push({ x: section.endPoint.x, y: section.endPoint.y })
    }
    return { id: e.id, points, labelPoint: midpointOfLongestSegment(points) }
  })

  return {
    width: result.width ?? 0,
    height: result.height ?? 0,
    nodes,
    edges,
  }
}

/** Подпись ребра ставим в середину самого длинного сегмента — там она не наезжает на узлы. */
function midpointOfLongestSegment(points: Point[]): Point | undefined {
  if (points.length < 2) return undefined
  let best = { length: -1, point: undefined as Point | undefined }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length > best.length) {
      best = { length, point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
    }
  }
  return best.point
}

/** Скругление ортогональных углов: путь с дугами вместо острых стыков. */
export function buildOrthogonalPath(points: Point[], radius = 8): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x} ${points[0].y}`

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    const inLength = Math.hypot(curr.x - prev.x, curr.y - prev.y)
    const outLength = Math.hypot(next.x - curr.x, next.y - curr.y)
    const r = Math.min(radius, inLength / 2, outLength / 2)

    if (r < 0.5) {
      d += ` L ${curr.x} ${curr.y}`
      continue
    }

    const inDir = { x: (curr.x - prev.x) / inLength, y: (curr.y - prev.y) / inLength }
    const outDir = { x: (next.x - curr.x) / outLength, y: (next.y - curr.y) / outLength }

    const before = { x: curr.x - inDir.x * r, y: curr.y - inDir.y * r }
    const after = { x: curr.x + outDir.x * r, y: curr.y + outDir.y * r }

    d += ` L ${before.x} ${before.y} Q ${curr.x} ${curr.y} ${after.x} ${after.y}`
  }

  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}
