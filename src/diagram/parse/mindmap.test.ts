import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import { normalizeMindmap } from './normalizeMindmap'
import type { MindmapIR } from '../ir'

async function mm(source: string): Promise<MindmapIR> {
  mermaid.initialize({ startOnLoad: false })
  const r = await mermaid.mermaidAPI.getDiagramFromText(source)
  return normalizeMindmap(r.db, source)
}

describe('mindmap: парсинг', () => {
  it('строит дерево', async () => {
    const ir = await mm(`mindmap
  root(Корень)
    Ветка
      Лист`)
    const text = (n: any) => n.text.lines[0][0].text
    expect(text(ir.root)).toBe('Корень')
    expect(text(ir.root.children[0])).toBe('Ветка')
    expect(text(ir.root.children[0].children[0])).toBe('Лист')
  })
})
