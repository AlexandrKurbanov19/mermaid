import { useId, useMemo } from 'react'
import type { InlineRun, StateIR } from '../ir'
import type { NodeBox } from '../measure/measureNode'
import type { Layout } from '../layout/layoutElk'
import { buildOrthogonalPath } from '../layout/layoutElk'
import { stateToFlowchart } from '../layout/stateAdapter'
import { buildEdgeGeometries } from './edgeLayout'
import { ArrowMarker } from './markers'
import { measurer } from '../measure/textMetrics'
import { START_END_SIZE } from '../measure/measureState'
import { color, font, size, type as typography } from '../theme'

/**
 * Рендер state-диаграммы.
 *
 * pass 1: start/end — кружки, состояния — скруглённые блоки, переходы — орто-стрелки
 * с подписями. choice/fork/join/composite — в pass 2.
 */

interface Props {
  ir: StateIR
  boxes: Record<string, NodeBox>
  layout: Layout
  svgRef?: React.Ref<SVGSVGElement>
}

export function StateSvg({ ir, boxes, layout, svgRef }: Props) {
  const uid = useId().replace(/[:]/g, '')
  const arrowId = `state-arrow-${uid}`

  const fontSpec = useMemo(
    () => ({ family: font.family, weight: font.weight.regular, size: typography.node.size }),
    [],
  )
  const edgeGeometry = useMemo(
    () => buildEdgeGeometries(stateToFlowchart(ir), layout, fontSpec, measurer),
    [ir, layout, fontSpec],
  )

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
      width={layout.width}
      height={layout.height}
      style={{ display: 'block', overflow: 'visible', fontFamily: font.family }}
      role="img"
      aria-label="Диаграмма состояний"
    >
      <defs>
        <ArrowMarker id={arrowId} fill={color.edgeAccent} />
      </defs>

      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {/* composite-группы */}
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
                stroke={color.groupStrokeNeutral}
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

      {/* переходы */}
      <g>
        {edgeGeometry.map((edge) => {
          if (edge.points.length < 2) return null
          const transition = ir.transitions.find((t) => t.id === edge.id)
          return (
            <path
              key={edge.id}
              d={buildOrthogonalPath(edge.points)}
              fill="none"
              stroke={color.edgeAccent}
              strokeWidth={size.edgeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              markerEnd={`url(#${arrowId})`}
            />
          )
        })}
      </g>

      {/* подписи переходов */}
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
          const placement = layout.nodes[node.id]
          if (!placement) return null

          if (node.kind === 'start' || node.kind === 'end') {
            const cx = placement.x + START_END_SIZE / 2
            const cy = placement.y + START_END_SIZE / 2
            return (
              <g key={node.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={START_END_SIZE / 2}
                  fill={node.kind === 'start' ? color.brandNeo : color.canvas}
                  stroke={node.kind === 'start' ? 'none' : color.brandNeo}
                  strokeWidth={node.kind === 'start' ? 0 : size.strokeWidth}
                />
                {node.kind === 'end' && <circle cx={cx} cy={cy} r={START_END_SIZE / 4} fill={color.brandNeo} />}
              </g>
            )
          }

          const box = boxes[node.id]
          if (!box) return null
          return (
            <StateNode
              key={node.id}
              node={node}
              box={box}
              x={placement.x}
              y={placement.y}
            />
          )
        })}
      </g>
    </svg>
  )
}

function StateNode({ node, box, x, y }: { node: StateIR['nodes'][number]; box: NodeBox; x: number; y: number }) {
  // fork/join — горизонтальная черта (как в UML)
  if (node.kind === 'fork' || node.kind === 'join') {
    return (
      <rect
        x={x}
        y={y + box.height / 2 - 6}
        width={box.width}
        height={12}
        rx={6}
        fill={color.brandNeo}
      />
    )
  }

  // choice — ромб
  if (node.kind === 'choice') {
    const cx = x + box.width / 2
    const cy = y + box.height / 2
    return (
      <g>
        <polygon
          points={`${cx},${y} ${x + box.width},${cy} ${cx},${y + box.height} ${x},${cy}`}
          fill={color.nodeFill}
          stroke={color.borderSubtle}
          strokeWidth={size.strokeWidth}
        />
        <StateLabel box={box} x={x} y={y} />
      </g>
    )
  }

  // state / composite
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={box.width}
        height={box.height}
        rx={size.radius}
        fill={color.nodeFill}
        stroke={color.borderSubtle}
        strokeWidth={size.strokeWidth}
      />
      <StateLabel box={box} x={x} y={y} />
    </g>
  )
}

function StateLabel({ box, x, y }: { box: NodeBox; x: number; y: number }) {
  const { lines, fontSize, lineHeight } = box.fit
  if (!lines.length) return null
  const totalHeight = lines.length * lineHeight
  const firstLineY = y + (box.height - totalHeight) / 2 + lineHeight / 2
  return (
    <g>
      {lines.map((line, i) => (
        <text
          key={i}
          x={x + box.width / 2}
          y={firstLineY + i * lineHeight}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fill={color.textPrimary}
        >
          {line.runs.length ? (
            line.runs.map((run: InlineRun, j) => (
              <tspan key={j} fontWeight={run.bold ? font.weight.semibold : font.weight.regular}>
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
