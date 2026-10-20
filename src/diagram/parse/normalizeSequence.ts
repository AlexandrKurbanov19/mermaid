import { IR_VERSION, type SequenceIR, type SeqActor, type SeqItem, type SeqBlockKind } from '../ir'

/**
 * mermaid `sequenceDiagram` -> SequenceIR.
 *
 * db.getMessages() — плоский список с числовыми типами (выяснено спайком):
 *   0 solid (->>), 1 dashed (-->>), 2 note,
 *   10 loop start, 11 loop end, 12 alt start, 13 else, 14 alt end,
 *   15 opt start, 16 opt end, 17 activate, 18 deactivate,
 *   19 par start, 20 par-and, 21 par end, 22 rect start, 23 rect end.
 *
 * pass 1: активации (17/18) игнорируются (бары на lifeline — позже).
 */

const BLOCK_START: Record<number, SeqBlockKind> = {
  10: 'loop',
  12: 'alt',
  15: 'opt',
  19: 'par',
  22: 'rect',
}

const BLOCK_END = new Set([11, 14, 16, 21, 23])

function toArray<T>(v: unknown): T[] {
  if (v instanceof Map) return [...v.values()] as T[]
  if (Array.isArray(v)) return v as T[]
  return []
}

export function normalizeSequence(db: any, source: string): SequenceIR {
  const warnings: string[] = []
  const actorKeys = toArray<string>(db.getActorKeys?.())
  const actorsMap: Map<string, any> = db.getActors?.() instanceof Map ? db.getActors() : new Map()

  const actors: SeqActor[] = actorKeys.map((id) => {
    const actor = actorsMap.get(id) as any
    return { id, name: actor?.name ?? id, kind: actor?.type === 'actor' ? 'actor' : 'participant' }
  })

  const messages = toArray<any>(db.getMessages?.())
  const items: SeqItem[] = []
  let skippedActivation = false

  for (const m of messages) {
    const type: number = m.type
    const text = String(m.message ?? '').trim()

    if (type === 0 || type === 1) {
      items.push({
        kind: 'message',
        id: String(m.id),
        from: String(m.from),
        to: String(m.to),
        text,
        style: type === 1 ? 'dashed' : 'solid',
      })
    } else if (type === 2) {
      items.push({ kind: 'note', id: String(m.id), text, from: String(m.from ?? actorKeys[0] ?? '') })
    } else if (BLOCK_START[type]) {
      items.push({ kind: 'blockStart', id: String(m.id), block: BLOCK_START[type], text })
    } else if (type === 13 || type === 20) {
      items.push({ kind: 'blockElse', id: String(m.id), text })
    } else if (BLOCK_END.has(type)) {
      items.push({ kind: 'blockEnd', id: String(m.id) })
    } else if (type === 17 || type === 18) {
      skippedActivation = true
    }
  }

  if (skippedActivation) {
    warnings.push('Бары активации (activate/deactivate) пока не рисуются.')
  }

  return { v: IR_VERSION, type: 'sequence', actors, items, warnings }
}
