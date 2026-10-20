import { IR_VERSION, type StateIR, type StateNode, type StateTransition } from '../ir'
import { parseLabel } from './label'

/**
 * mermaid `stateDiagram-v2` -> StateIR.
 *
 * Что выяснил спайком (см. docs/SPEC-V2-RESEARCH.md):
 *  - db.getData().nodes: { id, shape, label, descriptions?, isGroup }
 *  - db.getRelations(): [{ id1, id2, relationTitle }]
 *  - start/end имеют id root_start/root_end и shape stateStart/stateEnd
 *  - `X : описание` кладёт описание В label (не в descriptions)
 *  - `<<choice>>`/`<<fork>>` НЕ меняют shape — стереотип живёт в classes (pass 2)
 *  - внутренние рёбра композитного состояния НЕ попадают в getRelations (pass 2)
 *
 * Поэтому pass 1: start/end + обычные состояния + переходы с подписями.
 * choice/fork/join/composite — отложены, отмечено в warnings.
 */

const SHAPE_TO_KIND: Record<string, StateNode['kind']> = {
  stateStart: 'start',
  stateEnd: 'end',
  state: 'state',
  rect: 'state', // mermaid отдаёт обычное состояние как rect
  roundedWithTitle: 'composite',
  composite: 'composite',
  default: 'state',
}

function toArray<T>(v: unknown): T[] {
  if (v instanceof Map) return [...v.values()] as T[]
  if (Array.isArray(v)) return v as T[]
  return []
}

export function normalizeState(db: any, source: string): StateIR {
  const warnings: string[] = []

  const dataNodes = toArray<any>(db.getData?.().nodes ?? [])
  const relations = toArray<any>(db.getRelations?.())

  const nodes: StateNode[] = dataNodes.map((n) => {
    const kind = SHAPE_TO_KIND[n.shape] ?? 'state'
    // старт/конец не имеют пользовательского текста
    const rawLabel = kind === 'start' || kind === 'end' ? '' : String(n.label ?? '')
    const label = parseLabel(rawLabel, n.labelType)

    return {
      id: String(n.id),
      kind,
      label,
      description: toArray<any>(n.descriptions).map((d) => parseLabel(String(d), n.labelType)),
    }
  })

  const transitions: StateTransition[] = relations.map((r, i) => ({
    id: `t-${i}`,
    from: String(r.id1),
    to: String(r.id2),
    ...(r.relationTitle ? { label: parseLabel(String(r.relationTitle), 'text') } : {}),
  }))

  if (dataNodes.some((n) => n.shape === 'roundedWithTitle' || n.isGroup)) {
    warnings.push('Вложенные (composite) состояния пока рисуются как обычные.')
  }

  return {
    v: IR_VERSION,
    type: 'state',
    nodes,
    transitions,
    warnings,
  }
}
