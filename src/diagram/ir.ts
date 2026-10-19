/**
 * DiagramIR — наш собственный DSL (промежуточное представление).
 *
 * Зачем: mermaid.db — внутренний API библиотеки, его формат не наш контракт.
 * Здесь мы фиксируем СВОЙ стабильный формат, в котором:
 *   - нет цветов/шрифтов/координат (это тема и лэйаут),
 *   - нет особенностей синтаксиса mermaid,
 *   - зато есть всё, что нужно рендереру.
 *
 * Версия обязательна: рендерер и тесты опираются на неё.
 */

export const IR_VERSION = 1 as const

export type Direction = 'TB' | 'BT' | 'LR' | 'RL'

/**
 * Визуальные «кирпичи». Их меньше, чем фигур в mermaid — это и есть стандартизация:
 * экзотические фигуры сводятся к box, чтобы схема выглядела единообразно.
 */
export type NodeRole =
  | 'box' // A[текст]
  | 'round' // A(текст)
  | 'pill' // A([текст]) — стадион, начало/конец
  | 'circle' // A((текст))
  | 'hexagon' // A{{текст}}
  | 'decision' // A{текст} — ромб
  | 'accent' // A:::accent — брендовая заливка (градиент)
  | 'muted' // A:::muted — пунктирная рамка, «необязательный/будущий» шаг

/** Фрагмент текста с начертанием: лейблы в mermaid умеют markdown. */
export interface InlineRun {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
}

/** Разобранная подпись: массив строк, каждая — массив прогонов. */
export interface TextBlock {
  lines: InlineRun[][]
}

export type EdgeKind = 'solid' | 'dashed' | 'thick'
export type EdgeArrow = 'end' | 'both' | 'none'

export interface IRNode {
  id: string
  role: NodeRole
  label: TextBlock
  /** id группы (subgraph), если узел вложен */
  parentId?: string
}

export interface IREdge {
  id: string
  from: string
  to: string
  kind: EdgeKind
  arrow: EdgeArrow
  label?: TextBlock
}

export interface IRGroup {
  id: string
  label?: TextBlock
  nodeIds: string[]
}

export interface DiagramIR {
  v: typeof IR_VERSION
  direction: Direction
  nodes: IRNode[]
  edges: IREdge[]
  groups: IRGroup[]
  /** Не ошибки, а «мы это проигнорировали» — показываем пользователю. */
  warnings: string[]
}
