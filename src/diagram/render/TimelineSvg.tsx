import { useId } from 'react'
import type { InlineRun, TimelineIR } from '../ir'
import type { TimelineLayout, TimelinePlacement } from '../layout/layoutTimeline'
import type { FitLine } from '../measure/wrapText'
import { color, font, timeline as T, type as typography } from '../theme'

/**
 * Рендер таймлайна.
 *
 * Слои: ось → выноски с точками → кружки → подписи.
 * Геометрию и подгонку текста посчитал `layoutTimeline`, здесь только рисование.
 */

interface Props {
  ir: TimelineIR
  layout: TimelineLayout
  svgRef?: React.Ref<SVGSVGElement>
}

export function TimelineSvg({ ir, layout, svgRef }: Props) {
  const uid = useId().replace(/[:]/g, '')
  const gradientId = `tl-accent-${uid}`

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
      width={layout.width}
      height={layout.height}
      // размеры НЕ подгоняем через CSS: подгонкой занимается ZoomPane,
      // иначе SVG сжимается до применения transform и зум считается по искажённым размерам
      style={{ display: 'block', overflow: 'visible', fontFamily: font.family }}
      role="img"
      aria-label={ir.title ?? 'Таймлайн'}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color.gradientFrom} />
          <stop offset="100%" stopColor={color.gradientTo} />
        </linearGradient>
      </defs>

      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {/* ось */}
      <line
        x1={layout.axis.x1}
        y1={layout.axis.y1}
        x2={layout.axis.x2}
        y2={layout.axis.y2}
        stroke={T.axisColor}
        strokeWidth={T.axisWidth}
        strokeLinecap="round"
      />

      {/* выноски с точками */}
      <g>
        {layout.points.map((point) => (
          <g key={`connector-${point.id}`}>
            <line
              x1={point.connector.x1}
              y1={point.connector.y1}
              x2={point.connector.x2}
              y2={point.connector.y2}
              stroke={T.connectorColor}
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            <circle cx={point.connector.x2} cy={point.connector.y2} r={T.dotRadius} fill={T.connectorColor} />
          </g>
        ))}
      </g>

      {/* подписи точек */}
      <g>
        {layout.points.map((point) => (
          <PointLabel key={`label-${point.id}`} placement={point} />
        ))}
      </g>

      {/* кружки */}
      <g>
        {layout.points.map((point) => (
          <g key={point.id}>
            <circle
              cx={point.cx}
              cy={point.cy}
              r={point.r}
              fill={point.accent ? `url(#${gradientId})` : color.nodeFill}
              stroke={point.accent ? 'none' : color.borderSubtle}
              strokeWidth={1}
            />
            <CircleLabel placement={point} />
          </g>
        ))}
      </g>
    </svg>
  )
}

function CircleLabel({ placement }: { placement: TimelinePlacement }) {
  const { circleFit, cx, cy } = placement
  if (!circleFit.lines.length) return null

  const totalHeight = circleFit.lines.length * circleFit.lineHeight
  const firstLineY = cy - totalHeight / 2 + circleFit.lineHeight / 2

  return (
    <g>
      {circleFit.lines.map((line, i) => (
        <text
          key={i}
          x={cx}
          y={firstLineY + i * circleFit.lineHeight}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={circleFit.fontSize}
          fontWeight={font.weight.semibold}
          fill={color.textPrimary}
        >
          {line.runs.length ? line.runs.map((run: InlineRun, j) => <tspan key={j}>{run.text}</tspan>) : '\u00A0'}
        </text>
      ))}
    </g>
  )
}

function PointLabel({ placement }: { placement: TimelinePlacement }) {
  const { label, side } = placement
  if (!label.height) return null

  const lineHeightTitle = T.titleFontSize * typography.node.lineHeight
  const lineHeightEvent = T.eventFontSize * 1.3

  // блок растёт от кружка наружу: сверху — вверх, снизу — вниз
  const startY = label.y

  let cursor = startY
  const titleElements = label.titleLines.map((line, i) => {
    const y = cursor + i * lineHeightTitle
    return (
      <text
        key={`title-${i}`}
        x={label.x}
        y={y}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={T.titleFontSize}
        fontWeight={font.weight.semibold}
        fill={color.textPrimary}
      >
        {line.runs.length ? line.runs.map((run: InlineRun, j) => <tspan key={j}>{run.text}</tspan>) : '\u00A0'}
      </text>
    )
  })

  cursor += label.titleHeight
  if (label.eventLines.length && label.titleLines.length) cursor += 4

  const eventElements = label.eventLines.flatMap((lines, blockIndex) => {
    const rows = lines.map((line: FitLine, i: number) => {
      const y = cursor + i * lineHeightEvent
      return (
        <text
          key={`event-${blockIndex}-${i}`}
          x={label.x}
          y={y}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={T.eventFontSize}
          fill={color.textSecondary}
        >
          {line.runs.length ? line.runs.map((run: InlineRun, j) => <tspan key={j}>{run.text}</tspan>) : '\u00A0'}
        </text>
      )
    })
    cursor += lines.length * lineHeightEvent
    return rows
  })

  return (
    <g data-side={side}>
      {titleElements}
      {eventElements}
    </g>
  )
}
