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
 * Формат размеченный: `type` определяет, какой набор полей заполнен.
 */

export const IR_VERSION = 1 as const

export type DiagramType = 'flowchart' | 'timeline' | 'state' | 'sequence' | 'class' | 'er' | 'mindmap'

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
  | 'chevron' // A>текст] — фигурный блок-стрелка
  | 'cylinder' // A[(текст)] — база данных
  | 'subroutine' // A[[текст]] — процедура/функция
  | 'parallelogram' // A[/текст/] и A[\текст\] — ввод/вывод
  | 'doublecircle' // A(((текст))) — двойной круг
  | 'trapezoid' // A[/текст\] — трапеция (верх уже)
  | 'inv_trapezoid' // A[\текст/] — перевёрнутая трапеция (низ уже)
  | 'decision' // A{текст} — ромб
  | 'accent' // A:::accent — брендовая заливка (градиент)
  | 'secondary' // A:::secondary — вторичный (синий) акцент
  | 'outline' // A:::outline — белая карточка с акцентной обводкой
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
  /** номер/буква в кружке слева: «1» из «1. Понять проблему» */
  badge?: string
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

/** Тон контейнера группы: в архиве рамки зелёные, синие и серые. */
export type GroupTone = 'accent' | 'secondary' | 'neutral'

export interface IRGroup {
  id: string
  label?: TextBlock
  nodeIds: string[]
  tone: GroupTone
}

interface BaseIR {
  v: typeof IR_VERSION
  type: DiagramType
  /** `title ...` из разметки */
  title?: string
  /** Не ошибки, а «мы это проигнорировали» — показываем пользователю. */
  warnings: string[]
}

export interface FlowchartIR extends BaseIR {
  type: 'flowchart'
  direction: Direction
  nodes: IRNode[]
  edges: IREdge[]
  groups: IRGroup[]
}

/** Точка на таймлайне: кружок + подпись сверху/снизу. */
export interface TimelinePoint {
  id: string
  /** текст внутри кружка: «2022», «1» */
  label: TextBlock
  /** заголовок подписи (semibold) */
  title?: TextBlock
  /** детали под заголовком */
  events: TextBlock[]
  /** id дорожки (из `section`) */
  laneId?: string
}

/** Дорожка = `section` в mermaid timeline. */
export interface TimelineLane {
  id: string
  label?: TextBlock
  pointIds: string[]
}

export interface TimelineIR extends BaseIR {
  type: 'timeline'
  points: TimelinePoint[]
  lanes: TimelineLane[]
}

export type StateNodeKind =
  | 'start' // [*] начало
  | 'end' // [*] конец
  | 'state' // обычное состояние
  | 'choice' // <<choice>> — ромб-ветвление
  | 'fork' // <<fork>> — разветвление
  | 'join' // <<join>> — слияние
  | 'composite' // вложенное состояние (рисуем как обычное)

export interface StateNode {
  id: string
  kind: StateNodeKind
  label: TextBlock
  description: TextBlock[]
  /** id composite-состояния, если узел вложен в него */
  parentId?: string
}

export interface StateGroup {
  id: string
  label?: TextBlock
  nodeIds: string[]
}

export interface StateTransition {
  id: string
  from: string
  to: string
  label?: TextBlock
}

export interface StateIR extends BaseIR {
  type: 'state'
  nodes: StateNode[]
  transitions: StateTransition[]
  groups: StateGroup[]
}

export interface SeqActor {
  id: string
  name: string
  kind: 'participant' | 'actor'
}

export type SeqBlockKind = 'loop' | 'alt' | 'opt' | 'par' | 'rect'

export type SeqItem =
  | { kind: 'message'; id: string; from: string; to: string; text: string; style: 'solid' | 'dashed' }
  | { kind: 'note'; id: string; text: string; from: string }
  | { kind: 'blockStart'; id: string; block: SeqBlockKind; text: string }
  | { kind: 'blockElse'; id: string; text: string }
  | { kind: 'blockEnd'; id: string }

export interface SequenceIR extends BaseIR {
  type: 'sequence'
  actors: SeqActor[]
  items: SeqItem[]
}

export interface ClassMember {
  visibility: string // + - # ~
  text: string
}

export type ClassRelationStyle = 'inheritance' | 'aggregation' | 'composition' | 'association' | 'dependency'

export interface ClassNode {
  id: string
  name: TextBlock
  fields: ClassMember[]
  methods: ClassMember[]
  annotations: string[]
}

export interface ClassRelation {
  id: string
  from: string
  to: string
  title?: string
  fromLabel?: string
  toLabel?: string
  style: ClassRelationStyle
}

export interface ClassIR extends BaseIR {
  type: 'class'
  nodes: ClassNode[]
  relations: ClassRelation[]
}

export interface EntityAttribute {
  type: string
  name: string
  keys: string[]
}

export interface EntityNode {
  id: string
  name: string
  attributes: EntityAttribute[]
}

export interface Relationship {
  id: string
  from: string
  to: string
  roleA?: string
  /** кардинальность, как отдал mermaid: ZERO_OR_MORE, ONLY_ONE, ONE_OR_MORE, ZERO_OR_ONE */
  cardA?: string
  cardB?: string
  identifying: boolean
}

export interface ERIR extends BaseIR {
  type: 'er'
  entities: EntityNode[]
  relationships: Relationship[]
}

export interface MindNode {
  id: string
  text: TextBlock
  children: MindNode[]
}

export interface MindmapIR extends BaseIR {
  type: 'mindmap'
  root: MindNode
}

export type DiagramIR = FlowchartIR | TimelineIR | StateIR | SequenceIR | ClassIR | ERIR | MindmapIR

export const isFlowchart = (ir: DiagramIR): ir is FlowchartIR => ir.type === 'flowchart'
export const isTimeline = (ir: DiagramIR): ir is TimelineIR => ir.type === 'timeline'
export const isState = (ir: DiagramIR): ir is StateIR => ir.type === 'state'
export const isSequence = (ir: DiagramIR): ir is SequenceIR => ir.type === 'sequence'
export const isClass = (ir: DiagramIR): ir is ClassIR => ir.type === 'class'
export const isEr = (ir: DiagramIR): ir is ERIR => ir.type === 'er'
export const isMindmap = (ir: DiagramIR): ir is MindmapIR => ir.type === 'mindmap'
