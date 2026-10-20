import { IR_VERSION, type StateIR, type StateNode, type StateNodeKind, type StateTransition } from '../ir'
import { parseLabel } from './label'

/**
 * mermaid `stateDiagram-v2` -> StateIR.
 *
 * Источник данных — `db.getRootDocV2().doc` (проверено спайком):
 *   { stmt:'relation', state1:{id,type,description,start?,end?}, state2:{...}, description }
 *   { stmt:'state', id, type: 'default'|'choice'|'fork'|'join'|'composite'|'divider' }
 *
 * getData().nodes НЕ показывает choice (shape там 'rect'), поэтому спайк привёл
 * именно к getRootDocV2.
 */

interface DocState {
  id: string
  type?: string
  description?: string
  start?: boolean
  end?: boolean
}

interface DocItem {
  stmt: 'relation' | 'state'
  state1?: DocState
  state2?: DocState
  id?: string
  type?: string
  description?: string
}

const TYPE_TO_KIND: Record<string, StateNodeKind> = {
  choice: 'choice',
  fork: 'fork',
  join: 'join',
  composite: 'composite',
  divider: 'state',
}

function kindOf(s: DocState | undefined): StateNodeKind {
  // root_start имеет start:true, root_end — start:false (это и есть маркеры)
  if (s?.start === true) return 'start'
  if (s?.start === false) return 'end'
  return TYPE_TO_KIND[s?.type ?? ''] ?? 'state'
}

export function normalizeState(db: any, source: string): StateIR {
  const warnings: string[] = []
  const doc: DocItem[] = db.getRootDocV2?.().doc ?? []

  const nodeMap = new Map<string, { kind: StateNodeKind; description: string }>()

  const ensure = (s: DocState | undefined) => {
    if (!s) return
    if (!nodeMap.has(s.id)) {
      nodeMap.set(s.id, { kind: kindOf(s), description: s.description ?? '' })
    }
  }

  const transitions: StateTransition[] = []

  for (const item of doc) {
    if (item.stmt === 'relation') {
      ensure(item.state1)
      ensure(item.state2)
      transitions.push({
        id: `t-${transitions.length}`,
        from: String(item.state1!.id),
        to: String(item.state2!.id),
        ...(item.description ? { label: parseLabel(item.description, 'text') } : {}),
      })
    } else if (item.stmt === 'state') {
      const id = String(item.id)
      // композит определяется вложенным doc, а не type (type там 'default')
      const kind: StateNodeKind = (item as any).doc && Array.isArray((item as any).doc)
        ? 'composite'
        : TYPE_TO_KIND[item.type ?? ''] ?? 'state'
      const existing = nodeMap.get(id)
      nodeMap.set(id, {
        kind: existing && existing.kind !== 'state' ? existing.kind : kind,
        description: existing?.description || item.description || '',
      })
    }
  }

  const nodes: StateNode[] = [...nodeMap.entries()].map(([id, v]) => {
    const isMark = v.kind === 'start' || v.kind === 'end' || v.kind === 'fork' || v.kind === 'join'
    const label = isMark ? parseLabel('') : parseLabel(id)
    const description = v.description ? [parseLabel(v.description, 'text')] : []
    return { id, kind: v.kind, label, description }
  })

  if (nodes.some((n) => n.kind === 'composite')) {
    warnings.push('Вложенные (composite) состояния пока рисуются как обычные.')
  }

  return { v: IR_VERSION, type: 'state', nodes, transitions, warnings }
}
