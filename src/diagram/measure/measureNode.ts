import type { NodeRole, TextBlock, FlowchartIR } from '../ir'
import { badge, size, textArea, type as typography } from '../theme'
import { fitText, type FitResult } from './fitText'
import type { FontSpec, TextMeasurer } from './textMetrics'

/**
 * Габариты узла.
 *
 * Правило заказчика: бокс НЕ растёт под текст. Поэтому здесь:
 *  - размеры ограничены лимитами из theme (nodeMinWidth..nodeMaxHeight);
 *  - текст подстраивается через fitText;
 *  - для ромба/круга/шестиугольника текстовая область меньше габаритов фигуры
 *    (иначе текст вылезает за скосы и дугу).
 */

export interface NodeBox {
  width: number
  height: number
  fit: FitResult
}

export interface MeasureOptions {
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  /** у узла есть бейдж-кружок слева — часть ширины отдаём ему */
  badge?: boolean
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function measureNode(
  label: TextBlock,
  role: NodeRole,
  font: FontSpec,
  measurer: TextMeasurer,
  opts: MeasureOptions = {},
): NodeBox {
  const minW = opts.minWidth ?? size.nodeMinWidth
  const maxW = opts.maxWidth ?? size.nodeMaxWidth
  const minH = opts.minHeight ?? size.nodeMinHeight
  const maxH = opts.maxHeight ?? size.nodeMaxHeight

  const factor = textArea[role]
  const badgeReserve = opts.badge ? badge.reserve : 0
  const padX = size.paddingX
  const padY = size.paddingY

  const base = {
    baseFontSize: typography.node.size,
    minFontSize: typography.node.minSize,
    lineHeightRatio: typography.node.lineHeight,
  }

  // Прямоугольные фигуры: текст занимает всё, кроме паддингов.
  if (factor.width === 1 && factor.height === 1) {
    const fit = fitText(
      label,
      { ...base, maxWidth: maxW - padX * 2 - badgeReserve, maxHeight: maxH - padY * 2 },
      font,
      measurer,
    )
    return {
      width: clamp(Math.ceil(fit.width) + padX * 2 + badgeReserve, minW, maxW),
      height: clamp(Math.ceil(fit.height) + padY * 2, minH, maxH),
      fit,
    }
  }

  // Фигуры со «сжатой» текстовой областью: сначала грубая оценка по максимумам,
  // затем уточнение под получившиеся габариты.
  const roughFit = fitText(
    label,
    { ...base, maxWidth: maxW * factor.width, maxHeight: maxH * factor.height },
    font,
    measurer,
  )

  let width = clamp(Math.ceil(Math.max(roughFit.width / factor.width, minW)), minW, maxW)
  let height = clamp(Math.ceil(Math.max(roughFit.height / factor.height, minH)), minH, maxH)

  if (role === 'circle') {
    const d = clamp(Math.max(width, height), minW, maxW)
    width = d
    height = d
  }

  const fit = fitText(
    label,
    { ...base, maxWidth: width * factor.width, maxHeight: height * factor.height },
    font,
    measurer,
  )

  // если после уточнения текст перестал влезать — дотягиваем габарит в пределах лимитов
  const neededW = clamp(Math.ceil(fit.width / factor.width), minW, maxW)
  const neededH = clamp(Math.ceil(fit.height / factor.height), minH, maxH)
  if (neededW > width || neededH > height) {
    width = Math.max(width, neededW)
    height = Math.max(height, neededH)
    if (role === 'circle') {
      const d = Math.max(width, height)
      width = d
      height = d
    }
  }

  return { width, height, fit }
}

/** Габариты всех узлов схемы: id -> бокс. */
export function measureNodes(
  ir: FlowchartIR,
  font: FontSpec,
  measurer: TextMeasurer,
): Record<string, NodeBox> {
  const result: Record<string, NodeBox> = {}
  for (const node of ir.nodes) {
    result[node.id] = measureNode(node.label, node.role, font, measurer, { badge: !!node.badge })
  }
  return result
}
