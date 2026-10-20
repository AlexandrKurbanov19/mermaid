import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import { normalizeSequence } from './normalizeSequence'
import type { SequenceIR } from '../ir'

async function seq(source: string): Promise<SequenceIR> {
  mermaid.initialize({ startOnLoad: false })
  const r = await mermaid.mermaidAPI.getDiagramFromText(source)
  return normalizeSequence(r.db, source)
}

describe('sequence: парсинг', () => {
  it('актёры и типы сообщений', async () => {
    const ir = await seq(`sequenceDiagram
    Client->>API: запрос
    API-->>Client: ответ`)
    expect(ir.actors.map((a) => a.name)).toEqual(['Client', 'API'])
    expect(ir.items.map((i) => (i.kind === 'message' ? i.style : i.kind))).toEqual(['solid', 'dashed'])
  })

  it('loop/alt/opt/par распознаются как блоки', async () => {
    const ir = await seq(`sequenceDiagram
    A->>B: m
    loop Повтор
      A->>B: x
    end
    alt Успех
      A->>B: ok
    else Ошибка
      A->>B: fail
    end`)
    const kinds = ir.items.map((i) => i.kind)
    expect(kinds).toContain('blockStart')
    expect(kinds).toContain('blockElse')
    expect(kinds).toContain('blockEnd')
  })

  it('activate/deactivate парсятся как элементы', async () => {
    const ir = await seq(`sequenceDiagram
    A->>B: m
    activate B
    deactivate B`)
    expect(ir.items.some((i) => i.kind === 'activate')).toBe(true)
    expect(ir.items.some((i) => i.kind === 'deactivate')).toBe(true)
    expect(ir.warnings).toEqual([])
  })

  it('заметка распознаётся', async () => {
    const ir = await seq(`sequenceDiagram
    A->>B: m
    Note right of B: заметка`)
    expect(ir.items.some((i) => i.kind === 'note')).toBe(true)
  })
})
