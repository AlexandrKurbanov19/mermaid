import { useId, useMemo } from 'react'
import type { DiagramIR, InlineRun, IRNode } from '../ir'
import type { NodeBox } from '../measure/measureNode'
import type { Layout } from '../layout/layoutElk'
import { buildOrthogonalPath } from '../layout/layoutElk'
import { buildEdgeGeometries } from './edgeLayout'
import { measurer } from '../measure/textMetrics'
import { color, font, size, type as typography } from '../theme'

/**
 * Шаг [4] пайплайна: IR + координаты -> SVG.
 *
 * Рендерим сами, а не через mermaid: нужен полный контроль над стилем
 * (палитра Нетологии, своя геометрия, свой fit-text) и над экспортом.
 */

interface Props {
  ir: DiagramIR
  boxes: Record<string, NodeBox>
  layout: Layout
  /** для экспорта: ref на корневой <svg> */
  svgRef?: React.Ref<SVGSVGElement>
}

const SHAPE_STYLE: Record<IRNode['role'], { fill: string; stroke: string; text: string; dashed?: boolean }> = {
  box: { fill: color.nodeFill, stroke: color.borderSubtle, text: color.textPrimary },
  round: { fill: color.nodeFill, stroke: color.borderSubtle, text: color.textPrimary },
  pill: { fill: color.nodeFill, stroke: color.borderSubtle, text: color.textPrimary },
  hexagon: { fill: color.nodeFill, stroke: color.borderSubtle, text: color.textPrimary },
  decision: { fill: color.nodeFill, stroke: 'none', text: color.textPrimary },
  circle: { fill: color.nodeFill, stroke: color.borderSubtle, text: color.textPrimary },
  accent: { fill: color.nodeAccentFill, stroke: 'none', text: color.textOnAccent },
  muted: { fill: color.mutedFill, stroke: color.mutedStroke, text: color.textSecondary, dashed: true },
}

export function DiagramSvg({ ir, boxes, layout, svgRef }: Props) {
  const uid = useId().replace(/[:]/g, '')
  const arrowId = `arrow-${uid}`
  const accentGradientId = `accent-grad-${uid}`

  const fontSpec = useMemo(
    () => ({ family: font.family, weight: font.weight.regular, size: typography.node.size }),
    [],
  )
  const edgeGeometry = useMemo(
    () => buildEdgeGeometries(ir, layout, fontSpec, measurer),
    [ir, layout, fontSpec],
  )

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
      width={layout.width}
      height={layout.height}
      style={{ display: 'block', maxWidth: '100%', height: 'auto', fontFamily: font.family }}
      role="img"
      aria-label="Схема"
    >
      <defs>
        <ArrowMarker id={arrowId} fill={color.edgeAccent} />
        <linearGradient id={accentGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color.gradientFrom} />
          <stop offset="100%" stopColor={color.gradientTo} />
        </linearGradient>
      </defs>

      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {/* группы (subgraph): пунктирный контейнер вокруг своих узлов */}
      <g>
        {ir.groups.map((group) => {
          const bbox = layout.groups?.[group.id]
          if (!bbox) return null
          const label = group.label?.lines.map((l) => l.map((r) => r.text).join('')).join(' ') ?? ''
          return (
            <g key={group.id}>
              <rect
                x={bbox.x}
                y={bbox.y}
                width={bbox.width}
                height={bbox.height}
                rx={size.radius + 4}
                fill="none"
                stroke={color.groupStroke}
                strokeWidth={1}
                strokeDasharray="6 4"
              />
              {label && (
                <text x={bbox.x + 12} y={bbox.y + 20} fontSize={14} fill={color.groupLabel}>
                  {label}
                </text>
              )}
            </g>
          )
        })}
      </g>

      {/* рёбра рисуем до узлов, чтобы линии уходили под фигуры */}
      <g>
        {edgeGeometry.map((edge, i) => {
          if (edge.points.length < 2) return null
          const irEdge = ir.edges[i]
          const strokeWidth = irEdge.kind === 'thick' ? size.edgeWidthThick : size.edgeWidth
          const dash = irEdge.kind === 'dashed' ? size.dash : undefined

          return (
            <path
              key={edge.id}
              d={buildOrthogonalPath(edge.points)}
              fill="none"
              stroke={color.edgeAccent}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
              strokeLinejoin="round"
              strokeLinecap="round"
              markerEnd={irEdge.arrow === 'none' ? undefined : `url(#${arrowId})`}
              markerStart={irEdge.arrow === 'both' ? `url(#${arrowId})` : undefined}
            />
          )
        })}
      </g>

      {/* подписи рёбер — на белой подложке, как в референсах */}
      <g>
        {edgeGeometry.map((edge) => {
          const label = edge.label
          if (!label) return null
          return (
            <g key={`label-${edge.id}`}>
              <rect
                x={label.x - label.width / 2}
                y={label.y - label.height / 2}
                width={label.width}
                height={label.height}
                fill={color.edgeLabelBg}
                rx={4}
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={typography.edgeLabel.size}
                fill={color.textSecondary}
              >
                {label.text}
              </text>
            </g>
          )
        })}
      </g>

      {/* узлы */}
      <g>
        {ir.nodes.map((node) => {
          const box = boxes[node.id]
          const placement = layout.nodes[node.id]
          if (!box || !placement) return null
          return (
            <NodeShape
              key={node.id}
              node={node}
              box={box}
              x={placement.x}
              y={placement.y}
              accentGradientId={accentGradientId}
            />
          )
        })}
      </g>
    </svg>
  )
}

function ArrowMarker({ id, fill }: { id: string; fill: string }) {
  const a = size.arrow
  return (
    <marker
      id={id}
      viewBox={`0 0 ${a} ${a}`}
      refX={a - 1}
      refY={a / 2}
      markerWidth={a}
      markerHeight={a}
      markerUnits="userSpaceOnUse"
      orient="auto-start-reverse"
    >
      <path d={`M 0 0 L ${a} ${a / 2} L 0 ${a} z`} fill={fill} />
    </marker>
  )
}

function NodeShape({
  node,
  box,
  x,
  y,
  accentGradientId,
}: {
  node: IRNode
  box: NodeBox
  x: number
  y: number
  accentGradientId: string
}) {
  const style = SHAPE_STYLE[node.role]
  const fill = node.role === 'accent' ? `url(#${accentGradientId})` : style.fill

  return (
    <g>
      {shapeElement(node.role, x, y, box.width, box.height, fill, style.stroke, style.dashed)}
      <NodeText box={box} x={x} y={y} fill={style.text} />
    </g>
  )
}

function shapeElement(
  role: IRNode['role'],
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  dashed?: boolean,
) {
  const strokeProps = {
    stroke,
    strokeWidth: stroke === 'none' ? 0 : size.strokeWidth,
    strokeDasharray: dashed ? '6 4' : undefined,
  }

  switch (role) {
    case 'pill':
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} {...strokeProps} />
    case 'circle': {
      const r = Math.min(w, h) / 2
      return <circle cx={x + w / 2} cy={y + h / 2} r={r} fill={fill} {...strokeProps} />
    }
    case 'decision': {
      const cx = x + w / 2
      const cy = y + h / 2
      return <polygon points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`} fill={fill} {...strokeProps} />
    }
    case 'hexagon': {
      const inset = Math.min(w * 0.15, h / 2)
      const cy = y + h / 2
      return (
        <polygon
          points={`${x + inset},${y} ${x + w - inset},${y} ${x + w},${cy} ${x + w - inset},${y + h} ${x + inset},${y + h} ${x},${cy}`}
          fill={fill}
          {...strokeProps}
        />
      )
    }
    default:
      return <rect x={x} y={y} width={w} height={h} rx={size.radius} fill={fill} {...strokeProps} />
  }
}

/** Текст узла: строки из fit-text, центрированные; начертания — из прогонов. */
function NodeText({ box, x, y, fill }: { box: NodeBox; x: number; y: number; fill: string }) {
  const { lines, fontSize, lineHeight } = box.fit
  if (!lines.length) return null

  const totalHeight = lines.length * lineHeight
  const centerX = x + box.width / 2
  const firstLineCenterY = y + (box.height - totalHeight) / 2 + lineHeight / 2

  return (
    <g>
      {lines.map((line, i) => (
        <text
          key={i}
          x={centerX}
          y={firstLineCenterY + i * lineHeight}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fill={fill}
          style={{ whiteSpace: 'pre' }}
        >
          {line.runs.length ? (
            line.runs.map((run: InlineRun, j: number) => (
              <tspan
                key={j}
                fontWeight={run.bold ? font.weight.semibold : font.weight.regular}
                fontStyle={run.italic ? 'italic' : undefined}
                fontFamily={run.code ? font.mono : undefined}
              >
                {run.text}
              </tspan>
            ))
          ) : (
            '\u00A0'
          )}
        </text>
      ))}
    </g>
  )
}
