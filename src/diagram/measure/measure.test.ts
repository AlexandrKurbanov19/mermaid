import { describe, expect, it } from 'vitest'
import { fallbackMeasurer as measurer } from './textMetrics'
import { wrapBlock, wrapText, splitRunsIntoWords } from './wrapText'
import { fitText } from './fitText'
import { measureNode } from './measureNode'
import { font, size, textArea, type as typography } from '../theme'
import type { TextBlock } from '../ir'

const FONT = { family: font.family, weight: font.weight.regular, size: typography.node.size }

const text = (s: string): TextBlock => ({ lines: [[{ text: s }]] })
const width = (runs: { width: number }[]) => runs.map((r) => r.width)
const flat = (runs: { runs: { text: string }[] }[]) => runs.map((r) => r.runs.map((x) => x.text).join(''))

describe('splitRunsIntoWords', () => {
  it('режет по пробелам, сохраняя начертание', () => {
    const words = splitRunsIntoWords([
      { text: 'привет ' },
      { text: 'жирный', bold: true },
      { text: ' мир' },
    ])
    expect(words).toHaveLength(3)
    expect(words[1].runs[0].bold).toBe(true)
  })

  it('схлопывает повторные пробелы', () => {
    expect(splitRunsIntoWords([{ text: 'a    b' }])).toHaveLength(2)
  })
})

describe('wrapText', () => {
  it('переносит по словам и не превышает ширину', () => {
    const lines = wrapText('один два три четыре пять шесть', 120, FONT, measurer)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.width).toBeLessThanOrEqual(120 + 0.01)
  })

  it('длинное слово без пробелов режется по символам', () => {
    const lines = wrapText('суперкалифраджилистикэкспиалидоция', 80, FONT, measurer)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.width).toBeLessThanOrEqual(80 + 0.01)
  })

  it('короткий текст остаётся одной строкой', () => {
    expect(wrapText('Ок', 200, FONT, measurer)).toHaveLength(1)
  })

  it('явные переносы из разметки уважаются', () => {
    const block: TextBlock = {
      lines: [[{ text: 'первая' }], [{ text: 'вторая' }], [{ text: 'третья' }]],
    }
    expect(wrapBlock(block, 300, FONT, measurer)).toHaveLength(3)
  })

  it('пустой текст даёт одну пустую строку', () => {
    const lines = wrapBlock({ lines: [] }, 100, FONT, measurer)
    expect(lines).toHaveLength(1)
    expect(lines[0].runs).toHaveLength(0)
  })
})

const FIT_OPTS = {
  maxWidth: size.nodeMaxWidth - size.paddingX * 2,
  maxHeight: size.nodeMaxHeight - size.paddingY * 2,
  baseFontSize: typography.node.size,
  minFontSize: typography.node.minSize,
  lineHeightRatio: typography.node.lineHeight,
}

describe('fitText', () => {
  it('короткий текст остаётся базового размера', () => {
    const res = fitText(text('Ок'), FIT_OPTS, FONT, measurer)
    expect(res.fontSize).toBe(typography.node.size)
    expect(res.truncated).toBe(false)
  })

  it('длинный текст уменьшает шрифт и влезает в границы', () => {
    // ~130 символов: влезает только с уменьшенным шрифтом, но ещё без обрезки
    const long = text('Очень длинный текст про пользователя и дашборд '.repeat(3).trim())
    const res = fitText(long, FIT_OPTS, FONT, measurer)
    expect(res.fontSize).toBeLessThan(typography.node.size)
    expect(res.fontSize).toBeGreaterThanOrEqual(typography.node.minSize)
    expect(res.width).toBeLessThanOrEqual(FIT_OPTS.maxWidth + 0.01)
    expect(res.height).toBeLessThanOrEqual(FIT_OPTS.maxHeight + 0.01)
    expect(res.truncated).toBe(false)
  })

  it('чем больше текста, тем меньше шрифт (монотонность)', () => {
    const make = (n: number) => fitText(text('слово '.repeat(n).trim()), FIT_OPTS, FONT, measurer).fontSize
    expect(make(4)).toBeGreaterThanOrEqual(make(12))
    expect(make(12)).toBeGreaterThanOrEqual(make(40))
  })

  it('если даже минимум не влезает — обрезает и ставит многоточие', () => {
    const huge = text('текст '.repeat(400).trim())
    const res = fitText(huge, { ...FIT_OPTS, maxHeight: 40 }, FONT, measurer)
    expect(res.truncated).toBe(true)
    expect(res.fontSize).toBe(typography.node.minSize)
    expect(flat(res.lines).join(' ')).toContain('…')
    expect(res.height).toBeLessThanOrEqual(40 + 0.01)
  })

  it('пустой текст не даёт строк', () => {
    const res = fitText({ lines: [] }, FIT_OPTS, FONT, measurer)
    expect(res.lines).toHaveLength(0)
    expect(res.height).toBe(0)
  })

  it('детерминирован', () => {
    const label = text('Пользователь авторизован и открывает дашборд')
    expect(fitText(label, FIT_OPTS, FONT, measurer)).toEqual(fitText(label, FIT_OPTS, FONT, measurer))
  })
})

describe('measureNode', () => {
  it('короткий текст -> минимальный бокс', () => {
    const box = measureNode(text('Ок'), 'box', FONT, measurer)
    expect(box.width).toBe(size.nodeMinWidth)
    expect(box.height).toBe(size.nodeMinHeight)
  })

  it('длинный текст НЕ растягивает бокс сверх лимитов', () => {
    const box = measureNode(text('Очень много текста в одном узле '.repeat(10).trim()), 'box', FONT, measurer)
    expect(box.width).toBeLessThanOrEqual(size.nodeMaxWidth)
    expect(box.height).toBeLessThanOrEqual(size.nodeMaxHeight)
    expect(box.fit.fontSize).toBeLessThan(typography.node.size)
    expect(box.fit.width).toBeLessThanOrEqual(box.width - size.paddingX * 2 + 0.01)
    expect(box.fit.height).toBeLessThanOrEqual(box.height - size.paddingY * 2 + 0.01)
  })

  it('ромб отдаёт тексту только 0.60 x 0.50 и шрифт мельче, чем в боксе', () => {
    const label = text('Авторизован ли пользователь прямо сейчас '.repeat(3).trim())
    const box = measureNode(label, 'box', FONT, measurer)
    const diamond = measureNode(label, 'decision', FONT, measurer)
    expect(diamond.fit.fontSize).toBeLessThanOrEqual(box.fit.fontSize)
    expect(diamond.fit.width).toBeLessThanOrEqual(diamond.width * textArea.decision.width + 0.01)
    expect(diamond.fit.height).toBeLessThanOrEqual(diamond.height * textArea.decision.height + 0.01)
  })

  it('круг квадратный, текст вписан в 0.70 диаметра', () => {
    const box = measureNode(text('Круг с текстом'), 'circle', FONT, measurer)
    expect(box.width).toBe(box.height)
    expect(box.fit.width).toBeLessThanOrEqual(box.width * textArea.circle.width + 0.01)
  })

  it('акцентный узел измеряется как обычный бокс', () => {
    const a = measureNode(text('Важное'), 'accent', FONT, measurer)
    const b = measureNode(text('Важное'), 'box', FONT, measurer)
    expect(a.width).toBe(b.width)
    expect(a.height).toBe(b.height)
  })

  it('явные переносы увеличивают высоту, но не ширину', () => {
    const one = measureNode({ lines: [[{ text: 'строка' }]] }, 'box', FONT, measurer)
    const three = measureNode(
      { lines: [[{ text: 'строка' }], [{ text: 'строка' }], [{ text: 'строка' }]] },
      'box',
      FONT,
      measurer,
    )
    expect(three.height).toBeGreaterThan(one.height)
    expect(three.width).toBeLessThanOrEqual(size.nodeMaxWidth)
  })
})
