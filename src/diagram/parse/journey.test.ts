import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import { normalizeJourney } from './normalizeJourney'
import type { JourneyIR } from '../ir'

async function j(source: string): Promise<JourneyIR> {
  mermaid.initialize({ startOnLoad: false })
  const r = await mermaid.mermaidAPI.getDiagramFromText(source)
  return normalizeJourney(r.db, source)
}

describe('journey: парсинг', () => {
  it('секции, задачи, оценка, люди', async () => {
    const ir = await j(`journey
    title Поездка
    section Утро
      Проснулся: 5: Я
    section День
      Работа: 3: Я, Команда`)
    expect(ir.title).toBe('Поездка')
    expect(ir.sections.map((s) => s.name)).toEqual(['Утро', 'День'])
    expect(ir.sections[0].tasks[0]).toMatchObject({ task: 'Проснулся', score: 5 })
    expect(ir.sections[1].tasks[0].people).toEqual(['Я', 'Команда'])
  })
})
