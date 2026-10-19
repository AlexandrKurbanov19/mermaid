import { describe, expect, it } from 'vitest'
import { parseMermaid } from './parseMermaid'
import { textBlockToString } from './label'
import type { DiagramIR } from '../ir'

async function ir(source: string): Promise<DiagramIR> {
  const res = await parseMermaid(source)
  if (!res.ok) throw new Error(`ожидали успешный парсинг, получили: ${res.error.message}`)
  return res.ir
}

const TASK_EXAMPLE = `graph TD
    A[Пользователь] --> B{Авторизован?}
    B -- да --> C[Открыть дашборд]
    B -- нет --> D[Показать логин]
    D --> B`

describe('пример из задачи', () => {
  it('разбирается в IR: 4 узла, 4 связи, направление TB', async () => {
    const res = await parseMermaid(TASK_EXAMPLE)
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const { ir } = res
    expect(ir.v).toBe(1)
    expect(ir.direction).toBe('TB')
    expect(ir.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(ir.edges).toHaveLength(4)
    expect(ir.groups).toHaveLength(0)
    expect(ir.warnings).toEqual([])
  })

  it('маппит формы: квадрат -> box, ромб -> decision', async () => {
    const { nodes } = await ir(TASK_EXAMPLE)
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    expect(byId.A.role).toBe('box')
    expect(byId.B.role).toBe('decision')
    expect(byId.C.role).toBe('box')
  })

  it('сохраняет подписи рёбер и текст узлов', async () => {
    const { edges, nodes } = await ir(TASK_EXAMPLE)
    const labels = edges.map((e) => textBlockToString(e.label))
    expect(labels).toContain('да')
    expect(labels).toContain('нет')
    expect(textBlockToString(nodes.find((n) => n.id === 'A')!.label)).toBe('Пользователь')
  })

  it('IR детерминирован (снапшот)', async () => {
    expect(await ir(TASK_EXAMPLE)).toMatchSnapshot()
  })
})

describe('направление', () => {
  it.each([
    ['graph TD', 'TB'],
    ['graph TB', 'TB'],
    ['graph BT', 'BT'],
    ['graph LR', 'LR'],
    ['graph RL', 'RL'],
  ])('%s -> %s', async (head, expected) => {
    const { direction } = await ir(`${head}\n A --> B`)
    expect(direction).toBe(expected)
  })
})

describe('формы', () => {
  it.each([
    ['A[текст]', 'box'],
    ['A(текст)', 'round'],
    ['A([текст])', 'pill'],
    ['A((текст))', 'circle'],
    ['A{{текст}}', 'hexagon'],
    ['A{текст}', 'decision'],
  ])('%s -> %s', async (decl, role) => {
    const { nodes } = await ir(`graph TD\n ${decl}`)
    expect(nodes[0].role).toBe(role)
  })

  it('экзотическая форма сводится к box и попадает в warnings', async () => {
    const result = await ir('graph TD\n A[[подпрограмма]] --> B')
    expect(result.nodes.find((n) => n.id === 'A')!.role).toBe('box')
    expect(result.warnings.join(' ')).toContain('A (subroutine)')
  })
})

describe('рёбра', () => {
  it.each([
    ['A --> B', 'solid', 'end'],
    ['A -.-> B', 'dashed', 'end'],
    ['A ==> B', 'thick', 'end'],
    ['A --- B', 'solid', 'none'],
    ['A <--> B', 'solid', 'both'],
  ])('%s -> %s / %s', async (edge, kind, arrow) => {
    const { edges } = await ir(`graph TD\n ${edge}`)
    expect(edges[0].kind).toBe(kind)
    expect(edges[0].arrow).toBe(arrow)
  })

  it('подпись через |текст| и через -- текст -->', async () => {
    const a = await ir('graph TD\n A -->|да| B')
    const b = await ir('graph TD\n A -- да --> B')
    expect(textBlockToString(a.edges[0].label)).toBe('да')
    expect(textBlockToString(b.edges[0].label)).toBe('да')
  })
})

describe('подписи: markdown и переносы', () => {
  it('разбирает **bold** и `code` на прогоны', async () => {
    const { nodes } = await ir('graph TD\n A["**Шаг 1** и `json`"]')
    const line = nodes[0].label.lines[0]
    expect(line).toEqual([
      { text: 'Шаг 1', bold: true },
      { text: ' и ' },
      { text: 'json', code: true },
    ])
  })

  it('<br> превращается в перенос строки', async () => {
    const { nodes } = await ir('graph TD\n A["первая<br/>вторая"]')
    expect(nodes[0].label.lines).toHaveLength(2)
    expect(textBlockToString(nodes[0].label)).toBe('первая вторая')
  })

  it('литеральный \\n в простом тексте становится переносом', async () => {
    const { nodes } = await ir('graph TD\n A[первая\\nвторая]')
    expect(nodes[0].label.lines).toHaveLength(2)
  })

  it('неизвестные HTML-теги вырезаются', async () => {
    const { nodes } = await ir('graph TD\n A["текст <span>x</span>"]')
    expect(textBlockToString(nodes[0].label)).toBe('текст x')
  })
})

describe('стили пользователя игнорируются', () => {
  it('classDef и style не ломают парсинг, но дают предупреждение', async () => {
    const result = await ir(
      ['graph TD', ' A --> B', ' classDef red fill:#f00', ' style A fill:#0f0', ' class A red'].join('\n'),
    )
    expect(result.nodes).toHaveLength(2)
    expect(result.warnings.join(' ')).toContain('игнорируются')
  })

  it(':::accent даёт акцентную роль', async () => {
    const { nodes } = await ir('graph TD\n A[важное]:::accent --> B')
    expect(nodes.find((n) => n.id === 'A')!.role).toBe('accent')
  })
})

describe('subgraph', () => {
  it('становится группой, узлы получают parentId', async () => {
    const result = await ir(['graph TD', ' subgraph S[Группа]', '   A --> B', ' end', ' B --> C'].join('\n'))
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].id).toBe('S')
    expect(result.groups[0].nodeIds.sort()).toEqual(['A', 'B'])
    expect(result.nodes.find((n) => n.id === 'A')!.parentId).toBe('S')
    expect(result.nodes.find((n) => n.id === 'C')!.parentId).toBeUndefined()
  })
})

describe('ошибки', () => {
  it('битый синтаксис -> ошибка с типом syntax', async () => {
    const res = await parseMermaid('graph TD\n A --> ')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.kind).toBe('syntax')
    expect(res.error.message.length).toBeGreaterThan(0)
  })

  it('неподдерживаемый тип -> unsupported-type', async () => {
    const res = await parseMermaid('sequenceDiagram\n A->>B: привет')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.kind).toBe('unsupported-type')
  })

  it('пустая строка -> ошибка', async () => {
    const res = await parseMermaid('   ')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.kind).toBe('syntax')
  })
})
