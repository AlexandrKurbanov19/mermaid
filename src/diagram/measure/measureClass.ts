import type { ClassIR, ClassNode } from '../ir'
import type { NodeBox } from './measureNode'
import type { FontSpec, TextMeasurer } from './textMetrics'

/**
 * Габариты class-блоков: имя + поля + методы (три секции).
 */

const PADDING = 14

/** Геометрия class-блока: рендер и замер используют ОДНИ числа. */
export const CLASS_GEOM = {
  nameCenter: 26,      // центр имени от верха
  divider1: 36,        // разделитель под именем
  fieldStart: 60,      // базовая линия первого поля (24 px от разделителя -> текст ~11 px)
  memberH: 22,         // высота строки члена
  divider2Offset: 10,  // зазор под последним полем до разделителя
  sectionGap: 24,      // ОДИНАКОВЫЙ зазор от разделителя до методов (как у полей)
  bottomPad: 14,
}

export interface ClassDetails {
  name: string
  fields: string[]
  methods: string[]
  annotations: string[]
}

export interface ClassMeasure {
  boxes: Record<string, NodeBox>
  details: Record<string, ClassDetails>
}

function memberLine(m: { visibility: string; text: string }): string {
  return `${m.visibility} ${m.text}`.trim()
}

export function measureClassNodes(
  ir: ClassIR,
  font: FontSpec,
  measurer: TextMeasurer,
): ClassMeasure {
  const boxes: Record<string, NodeBox> = {}
  const details: Record<string, ClassDetails> = {}

  for (const node of ir.nodes) {
    const name = node.name.lines.map((l) => l.map((r) => r.text).join('')).join(' ')
    const fields = node.fields.map(memberLine)
    const methods = node.methods.map(memberLine)
    const annotations = node.annotations

    const nameW = measurer.measure(name, { ...font, weight: 600 })
    const maxMember = Math.max(0, ...[...fields, ...methods].map((m) => measurer.measure(m, font)))
    const width = Math.max(120, Math.ceil(Math.max(nameW, maxMember)) + PADDING * 2)

    const rows = fields.length + methods.length
    const g = CLASS_GEOM
    const fieldsSection = fields.length ? fields.length * g.memberH + g.divider2Offset + g.sectionGap : 0
    const methodsSection = methods.length ? methods.length * g.memberH + g.sectionGap : 0
    const height = g.divider1 + fieldsSection + methodsSection + g.bottomPad

    boxes[node.id] = {
      width,
      height: Math.max(40, height),
      fit: { fontSize: 14, lineHeight: 18, lines: [], width: 0, height: 0, truncated: false },
    }
    details[node.id] = { name, fields, methods, annotations }
  }

  return { boxes, details }
}
