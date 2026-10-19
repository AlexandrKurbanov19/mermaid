import { describe, expect, it } from 'vitest'
import { SYNTAX_GROUPS, SYNTAX_TOTAL } from './syntax'
import { parseMermaid } from './diagram/parse/parseMermaid'

/**
 * Страховка от «сгнившего» справочника: каждый сниппет обязан парситься.
 * Если mermaid поменяет синтаксис или мы сломаем нормализацию — тест упадёт.
 */
describe('справочник по синтаксису', () => {
  for (const group of SYNTAX_GROUPS) {
    for (const item of group.items) {
      it(`${group.title} → «${item.title}»`, async () => {
        const res = await parseMermaid(item.code)
        const message = res.ok ? '' : `${item.id}: ${res.error.message}`
        expect(res.ok, message).toBe(true)
      })
    }
  }

  it('у каждого пункта есть заголовок и код', () => {
    for (const group of SYNTAX_GROUPS) {
      for (const item of group.items) {
        expect(item.title.trim().length, item.id).toBeGreaterThan(0)
        expect(item.code.trim().length, item.id).toBeGreaterThan(0)
      }
    }
  })

  it('сниппеты уникальны', () => {
    const codes = SYNTAX_GROUPS.flatMap((g) => g.items.map((i) => i.code))
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('справочник не пустой', () => {
    expect(SYNTAX_TOTAL).toBeGreaterThan(20)
  })
})
