import { describe, expect, it } from 'vitest'
import { buildOrthogonalPath } from './layoutElk'

describe('buildOrthogonalPath', () => {
  it('одна точка -> только Move', () => {
    expect(buildOrthogonalPath([{ x: 10, y: 20 }])).toBe('M 10 20')
  })

  it('две точки -> прямая линия без скруглений', () => {
    const d = buildOrthogonalPath([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ])
    expect(d).toBe('M 0 0 L 0 100')
  })

  it('прямой угол скругляется дугой (Q), а не остаётся острым', () => {
    const d = buildOrthogonalPath(
      [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
      8,
    )
    expect(d).toContain('Q')
    expect(d).toContain('L 100 100')
    // радиус не больше половины сегмента
    expect(d).toMatch(/L 0 92 Q 0 100 8 100/)
  })

  it('радиус ограничен половиной короткого сегмента', () => {
    const d = buildOrthogonalPath(
      [
        { x: 0, y: 0 },
        { x: 0, y: 4 },
        { x: 100, y: 4 },
      ],
      20,
    )
    expect(d).toMatch(/L 0 2 Q 0 4 2 4/)
  })

  it('три и более сегмента: путь замкнут на последнюю точку', () => {
    const d = buildOrthogonalPath([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
    ])
    expect(d.startsWith('M 0 0')).toBe(true)
    expect(d.endsWith('L 50 100')).toBe(true)
  })

  it('пустой массив -> пустая строка', () => {
    expect(buildOrthogonalPath([])).toBe('')
  })
})
