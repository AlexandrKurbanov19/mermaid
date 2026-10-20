import type { ERIR } from '../ir'
import type { NodeBox } from './measureNode'
import type { FontSpec, TextMeasurer } from './textMetrics'

const PADDING = 14

/** Геометрия ER-сущности: те же отступы, что у class. */
export const ER_GEOM = {
  nameCenter: 26,
  divider: 36,
  attrStart: 60,   // базовая линия первого атрибута
  attrH: 22,
  bottomPad: 14,
}

export interface EntityDetails {
  name: string
  attributes: { line: string; keys: string[] }[]
}

export interface ErMeasure {
  boxes: Record<string, NodeBox>
  details: Record<string, EntityDetails>
}

export function measureErNodes(ir: ERIR, font: FontSpec, measurer: TextMeasurer): ErMeasure {
  const boxes: Record<string, NodeBox> = {}
  const details: Record<string, EntityDetails> = {}

  for (const e of ir.entities) {
    const attrs = e.attributes.map((a) => ({ line: `${a.type} ${a.name}`.trim(), keys: a.keys }))
    const nameW = measurer.measure(e.name, { ...font, weight: 600 })
    const maxAttr = Math.max(0, ...attrs.map((a) => measurer.measure(a.line, font)))
    const width = Math.max(120, Math.ceil(Math.max(nameW, maxAttr)) + PADDING * 2 + 24)
    const height = ER_GEOM.divider + attrs.length * ER_GEOM.attrH + ER_GEOM.bottomPad

    boxes[e.id] = {
      width,
      height: Math.max(40, height),
      fit: { fontSize: 14, lineHeight: 18, lines: [], width: 0, height: 0, truncated: false },
    }
    details[e.id] = { name: e.name, attributes: attrs }
  }

  return { boxes, details }
}
