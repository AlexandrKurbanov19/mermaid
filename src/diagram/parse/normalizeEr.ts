import { IR_VERSION, type ERIR, type EntityNode, type Relationship } from '../ir'

/**
 * mermaid `erDiagram` -> ERIR.
 *
 * db.getEntities() — Map(name -> { id:'entity-NAME-0', label, attributes:[{type,name,keys[],comment}] })
 * db.getRelationships() — [{ entityA, roleA, entityB, relSpec:{cardA, relType, cardB} }]
 */

function toArray<T>(v: unknown): T[] {
  if (v instanceof Map) return [...v.values()] as T[]
  if (Array.isArray(v)) return v as T[]
  return []
}

export function normalizeEr(db: any, source: string): ERIR {
  const warnings: string[] = []
  const entitiesMap = db.getEntities?.() instanceof Map ? db.getEntities() : new Map<string, any>()

  const entities: EntityNode[] = []
  for (const [name, e] of entitiesMap) {
    entities.push({
      id: String(e.id ?? name),
      name: String(e.label ?? name),
      attributes: toArray<any>(e.attributes).map((a) => ({
        type: String(a.type ?? ''),
        name: String(a.name ?? ''),
        keys: toArray<string>(a.keys).map(String),
      })),
    })
  }

  const relationships: Relationship[] = toArray<any>(db.getRelationships?.()).map((r, i) => ({
    id: `rel-${i}`,
    from: String(r.entityA),
    to: String(r.entityB),
    ...(r.roleA ? { roleA: String(r.roleA) } : {}),
    // mermaid кладёт cardA у КОНЦА (entityB), cardB у НАЧАЛА (entityA) —
    // у нас cardA = «у from», cardB = «у to», поэтому меняем местами
    ...(r.relSpec?.cardB ? { cardA: String(r.relSpec.cardB) } : {}),
    ...(r.relSpec?.cardA ? { cardB: String(r.relSpec.cardA) } : {}),
    identifying: r.relSpec?.relType === 'IDENTIFYING',
  }))

  return { v: IR_VERSION, type: 'er', entities, relationships, warnings }
}
