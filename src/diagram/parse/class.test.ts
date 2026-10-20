import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import { normalizeClass } from './normalizeClass'
import type { ClassIR } from '../ir'

async function cls(source: string): Promise<ClassIR> {
  mermaid.initialize({ startOnLoad: false })
  const r = await mermaid.mermaidAPI.getDiagramFromText(source)
  return normalizeClass(r.db, source)
}

describe('class: парсинг', () => {
  it('поля и методы', async () => {
    const ir = await cls(`classDiagram
    class Animal {
      +String name
      +makeSound() void
    }`)
    const animal = ir.nodes.find((n) => n.id === 'Animal')!
    expect(animal.fields[0].text).toBe('String name')
    expect(animal.fields[0].visibility).toBe('+')
    expect(animal.methods[0].text).toBe('makeSound() : void')
  })

  it('стили отношений', async () => {
    const ir = await cls(`classDiagram
    class A
    class B
    A <|-- B : наследует
    A ..> B : использует
    A *-- B
    A o-- B`)
    const styles = ir.relations.map((r) => r.style).sort()
    expect(styles).toEqual(['aggregation', 'composition', 'dependency', 'inheritance'])
  })

  it('подпись отношения сохраняется', async () => {
    const ir = await cls(`classDiagram
    A <|-- B : наследует`)
    expect(ir.relations[0].title).toBe('наследует')
  })
})
