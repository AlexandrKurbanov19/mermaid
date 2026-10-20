import { IR_VERSION, type StateIR, type StateNode, type StateNodeKind, type StateTransition, type StateGroup } from '../ir'
import { parseLabel } from './label'

/**
 * mermaid `stateDiagram-v2` -> StateIR.
 *
 * Источник данных — `db.getRootDocV2().doc` (проверено спайком):
 *   { stmt:'relation', state1:{id,start?}, state2:{...}, description }
 *   { stmt:'state', id, type: 'default'|'choice'|'fork'|'join', description, doc? }
 *
 * Composite (`state X { ... }`) приходит как state-запись с вложенным `doc`.
 * Мы расплющиваем его в группу (как subgraph во flowchart): вложенные узлы получают
 * parentId, а внешние переходы на/с composite перенаправляются на его старт/конец.
 */

interface DocState {
  id: string
  type?: string
  description?: string
  start?: boolean
}

interface DocItem {
  stmt: 'relation' | 'state'
  state1?: DocState
  state2?: DocState
  id?: string
  type?: string
  description?: string
  doc?: DocItem[]
}

const TYPE_TO_KIND: Record<string, StateNodeKind> = {
  choice: 'choice',
  fork: 'fork',
  join: 'join',
  divider: 'state',
}

function kindOf(s: DocState | undefined): StateNodeKind {
  if (s?.start === true) return 'start'
  if (s?.start === false) return 'end'
  return TYPE_TO_KIND[s?.type ?? ''] ?? 'state'
}

export function normalizeState(db: any, source: string): StateIR {
  const doc: DocItem[] = db.getRootDocV2?.().doc ?? []

  const nodeMap = new Map<string, { kind: StateNodeKind; description: string; parentId?: string }>()
  const groups: StateGroup[] = []
  const transitions: StateTransition[] = []

  const register = (s: DocState | undefined, parentId?: string) => {
    if (!s) return
    const id = String(s.id)
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { kind: kindOf(s), description: s.description ?? '', ...(parentId ? { parentId } : {}) })
    }
  }

  const process = (items: DocItem[], parentId?: string) => {
    for (const item of items) {
      if (item.stmt === 'relation') {
        register(item.state1, parentId)
        register(item.state2, parentId)
        transitions.push({
          id: `t-${transitions.length}`,
          from: String(item.state1!.id),
          to: String(item.state2!.id),
          ...(item.description ? { label: parseLabel(item.description, 'text') } : {}),
        })
      } else if (item.stmt === 'state') {
        const id = String(item.id)
        if (item.doc && Array.isArray(item.doc)) {
          // composite -> группа
          groups.push({ id, label: parseLabel(id), nodeIds: [] })
          process(item.doc, id)
        } else {
          const kind = TYPE_TO_KIND[item.type ?? ''] ?? 'state'
          const existing = nodeMap.get(id)
          nodeMap.set(id, {
            kind: existing && existing.kind !== 'state' ? existing.kind : kind,
            description: existing?.description || item.description || '',
            ...(parentId ? { parentId } : {}),
          })
        }
      }
    }
  }

  process(doc)

  // убрать узлы, которые оказались composite-группами, и направить внешние
  // переходы на/с группы на её внутренний старт/конец
  const groupIds = new Set(groups.map((g) => g.id))
  for (const id of groupIds) nodeMap.delete(id)

  for (const g of groups) {
    g.nodeIds = [...nodeMap.entries()].filter(([, v]) => v.parentId === g.id).map(([id]) => id)
  }

  const startOf = (groupId: string): string | undefined =>
    groups.find((g) => g.id === groupId)?.nodeIds.find((id) => nodeMap.get(id)?.kind === 'start')
  const endOf = (groupId: string): string | undefined =>
    groups.find((g) => g.id === groupId)?.nodeIds.find((id) => nodeMap.get(id)?.kind === 'end')

  for (const t of transitions) {
    if (groupIds.has(t.from)) {
      const innerEnd = endOf(t.from)
      if (innerEnd) t.from = innerEnd
    }
    if (groupIds.has(t.to)) {
      const innerStart = startOf(t.to)
      if (innerStart) t.to = innerStart
    }
  }

  const nodes: StateNode[] = [...nodeMap.entries()].map(([id, v]) => {
    const isMark = v.kind === 'start' || v.kind === 'end' || v.kind === 'fork' || v.kind === 'join'
    const label = isMark ? parseLabel('') : parseLabel(id)
    const description = v.description ? [parseLabel(v.description, 'text')] : []
    return { id, kind: v.kind, label, description, ...(v.parentId ? { parentId: v.parentId } : {}) }
  })

  return { v: IR_VERSION, type: 'state', nodes, transitions, groups, warnings: [] }
}
