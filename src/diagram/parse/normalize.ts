import {
  IR_VERSION,
  type DiagramIR,
  type Direction,
  type EdgeArrow,
  type EdgeKind,
  type IRGroup,
  type IRNode,
  type IREdge,
  type NodeRole,
} from '../ir'
import { parseLabel } from './label'

/**
 * Шаг [2] пайплайна: сырая модель mermaid -> наш IR.
 *
 * Здесь живёт вся «стандартизация»: маппинг фигур, отбрасывание пользовательских
 * стилей, приведение направлений и типов рёбер. Рендерер ничего не знает про mermaid.
 */

/** mermaid -> наши роли. */
const SHAPE_TO_ROLE: Record<string, NodeRole> = {
  square: 'box',
  rect: 'box',
  round: 'round',
  stadium: 'pill',
  circle: 'circle',
  doublecircle: 'circle',
  diamond: 'decision',
  question: 'decision',
  hexagon: 'hexagon',
  // ниже — экзотика: сводим к обычному блоку (стандартизация, см. docs/THEME.md §4)
  subroutine: 'box',
  cylinder: 'box',
  odd: 'box',
  lean_right: 'box',
  lean_left: 'box',
  trapezoid: 'box',
  inv_trapezoid: 'box',
  default: 'box',
}

const EXOTIC = new Set([
  'subroutine',
  'cylinder',
  'odd',
  'lean_right',
  'lean_left',
  'trapezoid',
  'inv_trapezoid',
])

const DIRECTION: Record<string, Direction> = {
  TB: 'TB',
  TD: 'TB', // mermaid обычно уже отдаёт TB, но на всякий случай
  BT: 'BT',
  LR: 'LR',
  RL: 'RL',
}

/** Класс, которым пользователь помечает акцентный узел. */
export const ACCENT_CLASS = 'accent'

function toArray<T>(maybeMap: unknown): T[] {
  if (maybeMap instanceof Map) return [...maybeMap.values()] as T[]
  if (maybeMap && typeof maybeMap === 'object') return Object.values(maybeMap) as T[]
  return []
}

function edgeKind(stroke: string | undefined): EdgeKind {
  if (stroke === 'dotted') return 'dashed'
  if (stroke === 'thick') return 'thick'
  return 'solid'
}

function edgeArrow(type: string | undefined): EdgeArrow {
  switch (type) {
    case 'double_arrow_point':
    case 'double_arrow_circle':
    case 'double_arrow_cross':
      return 'both'
    case 'arrow_open':
    case 'line':
      return 'none'
    default:
      return 'end'
  }
}

/** Находит конструкции, которые мы сознательно игнорируем, чтобы предупредить пользователя. */
function scanIgnored(source: string): string[] {
  const found: string[] = []
  const checks: Array<[RegExp, string]> = [
    [/\bclassDef\b/, 'classDef'],
    [/(^|\s)class\s+\S+\s+\S+/m, 'class'],
    [/(^|\s)style\s+\S+\s+/m, 'style'],
    [/\blinkStyle\b/, 'linkStyle'],
    [/\bclick\s+\S+/, 'click'],
    [/%%\{\s*init/, '%%{init}%%'],
  ]
  for (const [re, name] of checks) if (re.test(source)) found.push(name)
  return found
}

export function normalize(db: any, source: string): DiagramIR {
  const warnings: string[] = []

  const rawDirection: string | undefined = db.getDirection?.()
  const direction: Direction = DIRECTION[rawDirection ?? ''] ?? 'TB'

  const vertices = toArray<any>(db.getVertices?.())
  const rawEdges = toArray<any>(db.getEdges?.())
  const rawGroups = toArray<any>(db.getSubGraphs?.())

  // --- узлы ---------------------------------------------------------------
  const exotic: string[] = []
  const nodes: IRNode[] = vertices.map((v) => {
    const shape: string = v.type ?? v.shape ?? 'square'
    let role: NodeRole = SHAPE_TO_ROLE[shape] ?? 'box'
    if (EXOTIC.has(shape)) exotic.push(`${v.id} (${shape})`)

    const classes: string[] = Array.isArray(v.classes) ? v.classes : []
    if (classes.includes(ACCENT_CLASS)) role = 'accent'

    return {
      id: v.id as string,
      role,
      label: parseLabel(v.text as string, v.labelType as string),
    }
  })

  if (exotic.length) {
    warnings.push(
      `Экзотическая форма заменена на обычный блок: ${exotic.join(', ')}`,
    )
  }

  // --- группы (subgraph) --------------------------------------------------
  const nodeIds = new Set(nodes.map((n) => n.id))
  const groups: IRGroup[] = rawGroups.map((g) => ({
    id: g.id as string,
    label: parseLabel(g.title as string, g.labelType as string),
    nodeIds: ((g.nodes as string[]) ?? []).filter((id) => nodeIds.has(id)),
  }))

  // вложенность: узел получает parentId первой группы, где он встретился
  const parentOf = new Map<string, string>()
  for (const g of groups) {
    for (const id of g.nodeIds) if (!parentOf.has(id)) parentOf.set(id, g.id)
  }
  for (const n of nodes) {
    const parent = parentOf.get(n.id)
    if (parent) n.parentId = parent
  }

  // --- рёбра --------------------------------------------------------------
  const seenIds = new Set<string>()
  const edges: IREdge[] = rawEdges.map((e, i) => {
    let id = (e.id as string) || `edge-${i}`
    if (seenIds.has(id)) id = `${id}-${i}`
    seenIds.add(id)

    const label = parseLabel(e.text as string, e.labelType as string)
    return {
      id,
      from: e.start as string,
      to: e.end as string,
      kind: edgeKind(e.stroke as string),
      arrow: edgeArrow(e.type as string),
      ...(label.lines.length ? { label } : {}),
    }
  })

  // --- то, что мы проигнорировали -----------------------------------------
  const ignored = scanIgnored(source)
  if (ignored.length) {
    warnings.push(
      `Стили из разметки игнорируются (${ignored.join(', ')}): оформление задаётся только темой`,
    )
  }

  return { v: IR_VERSION, direction, nodes, edges, groups, warnings }
}
