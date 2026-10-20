import type { MindmapIR, MindNode } from '../ir'
import type { FontSpec, TextMeasurer } from '../measure/textMetrics'

/**
 * Раскладка mindmap: дерево слева направо (корень слева, ветви вправо).
 * Простой «блочный» алгоритм: у каждого узла высота = сумме высот детей,
 * лист занимает один слот.
 */

export interface MindPosition {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
}

export interface MindmapLayout {
  width: number
  height: number
  nodes: MindPosition[]
  edges: { from: string; to: string }[]
}

const NODE_H = 44
const V_GAP = 12
const H_GAP = 56
const PADDING = 32

export function layoutMindmap(ir: MindmapIR, measurer: TextMeasurer, font: FontSpec): MindmapLayout {
  const nodes: MindPosition[] = []
  const edges: { from: string; to: string }[] = []
  const maxDepth = { value: 0 }

  // ширина узла — по самому широкому тексту в поддереве
  const textOf = (n: MindNode) => n.text.lines.map((l) => l.map((r) => r.text).join('')).join(' ')
  const measure = (n: MindNode) => {
    const own = measurer.measure(textOf(n), font) + 32
    const childMax = Math.max(0, ...n.children.map(measure))
    return Math.max(own, childMax)
  }
  const nodeWidth = Math.max(120, measure(ir.root))

  // высота поддерева в слотах (лист = 1)
  const subtreeSlots = (n: MindNode): number => (n.children.length ? n.children.reduce((s, c) => s + subtreeSlots(c), 0) : 1)

  const place = (n: MindNode, depth: number, top: number): number => {
    const text = textOf(n)
    const total = subtreeSlots(n) * (NODE_H + V_GAP) - V_GAP
    const x = PADDING + depth * (nodeWidth + H_GAP)
    const y = top + total / 2 - NODE_H / 2
    nodes.push({ id: n.id, x, y, width: nodeWidth, height: NODE_H, text })
    maxDepth.value = Math.max(maxDepth.value, depth)

    let cursor = top
    for (const child of n.children) {
      edges.push({ from: n.id, to: child.id })
      cursor += place(child, depth + 1, cursor)
    }
    return total
  }

  const totalHeight = place(ir.root, 0, PADDING)

  return {
    width: PADDING * 2 + (maxDepth.value + 1) * (nodeWidth + H_GAP) - H_GAP,
    height: totalHeight + PADDING * 2,
    nodes,
    edges,
  }
}
