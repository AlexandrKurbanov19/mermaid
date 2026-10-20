import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import { normalizeEr } from './normalizeEr'
import type { ERIR } from '../ir'

async function er(source: string): Promise<ERIR> {
  mermaid.initialize({ startOnLoad: false })
  const r = await mermaid.mermaidAPI.getDiagramFromText(source)
  return normalizeEr(r.db, source)
}

describe('er: парсинг', () => {
  it('сущности и атрибуты с ключами', async () => {
    const ir = await er(`erDiagram
    CUSTOMER {
      int id PK
      string name
    }`)
    const customer = ir.entities.find((e) => e.name === 'CUSTOMER')!
    expect(customer.attributes[0].name).toBe('id')
    expect(customer.attributes[0].keys).toContain('PK')
    expect(customer.attributes[1].name).toBe('name')
  })

  it('связь с кардинальностью и ролью', async () => {
    const ir = await er(`erDiagram
    CUSTOMER ||--o{ ORDER : places`)
    const rel = ir.relationships[0]
    expect(rel.roleA).toBe('places')
    expect(rel.cardA).toBe('ONLY_ONE')
    expect(rel.cardB).toBe('ZERO_OR_MORE')
    expect(rel.identifying).toBe(true)
  })
})
