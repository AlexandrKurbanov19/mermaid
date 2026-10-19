import {
  IR_VERSION,
  type FlowchartIR,
  type Direction,
  type EdgeArrow,
  type EdgeKind,
  type IRGroup,
  type GroupTone,
  type IRNode,
  type IREdge,
  type NodeRole,
  type TextBlock,
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
  // стандартные «непрямоугольные» блоки — сохраняем форму
  cylinder: 'cylinder',
  subroutine: 'subroutine',
  lean_right: 'parallelogram',
  lean_left: 'parallelogram',
  odd: 'chevron',
  // экзотика — сводим к обычному блоку
  trapezoid: 'box',
  inv_trapezoid: 'box',
  default: 'box',
}

const EXOTIC = new Set(['trapezoid', 'inv_trapezoid'])

const DIRECTION: Record<string, Direction> = {
  TB: 'TB',
  TD: 'TB', // mermaid обычно уже отдаёт TB, но на всякий случай
  BT: 'BT',
  LR: 'LR',
  RL: 'RL',
}

/** Классы-маркеры: единственный разрешённый способ влиять на вид узла. */
export const ACCENT_CLASS = 'accent'
export const SECONDARY_CLASS = 'secondary'
export const OUTLINE_CLASS = 'outline'
export const MUTED_CLASS = 'muted'

/**
 * Бейдж-номер: «1. Понять проблему» -> badge «1», лейбл «Понять проблему».
 * Регулярка требует пробел после точки/скобки и не больше 3 цифр,
 * поэтому «1.5 млн» и «2022 год» бейджами не становятся.
 */
const BADGE_RE = /^(\d{1,3})[.)]\s+/

function dropLeadingChars(runs: TextBlock['lines'][number], count: number): TextBlock['lines'][number] {
  let left = count
  const out: TextBlock['lines'][number] = []
  for (const run of runs) {
    if (left <= 0) {
      out.push(run)
      continue
    }
    if (run.text.length <= left) {
      left -= run.text.length
      continue
    }
    out.push({ ...run, text: run.text.slice(left) })
    left = 0
  }
  return out
}

export function extractBadge(label: TextBlock): { badge?: string; label: TextBlock } {
  if (!label.lines.length) return { label }

  const firstLine = label.lines[0]
  const text = firstLine.map((r) => r.text).join('')
  const match = BADGE_RE.exec(text)
  if (!match) return { label }

  const restFirstLine = dropLeadingChars(firstLine, match[0].length).filter((r) => r.text.length > 0)
  const lines = [restFirstLine, ...label.lines.slice(1)].filter((line) => line.length > 0)
  return { badge: match[1], label: { lines } }
}

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

export function normalize(db: any, source: string): FlowchartIR {
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
    else if (classes.includes(SECONDARY_CLASS)) role = 'secondary'
    else if (classes.includes(OUTLINE_CLASS)) role = 'outline'
    else if (classes.includes(MUTED_CLASS)) role = 'muted'

    const { badge, label } = extractBadge(parseLabel(v.text as string, v.labelType as string))

    return {
      id: v.id as string,
      role,
      label,
      ...(badge ? { badge } : {}),
    }
  })

  if (exotic.length) {
    warnings.push(
      `Экзотическая форма заменена на обычный блок: ${exotic.join(', ')}`,
    )
  }

  // --- группы (subgraph) --------------------------------------------------
  const nodeIds = new Set(nodes.map((n) => n.id))
  // Тон контейнера: архив использует зелёные и синие рамки.
  // Если пользователь явно пометил группу классом — уважаем, иначе чередуем accent/secondary.
  const groups: IRGroup[] = rawGroups.map((g, index) => {
    const classes: string[] = Array.isArray(g.classes) ? g.classes : []
    const explicit: GroupTone | undefined = classes.includes(SECONDARY_CLASS)
      ? 'secondary'
      : classes.includes(ACCENT_CLASS)
        ? 'accent'
        : undefined

    return {
      id: g.id as string,
      label: parseLabel(g.title as string, g.labelType as string),
      nodeIds: ((g.nodes as string[]) ?? []).filter((id) => nodeIds.has(id)),
      tone: explicit ?? (index % 2 === 0 ? 'accent' : 'secondary'),
    }
  })

  // Вложенные группы (subgraph внутри subgraph) mermaid отдаёт так, что во внешней
  // группе лежит id внутренней, а не её узлы. Наша модель групп плоская, поэтому честно
  // предупреждаем: нарисуется «рядом», а не «внутри».
  const groupIds = new Set(rawGroups.map((g) => g.id as string))
  const nested = rawGroups
    .filter((g) => ((g.nodes as string[]) ?? []).some((id) => groupIds.has(id)))
    .map((g) => (g.title as string) || (g.id as string))
  if (nested.length) {
    warnings.push(
      `Вложенные группы пока рисуются плоско (без вложенности): ${nested.join(', ')}`,
    )
  }

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

  return { v: IR_VERSION, type: 'flowchart', direction, nodes, edges, groups, warnings }
}
