import { IR_VERSION, type MindmapIR, type MindNode } from '../ir'
import { parseLabel } from './label'

/**
 * mermaid `mindmap` -> MindmapIR.
 * db.getMindmap() отдаёт уже собранное дерево: { nodeId, descr, children[] }.
 */

interface RawMindNode {
  nodeId?: string
  descr?: string
  children?: RawMindNode[]
}

function convert(raw: RawMindNode): MindNode {
  return {
    id: String(raw.nodeId ?? 'node'),
    text: parseLabel(String(raw.descr ?? '')),
    children: (raw.children ?? []).map(convert),
  }
}

export function normalizeMindmap(db: any, source: string): MindmapIR {
  const warnings: string[] = []
  const raw = db.getMindmap?.()
  const root = raw ? convert(raw) : { id: 'root', text: parseLabel(''), children: [] }

  return { v: IR_VERSION, type: 'mindmap', root, warnings }
}
