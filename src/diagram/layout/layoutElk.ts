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
 *
 * Группы (subgraph) — настоящие кластеры ELK (`hierarchyHandling: INCLUDE_CHILDREN`),
 * поэтому для них резервируется место, а контейнеры не наезжают друг на друга.
 * Важная особенность ELK: координаты дочерних элементов ОТНОСИТЕЛЬНЫ родителя,
 * а координаты рёбер — относительно общего предка источника и цели. Всё это
 * приводим к абсолютным координатам холста.
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
  /** точка для подписи ребра */
  labelPoint?: Point
}

export interface GroupPlacement {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface Layout {
  width: number
  height: number
  nodes: Record<string, NodePlacement>
  groups: Record<string, GroupPlacement>
  edges: EdgePlacement[]
}

const DIRECTION_TO_ELK: Record<Direction, string> = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
}

const elk = new ELK()

export interface LayoutOptions {
  layerSpacing?: number
  nodeSpacing?: number
  padding?: number
}

/** Сколько места сверху занять под подпись группы. */
const GROUP_LABEL_SPACE = 28
const GROUP_PADDING_X = 20
const GROUP_PADDING_BOTTOM = 20

export async function layoutDiagram(
  ir: DiagramIR,
  boxes: Record<string, NodeBox>,
  opts: LayoutOptions = {},
): Promise<Layout> {
  const padding = opts.padding ?? size.canvasPadding
  const layerSpacing = opts.layerSpacing ?? size.layerSpacing
  const nodeSpacing = opts.nodeSpacing ?? size.nodeSpacing

  const groupIds = new Set(ir.groups.map((g) => g.id))
  const parentOf = new Map<string, string>()
  for (const node of ir.nodes) {
    if (node.parentId && groupIds.has(node.parentId)) parentOf.set(node.id, node.parentId)
  }

  const nodeToElk = (id: string) => ({
    id,
    width: boxes[id]?.width ?? size.nodeMinWidth,
    height: boxes[id]?.height ?? size.nodeMinHeight,
  })

  // узлы вне групп — прямые дети корня
  const rootChildren: any[] = ir.nodes.filter((n) => !parentOf.has(n.id)).map((n) => nodeToElk(n.id))

  // группы — кластеры с внутренними отступами под подпись
  for (const group of ir.groups) {
    const members = ir.nodes.filter((n) => parentOf.get(n.id) === group.id).map((n) => nodeToElk(n.id))
    rootChildren.push({
      id: group.id,
      children: members,
      layoutOptions: {
        'elk.padding': `[top=${GROUP_LABEL_SPACE + 16},left=${GROUP_PADDING_X},bottom=${GROUP_PADDING_BOTTOM},right=${GROUP_PADDING_X}]`,
        'elk.spacing.nodeNode': String(nodeSpacing),
      },
    })
  }

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': DIRECTION_TO_ELK[ir.direction],
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
      'elk.spacing.nodeNode': String(nodeSpacing),
      'elk.spacing.edgeNode': '24',
      'elk.spacing.edgeEdge': '16',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // Разрыв циклов по порядку объявления в разметке. По умолчанию ELK разворачивает
      // обратное ребро так, что узел «уезжает» в первый слой (в примере D вставал рядом с A).
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
      'elk.padding': `[top=${padding},left=${padding},bottom=${padding},right=${padding}]`,
    },
    children: rootChildren,
    edges: ir.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
  }

  const result = await elk.layout(graph as any)

  const nodes: Record<string, NodePlacement> = {}
  const groups: Record<string, GroupPlacement> = {}

  // абсолютные координаты: у корневых детей они уже абсолютные, у внуков — относительные
  for (const child of result.children ?? []) {
    const isGroup = groupIds.has(child.id)
    if (isGroup) {
      const gx = child.x ?? 0
      const gy = child.y ?? 0
      groups[child.id] = {
        id: child.id,
        x: gx,
        y: gy,
        width: child.width ?? 0,
        height: child.height ?? 0,
      }
      for (const inner of child.children ?? []) {
        nodes[inner.id] = {
          id: inner.id,
          x: gx + (inner.x ?? 0),
          y: gy + (inner.y ?? 0),
          width: inner.width ?? 0,
          height: inner.height ?? 0,
        }
      }
    } else {
      nodes[child.id] = {
        id: child.id,
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? 0,
        height: child.height ?? 0,
      }
    }
  }

  const nodeBoxes = Object.values(nodes)

  const edges: EdgePlacement[] = (result.edges ?? []).map((e: any) => {
    const section = e.sections?.[0]
    const points: Point[] = []
    if (section) {
      points.push({ x: section.startPoint.x, y: section.startPoint.y })
      for (const bp of section.bendPoints ?? []) points.push({ x: bp.x, y: bp.y })
      points.push({ x: section.endPoint.x, y: section.endPoint.y })
    }

    // координаты ребра относительны общего предка концов
    const irEdge = ir.edges.find((x) => x.id === e.id)
    const offset = offsetForEdge(irEdge?.from, irEdge?.to, parentOf, groups)

    const absolute = points.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }))
    return { id: e.id, points: absolute, labelPoint: pickLabelPoint(absolute, nodeBoxes) }
  })

  return {
    width: result.width ?? 0,
    height: result.height ?? 0,
    nodes,
    groups,
    edges,
  }
}

/**
 * ELK возвращает координаты ребра относительно ближайшего общего предка его концов:
 * внутри группы — координаты группы, между группами — координаты корня.
 */
function offsetForEdge(
  from: string | undefined,
  to: string | undefined,
  parentOf: Map<string, string>,
  groups: Record<string, GroupPlacement>,
): Point {
  if (!from || !to) return { x: 0, y: 0 }
  const fromGroup = parentOf.get(from)
  const toGroup = parentOf.get(to)
  if (fromGroup && fromGroup === toGroup) {
    const g = groups[fromGroup]
    if (g) return { x: g.x, y: g.y }
  }
  return { x: 0, y: 0 }
}

/**
 * Точка для подписи ребра: середина самого длинного сегмента, который не попадает
 * внутрь узла (иначе подпись наезжает на блок).
 */
function pickLabelPoint(points: Point[], nodes: NodePlacement[]): Point | undefined {
  if (points.length < 2) return undefined

  const segments = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    segments.push({
      length: Math.hypot(b.x - a.x, b.y - a.y),
      point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    })
  }
  segments.sort((s1, s2) => s2.length - s1.length)

  const insideNode = (p: Point) =>
    nodes.some((n) => p.x > n.x - 4 && p.x < n.x + n.width + 4 && p.y > n.y - 4 && p.y < n.y + n.height + 4)

  const free = segments.find((s) => s.length > 24 && !insideNode(s.point))
  return (free ?? segments[0])?.point
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
