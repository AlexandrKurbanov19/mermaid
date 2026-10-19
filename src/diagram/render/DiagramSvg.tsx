import { useId } from 'react'
import type { DiagramIR, InlineRun, IRNode } from '../ir'
import type { NodeBox } from '../measure/measureNode'
import type { Layout } from '../layout/layoutElk'
import { buildOrthogonalPath } from '../layout/layoutElk'
import { color, font, size } from '../theme'

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

const SHAPE_STYLE: Record<IRNode['role'], { fill: string; stroke: string; text: string }> = {
  box: { fill: color.nodeFill, stroke: 'none', text: color.textPrimary },
  round: { fill: color.nodeFill, stroke: 'none', text: color.textPrimary },
  pill: { fill: color.nodeFill, stroke: 'none', text: color.textPrimary },
  hexagon: { fill: color.nodeFill, stroke: 'none', text: color.textPrimary },
  decision: { fill: color.nodeFill, stroke: 'none', text: color.textPrimary },
  circle: { fill: color.nodeFill, stroke: 'none', text: color.textPrimary },
  accent: { fill: color.nodeAccentFill, stroke: 'none', text: color.textOnAccent },
}

export function DiagramSvg({ ir, boxes, layout, svgRef }: Props) {
  const uid = useId().replace(/[:]/g, '')
  const markerId = `arrow-${uid}`
  const markerAccentId = `arrow-accent-${uid}`

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
        <ArrowMarker id={markerId} fill={color.edgeAccent} />
        <ArrowMarker id={markerAccentId} fill={color.edgeAccent} />
      </defs>

      <rect x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {/* группы (subgraph): пунктирный контейнер вокруг своих узлов */}
      <g>
        {ir.groups.map((group) => {
          const bbox = groupBBox(group.nodeIds, layout)
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
                <text
                  x={bbox.x + 12}
                  y={bbox.y + 16}
                  fontSize={14}
                  fill={color.groupLabel}
                >
                  {label}
                </text>
              )}
            </g>
          )
        })}
      </g>

      {/* рёбра рисуем до узлов, чтобы линии уходили под фигуры */}
      <g>
        {ir.edges.map((edge) => {
          const placement = layout.edges.find((e) => e.id === edge.id)
          if (!placement || placement.points.length < 2) return null

          const strokeWidth = edge.kind === 'thick' ? size.edgeWidthThick : size.edgeWidth
          const dash = edge.kind === 'dashed' ? size.dash : undefined

          return (
            <path
              key={edge.id}
              d={buildOrthogonalPath(placement.points)}
              fill="none"
              stroke={color.edgeAccent}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
              strokeLinejoin="round"
              strokeLinecap="round"
              markerEnd={edge.arrow === 'none' ? undefined : `url(#${markerId})`}
              markerStart={edge.arrow === 'both' ? `url(#${markerId})` : undefined}
            />
          )
        })}
      </g>

      {/* подписи рёбер — на белой подложке, как в референсах */}
      <g>
        {ir.edges.map((edge) => {
          if (!edge.label?.lines.length) return null
          const placement = layout.edges.find((e) => e.id === edge.id)
          const point = placement?.labelPoint
          if (!point) return null

          const text = edge.label.lines.map((line) => line.map((r) => r.text).join('')).join(' ')
          const fontSize = 16
          const width = text.length * fontSize * 0.55 + 8
          const height = fontSize * 1.3

          return (
            <g key={`label-${edge.id}`}>
              <rect
                x={point.x - width / 2}
                y={point.y - height / 2}
                width={width}
                height={height}
                fill={color.edgeLabelBg}
                rx={4}
              />
              <text
                x={point.x}
                y={point.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fill={color.textSecondary}
              >
                {text}
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
          return <NodeShape key={node.id} node={node} box={box} x={placement.x} y={placement.y} />
        })}
      </g>
    </svg>
  )
}

/** Габарит группы = bounding box её узлов + отступ. ELK про группы не знает, считаем после раскладки. */
function groupBBox(nodeIds: string[], layout: Layout) {
  const placed = nodeIds.map((id) => layout.nodes[id]).filter(Boolean)
  if (!placed.length) return null

  const pad = 24
  const minX = Math.min(...placed.map((n) => n.x)) - pad
  const minY = Math.min(...placed.map((n) => n.y)) - pad - 8
  const maxX = Math.max(...placed.map((n) => n.x + n.width)) + pad
  const maxY = Math.max(...placed.map((n) => n.y + n.height)) + pad

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
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

function NodeShape({ node, box, x, y }: { node: IRNode; box: NodeBox; x: number; y: number }) {
  const style = SHAPE_STYLE[node.role]
  const { width: w, height: h } = box

  return (
    <g>
      {shapeElement(node.role, x, y, w, h, style.fill)}
      <NodeText box={box} x={x} y={y} fill={style.text} />
    </g>
  )
}

function shapeElement(role: IRNode['role'], x: number, y: number, w: number, h: number, fill: string) {
  const stroke = color.nodeStroke
  const strokeWidth = size.strokeWidth

  switch (role) {
    case 'pill':
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} stroke="none" />
    case 'circle': {
      const r = Math.min(w, h) / 2
      return <circle cx={x + w / 2} cy={y + h / 2} r={r} fill={fill} stroke="none" />
    }
    case 'decision': {
      const cx = x + w / 2
      const cy = y + h / 2
      return (
        <polygon
          points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`}
          fill={fill}
          stroke="none"
        />
      )
    }
    case 'hexagon': {
      const inset = Math.min(w * 0.15, h / 2)
      const cy = y + h / 2
      return (
        <polygon
          points={`${x + inset},${y} ${x + w - inset},${y} ${x + w},${cy} ${x + w - inset},${y + h} ${x + inset},${y + h} ${x},${cy}`}
          fill={fill}
          stroke="none"
        />
      )
    }
    case 'box':
    case 'round':
    case 'accent':
    default:
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={size.radius}
          fill={fill}
          stroke={color.borderSubtle}
          strokeWidth={strokeWidth}
        />
      )
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
