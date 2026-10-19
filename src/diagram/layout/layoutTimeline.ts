import type { TimelineIR } from '../ir'
import type { FitResult } from '../measure/fitText'
import { fitText } from '../measure/fitText'
import type { FitLine } from '../measure/wrapText'
import { wrapBlock } from '../measure/wrapText'
import type { FontSpec, TextMeasurer } from '../measure/textMetrics'
import { font as themeFont, timeline as T, type as typography } from '../theme'

/**
 * Раскладка таймлайна: горизонтальная ось, точки равномерно, подписи чередуются.
 *
 *     [2022]         [2024]          ← подписи сверху (чётные)
 *  ●————○————————————○————————————○————●
 *            [2023]          [2025]   ← подписи снизу (нечётные)
 *
 * Числа — из замеров архива (см. docs/SPEC-ITERATION-2.md §1.2, §3).
 */

export type LabelSide = 'up' | 'down'

export interface TimelinePlacement {
  id: string
  cx: number
  cy: number
  r: number
  side: LabelSide
  connector: { x1: number; y1: number; x2: number; y2: number }
  label: {
    /** левый верхний угол блока подписи */
    x: number
    y: number
    width: number
    height: number
    titleLines: FitLine[]
    titleHeight: number
    eventLines: FitLine[][]
    eventsHeight: number
  }
  circleFit: FitResult
  /** первая точка рисуется акцентной, как «текущая» в архиве */
  accent: boolean
}

export interface TimelineLayout {
  width: number
  height: number
  axis: { x1: number; y1: number; x2: number; y2: number }
  points: TimelinePlacement[]
}

/** Шаг растёт на длинных таймлайнах, иначе подписи слипаются. */
function stepFor(count: number): number {
  if (count > 16) return T.step * 1.5
  if (count > 12) return T.step * 1.25
  return T.step
}

const LINE_GAP = 4

export function layoutTimeline(ir: TimelineIR, font: FontSpec, measurer: TextMeasurer): TimelineLayout {
  const n = ir.points.length
  const r = T.circleDiameter / 2

  if (!n) {
    return {
      width: T.padding * 2 + T.circleDiameter,
      height: T.padding * 2 + T.circleDiameter,
      axis: { x1: T.padding, y1: T.padding + r, x2: T.padding + T.circleDiameter, y2: T.padding + r },
      points: [],
    }
  }

  const step = stepFor(n)
  const labelInner = T.circleDiameter * 0.7
  // подпись шире крайнего кружка, поэтому боковой отступ не меньше её половины,
  // иначе первая/последняя подпись обрезается краем холста
  const padX = Math.max(T.padding, T.labelWidth / 2)

  // сначала считаем тексты, чтобы понять высоты блоков сверху и снизу
  const prepared = ir.points.map((point) => {
    const circleFit = fitText(
      point.label,
      {
        maxWidth: labelInner,
        maxHeight: labelInner,
        baseFontSize: T.circleFontSize,
        minFontSize: T.circleMinFontSize,
        lineHeightRatio: 1.2,
      },
      font,
      measurer,
    )

    const titleSpec: FontSpec = { ...font, weight: themeFont.weight.semibold, size: T.titleFontSize }
    const titleLines = point.title
      ? wrapBlock(point.title, T.labelWidth, titleSpec, measurer)
      : []
    const titleHeight = titleLines.length * T.titleFontSize * typography.node.lineHeight

    const eventSpec: FontSpec = { ...font, size: T.eventFontSize }
    const eventLines = point.events.map((event) => wrapBlock(event, T.labelWidth, eventSpec, measurer))
    const eventsHeight = eventLines.reduce((sum, lines) => sum + lines.length * T.eventFontSize * 1.3, 0)

    const blockHeight =
      titleHeight + (eventLines.length ? (titleLines.length ? LINE_GAP : 0) + eventsHeight : 0)

    return { point, circleFit, titleLines, titleHeight, eventLines, eventsHeight, blockHeight }
  })

  const maxUp = Math.max(
    0,
    ...prepared.filter((_, i) => i % 2 === 0).map((p) => p.blockHeight),
  )
  const maxDown = Math.max(
    0,
    ...prepared.filter((_, i) => i % 2 === 1).map((p) => p.blockHeight),
  )

  const circleTopOffset = T.labelGap + T.connector + r
  const axisY = T.padding + maxUp + circleTopOffset
  const width = padX * 2 + T.circleDiameter + (n - 1) * step
  const height = axisY + r + T.connector + T.labelGap + maxDown + T.padding

  const points: TimelinePlacement[] = prepared.map((item, i) => {
    const cx = padX + r + i * step
    const side: LabelSide = i % 2 === 0 ? 'up' : 'down'

    const connector =
      side === 'up'
        ? { x1: cx, y1: axisY - r, x2: cx, y2: axisY - r - T.connector }
        : { x1: cx, y1: axisY + r, x2: cx, y2: axisY + r + T.connector }

    const labelY =
      side === 'up'
        ? connector.y2 - T.labelGap - item.blockHeight
        : connector.y2 + T.labelGap

    return {
      id: item.point.id,
      cx,
      cy: axisY,
      r,
      side,
      connector,
      label: {
        // x — центр подписи: текст центрируется относительно кружка
        x: cx,
        y: labelY,
        width: T.labelWidth,
        height: item.blockHeight,
        titleLines: item.titleLines,
        titleHeight: item.titleHeight,
        eventLines: item.eventLines,
        eventsHeight: item.eventsHeight,
      },
      circleFit: item.circleFit,
      accent: i === 0,
    }
  })

  return {
    width,
    height,
    axis: {
      x1: padX + r,
      y1: axisY,
      x2: padX + r + (n - 1) * step,
      y2: axisY,
    },
    points,
  }
}
