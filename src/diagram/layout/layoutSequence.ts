import type { SequenceIR, SeqBlockKind } from '../ir'
import type { FontSpec, TextMeasurer } from '../measure/textMetrics'

/**
 * Раскладка sequence: колонки-актёры, строки-сообщения, фреймы блоков.
 * Простая вертикальная раскладка (не ELK).
 */

export interface SeqFrame {
  block: SeqBlockKind
  text: string
  y1: number
  y2: number
  elseLines: { y: number; text: string }[]
}

export interface SeqRow {
  id: string
  y: number
  kind: 'message' | 'note' | 'blockStart' | 'blockElse' | 'blockEnd'
  from?: number
  to?: number
  text: string
  style?: 'solid' | 'dashed'
  /** для заметок: placement 0=слева, 1=справа, 2=над */
  placement?: number
}

export interface SeqActivation {
  x: number
  y1: number
  y2: number
}

export interface SeqLayout {
  width: number
  height: number
  actors: { id: string; name: string; x: number; width: number }[]
  rows: SeqRow[]
  frames: SeqFrame[]
  activations: SeqActivation[]
}

const ACTOR_WIDTH = 150
const ACTOR_GAP = 40
const HEADER = 56
const ROW_H = 44
const MARGIN = 40

export function layoutSequence(ir: SequenceIR, measurer: TextMeasurer, font: FontSpec): SeqLayout {
  const actors = ir.actors.length
    ? ir.actors
    : [{ id: 'A', name: 'A', kind: 'participant' as const }]

  const actorWidths = actors.map((a) => Math.max(ACTOR_WIDTH, measurer.measure(a.name, font) + 40))
  const positions: { id: string; name: string; x: number; width: number }[] = []
  let left = MARGIN
  actors.forEach((a, i) => {
    const width = actorWidths[i]
    positions.push({ id: a.id, name: a.name, x: left + width / 2, width })
    left += width + ACTOR_GAP
  })

  const rows: SeqRow[] = []
  const frames: SeqFrame[] = []
  const activations: SeqActivation[] = []
  const stack: { frame: SeqFrame; block: SeqBlockKind }[] = []
  const activeStack = new Map<string, number[]>()

  const xOf = (id: string) => positions.find((p) => p.id === id)?.x ?? positions[0].x

  ir.items.forEach((item, i) => {
    const y = HEADER + i * ROW_H + ROW_H / 2

    switch (item.kind) {
      case 'message':
        rows.push({ id: item.id, y, kind: 'message', from: xOf(item.from), to: xOf(item.to), text: item.text, style: item.style })
        break
      case 'note':
        rows.push({
          id: item.id,
          y,
          kind: 'note',
          from: xOf(item.from),
          ...(item.to ? { to: xOf(item.to) } : {}),
          text: item.text,
          placement: item.placement,
        })
        break
      case 'activate': {
        const stackFor = activeStack.get(item.from) ?? []
        stackFor.push(y)
        activeStack.set(item.from, stackFor)
        break
      }
      case 'deactivate': {
        const stackFor = activeStack.get(item.from) ?? []
        const y1 = stackFor.pop()
        if (y1 !== undefined) activations.push({ x: xOf(item.from), y1, y2: y })
        break
      }
      case 'blockStart': {
        const frame: SeqFrame = { block: item.block, text: item.text, y1: y - ROW_H / 2, y2: y, elseLines: [] }
        frames.push(frame)
        stack.push({ frame, block: item.block })
        rows.push({ id: item.id, y, kind: 'blockStart', text: item.text })
        break
      }
      case 'blockElse':
        if (stack.length) stack[stack.length - 1].frame.elseLines.push({ y, text: item.text })
        rows.push({ id: item.id, y, kind: 'blockElse', text: item.text })
        break
      case 'blockEnd': {
        const top = stack.pop()
        if (top) top.frame.y2 = y + ROW_H / 2
        rows.push({ id: item.id, y, kind: 'blockEnd', text: '' })
        break
      }
    }
  })

  const lastActor = positions[positions.length - 1]
  const width = (lastActor ? lastActor.x + lastActor.width / 2 : MARGIN) + MARGIN
  const height = HEADER + ir.items.length * ROW_H + MARGIN

  return { width, height, actors: positions, rows, frames, activations }
}
