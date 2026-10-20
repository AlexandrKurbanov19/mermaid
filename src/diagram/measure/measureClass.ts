import type { ClassIR, ClassNode } from '../ir'
import type { NodeBox } from './measureNode'
import type { FontSpec, TextMeasurer } from './textMetrics'

/**
 * Габариты class-блоков: имя + поля + методы (три секции).
 */

const PADDING = 14
const NAME_H = 28
const MEMBER_H = 20
const GAP = 6

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
    const height = NAME_H + (fields.length ? fields.length * MEMBER_H + GAP : 0) + (methods.length ? methods.length * MEMBER_H + GAP : 0) + 12

    boxes[node.id] = {
      width,
      height: Math.max(40, height),
      fit: { fontSize: 14, lineHeight: 18, lines: [], width: 0, height: 0, truncated: false },
    }
    details[node.id] = { name, fields, methods, annotations }
  }

  return { boxes, details }
}
