import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import { normalizeState } from './normalizeState'
import type { StateIR } from '../ir'

/**
 * State-диаграммы: тестируем нормализацию напрямую (mermaid db),
 * как таймлайн — parser пока не подключает state в v2.
 */

async function state(source: string): Promise<StateIR> {
  mermaid.initialize({ startOnLoad: false })
  const result = await mermaid.mermaidAPI.getDiagramFromText(source)
  return normalizeState(result.db, source)
}

const text = (node: StateIR['nodes'][number]) =>
  node.label.lines.map((l) => l.map((r) => r.text).join('')).join(' ')

describe('state: парсинг', () => {
  it('start/end и переходы', async () => {
    const ir = await state(`stateDiagram-v2
    [*] --> Idle
    Idle --> Running : start
    Running --> [*] : stop`)

    expect(ir.nodes.map((n) => n.kind)).toEqual(['start', 'state', 'state', 'end'])
    expect(ir.transitions).toHaveLength(3)
    expect(ir.transitions[1].label!.lines[0][0].text).toBe('start')
  })

  it('у start/end нет текста', async () => {
    const ir = await state(`stateDiagram-v2
    [*] --> Idle`)
    const start = ir.nodes.find((n) => n.kind === 'start')!
    expect(text(start)).toBe('')
  })

  it('описание состояния уходит в description, а label остаётся именем', async () => {
    const ir = await state(`stateDiagram-v2
    [*] --> Idle
    Idle : Ожидание команды`)
    const idle = ir.nodes.find((n) => n.id === 'Idle')!
    expect(text(idle)).toBe('Idle')
    expect(idle.description[0].lines[0][0].text).toBe('Ожидание команды')
  })

  it('composite даёт предупреждение, а не падение', async () => {
    const ir = await state(`stateDiagram-v2
    [*] --> Parent
    state Parent {
      [*] --> Child
    }`)
    expect(ir.warnings.join(' ')).toContain('composite')
  })

  it('transition без подписи не создаёт пустой label', async () => {
    const ir = await state(`stateDiagram-v2
    A --> B`)
    expect(ir.transitions[0].label).toBeUndefined()
  })

  it('choice/fork/join распознаются из getRootDocV2', async () => {
    const ir = await state(`stateDiagram-v2
    [*] --> c
    state c <<choice>>
    c --> A
    state f <<fork>>
    state j <<join>>`)
    const kind = (id: string) => ir.nodes.find((n) => n.id === id)!.kind
    expect(kind('c')).toBe('choice')
    expect(kind('f')).toBe('fork')
    expect(kind('j')).toBe('join')
  })
})
