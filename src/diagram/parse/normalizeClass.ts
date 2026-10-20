import { IR_VERSION, type ClassIR, type ClassNode, type ClassRelation, type ClassRelationStyle } from '../ir'
import { parseLabel } from './label'

/**
 * mermaid `classDiagram` -> ClassIR.
 *
 * db.getClasses() — Map(id -> {label, methods:[{visibility,text,returnType}], members:[...], annotations[]})
 * db.getRelations() — [{id1,id2,relation:{type1,type2,lineType}, relationTitle1, relationTitle2, title}]
 *
 * Стрелки (спайк): type1/type2: 0=агрегация, 1=наследование, 2=композиция, 3=ассоциация;
 * lineType: 0=сплошная, 1=пунктир (dependency).
 */

function toArray<T>(v: unknown): T[] {
  if (v instanceof Map) return [...v.values()] as T[]
  if (Array.isArray(v)) return v as T[]
  return []
}

function cleanMember(m: any): string {
  // mermaid экранирует знаки видимости: \+String name -> +String name.
  // Знак видимости уже есть в m.visibility, поэтому из текста его убираем.
  return String(m.text ?? '')
    .replace(/\\\+/g, '+')
    .replace(/\\-/g, '-')
    .replace(/\\#/g, '#')
    .replace(/\\~/g, '~')
    .replace(/^[+#~-]/, '')
}

function relationStyle(type1: any, type2: any, lineType: number): ClassRelationStyle {
  if (type1 === 1 || type2 === 1) return 'inheritance'
  if (type1 === 2 || type2 === 2) return 'composition'
  if (type1 === 0 || type2 === 0) return 'aggregation'
  if (lineType === 1) return 'dependency'
  return 'association'
}

export function normalizeClass(db: any, source: string): ClassIR {
  const warnings: string[] = []
  const classesMap = db.getClasses?.() instanceof Map ? db.getClasses() : new Map<string, any>()

  const nodes: ClassNode[] = []
  for (const [id, c] of classesMap) {
    nodes.push({
      id: String(id),
      name: parseLabel(String(c.label ?? c.text ?? id), c.labelType),
      fields: toArray<any>(c.members).map((m) => ({ visibility: String(m.visibility ?? ''), text: cleanMember(m) })),
      methods: toArray<any>(c.methods).map((m) => ({ visibility: String(m.visibility ?? ''), text: cleanMember(m) })),
      annotations: toArray<string>(c.annotations).map(String),
    })
  }

  const relations: ClassRelation[] = toArray<any>(db.getRelations?.()).map((r, i) => ({
    id: `cr-${i}`,
    from: String(r.id1),
    to: String(r.id2),
    style: relationStyle(r.relation?.type1, r.relation?.type2, r.relation?.lineType ?? 0),
    ...(r.title && r.title !== 'none' ? { title: String(r.title) } : {}),
    ...(r.relationTitle1 && r.relationTitle1 !== 'none' ? { fromLabel: String(r.relationTitle1) } : {}),
    ...(r.relationTitle2 && r.relationTitle2 !== 'none' ? { toLabel: String(r.relationTitle2) } : {}),
  }))

  return { v: IR_VERSION, type: 'class', nodes, relations, warnings }
}
