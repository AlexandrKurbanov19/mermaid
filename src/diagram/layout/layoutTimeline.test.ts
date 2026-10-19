import { describe, expect, it } from 'vitest'
import { layoutTimeline } from './layoutTimeline'
import { fallbackMeasurer as measurer } from '../measure/textMetrics'
import type { TimelineIR } from '../ir'
import { font, type as typography, timeline as T } from '../theme'

const FONT = { family: font.family, weight: font.weight.regular, size: typography.node.size }

function makeIr(labels: string[], withTitles = false): TimelineIR {
  return {
    v: 1,
    type: 'timeline',
    points: labels.map((label, i) => ({
      id: `p-${i}`,
      label: { lines: [[{ text: label }]] },
      events: withTitles ? [{ lines: [[{ text: `событие ${i}` }]] }] : [],
    })),
    lanes: [],
    warnings: [],
  }
}

const padX = Math.max(T.padding, T.labelWidth / 2)

describe('layoutTimeline', () => {
  it('пустой таймлайн не падает и даёт минимальный холст', () => {
    const layout = layoutTimeline(makeIr([]), FONT, measurer)
    expect(layout.points).toHaveLength(0)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('ширина = 2*боковой отступ + диаметр + (n-1)*шаг', () => {
    const layout = layoutTimeline(makeIr(['2022', '2023', '2024']), FONT, measurer)
    expect(layout.width).toBe(padX * 2 + T.circleDiameter + 2 * T.step)
  })

  it('боковой отступ вмещает половину подписи (ничего не обрезается)', () => {
    const layout = layoutTimeline(makeIr(['2022']), FONT, measurer)
    const point = layout.points[0]
    // край подписи не должен выходить за холст
    expect(point.cx - T.labelWidth / 2).toBeGreaterThanOrEqual(0)
    expect(point.cx + T.labelWidth / 2).toBeLessThanOrEqual(layout.width)
  })

  it('подписи чередуются сверху/снизу', () => {
    const layout = layoutTimeline(makeIr(['1', '2', '3', '4']), FONT, measurer)
    expect(layout.points.map((p) => p.side)).toEqual(['up', 'down', 'up', 'down'])
  })

  it('первая точка акцентная', () => {
    const layout = layoutTimeline(makeIr(['1', '2']), FONT, measurer)
    expect(layout.points[0].accent).toBe(true)
    expect(layout.points[1].accent).toBe(false)
  })

  it('выноска идёт от кружка наружу: вверх для up, вниз для down', () => {
    const layout = layoutTimeline(makeIr(['1', '2']), FONT, measurer)
    const [up, down] = layout.points
    expect(up.connector.y2).toBeLessThan(up.cy)
    expect(down.connector.y2).toBeGreaterThan(down.cy)
    // длина выноски ровно T.connector
    expect(Math.abs(up.connector.y1 - up.connector.y2)).toBeCloseTo(T.connector, 5)
  })

  it('подпись не наезжает на кружок: есть зазор', () => {
    const layout = layoutTimeline(makeIr(['1', '2'], true), FONT, measurer)
    const up = layout.points[0]
    const labelBottom = up.label.y + up.label.height
    expect(labelBottom).toBeLessThanOrEqual(up.connector.y2 - T.labelGap + 0.01)
  })

  it('ось идёт от центра первого кружка до центра последнего', () => {
    const layout = layoutTimeline(makeIr(['1', '2', '3']), FONT, measurer)
    expect(layout.axis.x1).toBeCloseTo(layout.points[0].cx, 5)
    expect(layout.axis.x2).toBeCloseTo(layout.points[2].cx, 5)
  })

  it('холст вмещает подписи сверху и снизу', () => {
    const layout = layoutTimeline(makeIr(['1', '2'], true), FONT, measurer)
    for (const point of layout.points) {
      expect(point.label.y).toBeGreaterThanOrEqual(0)
      expect(point.label.y + point.label.height).toBeLessThanOrEqual(layout.height)
    }
  })

  it('на длинном таймлайне шаг увеличивается', () => {
    const short = layoutTimeline(makeIr(['1', '2']), FONT, measurer)
    const long = layoutTimeline(
      makeIr(Array.from({ length: 14 }, (_, i) => String(i + 1))),
      FONT,
      measurer,
    )
    const shortStep = short.points[1].cx - short.points[0].cx
    const longStep = long.points[1].cx - long.points[0].cx
    expect(longStep).toBeGreaterThan(shortStep)
  })
})
