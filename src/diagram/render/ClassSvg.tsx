import { useId, useMemo } from 'react'
import type { ClassIR, ClassRelation } from '../ir'
import type { NodeBox } from '../measure/measureNode'
import type { ClassDetails } from '../measure/measureClass'
import type { Layout, Point } from '../layout/layoutElk'
import { buildOrthogonalPath } from '../layout/layoutElk'
import { classToFlowchart } from '../layout/classAdapter'
import { buildEdgeGeometries } from './edgeLayout'
import { ArrowMarker } from './markers'
import { measurer } from '../measure/textMetrics'
import { color, font, size, type as typography } from '../theme'

/**
 * Рендер class-диаграммы: блоки с секциями + стрелки отношений.
 */

interface Props {
  ir: ClassIR
  boxes: Record<string, NodeBox>
  details: Record<string, ClassDetails>
  layout: Layout
  svgRef?: React.Ref<SVGSVGElement>
}

export function ClassSvg({ ir, boxes, details, layout, svgRef }: Props) {
  const uid = useId().replace(/[:]/g, '')
  const arrowId = `class-arrow-${uid}`

  const fontSpec = useMemo(
    () => ({ family: font.family, weight: font.weight.regular, size: typography.node.size }),
    [],
  )
  const edgeGeometry = useMemo(
    () => buildEdgeGeometries(classToFlowchart(ir), layout, fontSpec, measurer),
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
      aria-label="Диаграмма классов"
    >
      <defs>
        <ArrowMarker id={arrowId} fill={color.edgeAccent} />
      </defs>

      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {/* отношения */}
      <g>
        {edgeGeometry.map((edge) => {
          if (edge.points.length < 2) return null
          const relation = ir.relations.find((r) => r.id === edge.id)
          if (!relation) return null
          const dashed = relation.style === 'dependency'
          return (
            <g key={edge.id}>
              <path
                d={buildOrthogonalPath(edge.points)}
                fill="none"
                stroke={color.edgeAccent}
                strokeWidth={size.edgeWidth}
                strokeDasharray={dashed ? '6 4' : undefined}
              />
              <RelationSymbol relation={relation} points={edge.points} arrowId={arrowId} />
            </g>
          )
        })}
      </g>

      {/* подписи отношений */}
      <g>
        {edgeGeometry.map((edge) => {
          const label = edge.label
          if (!label) return null
          return (
            <g key={`label-${edge.id}`}>
              <rect x={label.x - label.width / 2} y={label.y - label.height / 2} width={label.width} height={label.height} fill={color.edgeLabelBg} rx={4} />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={13} fill={color.textSecondary}>
                {label.text}
              </text>
            </g>
          )
        })}
      </g>

      {/* классы */}
      <g>
        {ir.nodes.map((node) => {
          const placement = layout.nodes[node.id]
          const box = boxes[node.id]
          if (!placement || !box) return null
          return <ClassBox key={node.id} details={details[node.id]} x={placement.x} y={placement.y} width={box.width} height={box.height} />
        })}
      </g>
    </svg>
  )
}

/** Маркер на концах отношения: треугольник наследования/ассоциации, ромб агрегации/композиции. */
function RelationSymbol({ relation, points, arrowId }: { relation: ClassRelation; points: Point[]; arrowId: string }) {
  const first = points[0]
  const last = points[points.length - 1]

  // ромб у начала (owner)
  if (relation.style === 'aggregation' || relation.style === 'composition') {
    const dir = points.length > 1 ? { x: points[1].x - first.x, y: points[1].y - first.y } : { x: 1, y: 0 }
    const len = Math.hypot(dir.x, dir.y) || 1
    const ux = dir.x / len
    const uy = dir.y / len
    const s = 8
    const nx = -uy
    const ny = ux
    const pointsStr = `${first.x - ux * s},${first.y - uy * s} ${first.x + nx * s},${first.y + ny * s} ${first.x + ux * s},${first.y + uy * s} ${first.x - nx * s},${first.y - ny * s}`
    return (
      <polygon
        points={pointsStr}
        fill={relation.style === 'composition' ? color.edgeAccent : color.canvas}
        stroke={color.edgeAccent}
        strokeWidth={size.strokeWidth}
      />
    )
  }

  // стрелка у конца
  const dirEnd = points.length > 1 ? { x: last.x - points[points.length - 2].x, y: last.y - points[points.length - 2].y } : { x: 1, y: 0 }
  const useInheritance = relation.style === 'inheritance'
  return (
    <polygon
      points={arrowHead(last, dirEnd, useInheritance ? 10 : 8)}
      fill={useInheritance ? color.edgeAccent : 'none'}
      stroke={color.edgeAccent}
      strokeWidth={useInheritance ? 0 : 1.2}
    />
  )
}

function arrowHead(tip: Point, dir: Point, a: number): string {
  const len = Math.hypot(dir.x, dir.y) || 1
  const ux = dir.x / len
  const uy = dir.y / len
  const nx = -uy
  const ny = ux
  return `${tip.x},${tip.y} ${tip.x - ux * a + nx * a / 2},${tip.y - uy * a + ny * a / 2} ${tip.x - ux * a - nx * a / 2},${tip.y - uy * a - ny * a / 2}`
}

function ClassBox({ details, x, y, width, height }: { details: ClassDetails; x: number; y: number; width: number; height: number }) {
  const { name, fields, methods, annotations } = details
  const isAbstract = annotations.includes('abstract') || annotations.includes('<<abstract>>')
  const isInterface = annotations.includes('interface') || annotations.includes('<<interface>>')

  let cursor = y + 24
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} fill={color.canvas} stroke={color.borderSubtle} strokeWidth={size.strokeWidth} />
      <text x={x + width / 2} y={cursor} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={600} fontStyle={isAbstract ? 'italic' : undefined} fill={color.textPrimary}>
        {isInterface ? `«interface» ${name}` : name}
      </text>
      <line x1={x} y1={y + 32} x2={x + width} y2={y + 32} stroke={color.borderSubtle} strokeWidth={1} />
      {fields.length > 0 && (
        <g>
          {fields.map((f, i) => (
            <text key={i} x={x + 12} y={y + 44 + i * 20} fontSize={13} fill={color.textPrimary}>
              {f}
            </text>
          ))}
          <line x1={x} y1={y + 44 + fields.length * 20 + 2} x2={x + width} y2={y + 44 + fields.length * 20 + 2} stroke={color.borderSubtle} strokeWidth={1} />
        </g>
      )}
      {methods.map((m, i) => (
        <text key={i} x={x + 12} y={y + 44 + fields.length * 20 + 12 + i * 20} fontSize={13} fill={color.textPrimary}>
          {m}
        </text>
      ))}
    </g>
  )
}
