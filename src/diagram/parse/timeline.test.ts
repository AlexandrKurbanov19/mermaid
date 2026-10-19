import { describe, expect, it } from 'vitest'
import { parseMermaid } from './parseMermaid'
import { extractBadge } from './normalize'
import type { TimelineIR, FlowchartIR } from '../ir'

/**
 * Тесты таймлайна и бейджей.
 * DOM для mermaid предоставляет environment `jsdom` (см. vitest.config.ts).
 */

async function timeline(source: string): Promise<TimelineIR> {
  const res = await parseMermaid(source)
  if (!res.ok) throw new Error(`ожидали успешный парсинг: ${res.error.message}`)
  if (res.ir.type !== 'timeline') throw new Error(`ожидали timeline, получили ${res.ir.type}`)
  return res.ir
}

async function flowchart(source: string): Promise<FlowchartIR> {
  const res = await parseMermaid(source)
  if (!res.ok) throw new Error(`ожидали успешный парсинг: ${res.error.message}`)
  if (res.ir.type !== 'flowchart') throw new Error(`ожидали flowchart, получили ${res.ir.type}`)
  return res.ir
}

const text = (ir: TimelineIR, i: number) =>
  ir.points[i].label.lines.map((line) => line.map((r) => r.text).join('')).join(' ')

describe('timeline: парсинг', () => {
  it('без section: время лежит в task', async () => {
    const ir = await timeline(`timeline
    2022 : Запуск
    2023 : Рост`)

    expect(ir.points).toHaveLength(2)
    expect(text(ir, 0)).toBe('2022')
    expect(ir.points[0].events).toHaveLength(1)
    expect(ir.points[0].title).toBeUndefined()
    expect(ir.lanes).toHaveLength(0)
  })

  it('хвостовые пробелы из mermaid срезаются', async () => {
    const ir = await timeline(`timeline
    section 2023
        Рост : Две новые программы`)

    expect(text(ir, 0)).toBe('2023')
    const title = ir.points[0].title!.lines.map((l) => l.map((r) => r.text).join('')).join(' ')
    expect(title).toBe('Рост')
  })

  it('section в скобках: скобки убираются', async () => {
    const ir = await timeline(`timeline
    section [Первый этап]
        2022 : Старт`)

    expect(text(ir, 0)).toBe('Первый этап')
    expect(ir.lanes[0].label!.lines[0][0].text).toBe('Первый этап')
  })

  it('несколько событий через двоеточие', async () => {
    const ir = await timeline(`timeline
    2022 : событие 1 : событие 2`)

    expect(ir.points[0].events).toHaveLength(2)
  })

  it('title берётся из разметки (в API mermaid его нет)', async () => {
    const ir = await timeline(`timeline
    title История продукта
    2022 : Запуск`)

    expect(ir.title).toBe('История продукта')
  })

  it('дорожки группируют точки одного section', async () => {
    const ir = await timeline(`timeline
    section 2022
        A : одно
    section 2023
        B : два`)

    expect(ir.lanes).toHaveLength(2)
    expect(ir.lanes.map((l) => l.pointIds)).toEqual([['p-0'], ['p-1']])
    expect(ir.points[0].laneId).toBe(ir.lanes[0].id)
  })
})

describe('timeline: устойчивость', () => {
  it('пустой timeline даёт предупреждение, а не падение', async () => {
    const ir = await timeline('timeline')
    expect(ir.points).toHaveLength(0)
    expect(ir.warnings.join(' ')).toContain('ни одной точки')
  })

  it('больше 20 точек — предупреждение о слипании', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => `  ${i + 1} : событие`).join('\n')
    const ir = await timeline(`timeline\n${rows}`)
    expect(ir.points).toHaveLength(21)
    expect(ir.warnings.join(' ')).toContain('слипаться')
  })
})

describe('бейджи: «1. текст» -> кружок с номером', () => {
  const label = (s: string) => ({ lines: [[{ text: s }]] })

  it('выносит число для «1. Понять проблему»', () => {
    const result = extractBadge(label('1. Понять проблему'))
    expect(result.badge).toBe('1')
    expect(result.label.lines[0][0].text).toBe('Понять проблему')
  })

  it('понимает скобку: «3) Критерии»', () => {
    const result = extractBadge(label('3) Критерии'))
    expect(result.badge).toBe('3')
    expect(result.label.lines[0][0].text).toBe('Критерии')
  })

  it('НЕ трогает «1.5 млн» (нет пробела после точки)', () => {
    const result = extractBadge(label('1.5 млн'))
    expect(result.badge).toBeUndefined()
  })

  it('НЕ трогает «2022 год»', () => {
    const result = extractBadge(label('2022 год'))
    expect(result.badge).toBeUndefined()
  })

  it('НЕ трогает «Пункт 5» (номер не в начале)', () => {
    const result = extractBadge(label('Пункт 5'))
    expect(result.badge).toBeUndefined()
  })

  it('сохраняет начертание остатка', () => {
    const result = extractBadge({ lines: [[{ text: '2. ' }, { text: 'важное', bold: true }]] })
    expect(result.badge).toBe('2')
    expect(result.label.lines[0][0]).toEqual({ text: 'важное', bold: true })
  })
})

describe('вложенные группы', () => {
  it('дают предупреждение, а не тихо ломают раскладку', async () => {
    const ir = await flowchart(`graph TD
    subgraph Внешняя
      A[Узел A]
      subgraph Внутренняя
        B[Узел B] --> C[Узел C]
      end
    end`)

    expect(ir.groups).toHaveLength(2)
    expect(ir.warnings.join(' ')).toContain('плоско')
    // внешняя группа не «съедает» узлы внутренней
    expect(ir.groups.find((g) => g.id === 'Внешняя')!.nodeIds).toEqual(['A'])
  })
})

describe('роли из разметки', () => {
  it('A>текст] становится шевроном', async () => {
    const ir = await flowchart('graph TD\n A>Старт] --> B')
    expect(ir.nodes.find((n) => n.id === 'A')!.role).toBe('chevron')
  })

  it(':::secondary даёт вторичную роль', async () => {
    const ir = await flowchart('graph TD\n A[Второй поток]:::secondary --> B')
    expect(ir.nodes.find((n) => n.id === 'A')!.role).toBe('secondary')
  })

  it('бейдж попадает в узел, а не в текст', async () => {
    const ir = await flowchart('graph TD\n A[1. Понять проблему] --> B')
    const node = ir.nodes.find((n) => n.id === 'A')!
    expect(node.badge).toBe('1')
    expect(node.label.lines[0][0].text).toBe('Понять проблему')
  })
})
