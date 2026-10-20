import { useMemo } from 'react'
import type { ERIR, Relationship } from '../ir'
import type { NodeBox } from '../measure/measureNode'
import { ER_GEOM, type EntityDetails } from '../measure/measureEr'
import type { Layout, Point } from '../layout/layoutElk'
import { buildOrthogonalPath } from '../layout/layoutElk'
import { erToFlowchart } from '../layout/erAdapter'
import { buildEdgeGeometries } from './edgeLayout'
import { measurer } from '../measure/textMetrics'
import { color, font, size, type as typography } from '../theme'

/**
 * Рендер ER-диаграммы: сущности с атрибутами + связи с кардинальностью.
 */

interface Props {
  ir: ERIR
  boxes: Record<string, NodeBox>
  details: Record<string, EntityDetails>
  layout: Layout
  svgRef?: React.Ref<SVGSVGElement>
}

const CARD_LABEL: Record<string, string> = {
  ONLY_ONE: '1',
  ZERO_OR_ONE: '0..1',
  ONE_OR_MORE: '1..*',
  ZERO_OR_MORE: '*',
}

export function ErSvg({ ir, boxes, details, layout, svgRef }: Props) {
  const fontSpec = useMemo(
    () => ({ family: font.family, weight: font.weight.regular, size: typography.node.size }),
    [],
  )
  const edgeGeometry = useMemo(
    () => buildEdgeGeometries(erToFlowchart(ir), layout, fontSpec, measurer),
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
      aria-label="ER-диаграмма"
    >
      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {/* связи */}
      <g>
        {edgeGeometry.map((edge) => {
          if (edge.points.length < 2) return null
          const rel = ir.relationships.find((r) => r.id === edge.id)
          if (!rel) return null
          return (
            <g key={edge.id}>
              <path
                d={buildOrthogonalPath(edge.points)}
                fill="none"
                stroke={color.edgeAccent}
                strokeWidth={size.edgeWidth}
                strokeDasharray={rel.identifying ? undefined : '6 4'}
              />
              <Cardinality rel={rel} points={edge.points} />
            </g>
          )
        })}
      </g>

      {/* подписи ролей */}
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

      {/* сущности */}
      <g>
        {ir.entities.map((e) => {
          const placement = layout.nodes[e.id]
          const box = boxes[e.id]
          if (!placement || !box) return null
          return <EntityBox key={e.id} details={details[e.id]} x={placement.x} y={placement.y} width={box.width} height={box.height} />
        })}
      </g>
    </svg>
  )
}

function Cardinality({ rel, points }: { rel: Relationship; points: Point[] }) {
  const from = points[0]
  const to = points[points.length - 1]

  const norm = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy) || 1
    return { x: dx / len, y: dy / len }
  }

  // кардинальность ставим В зазор: у from — по направлению линии, у to — против
  const fromDir = points.length > 1 ? norm(points[1].x - from.x, points[1].y - from.y) : { x: 1, y: 0 }
  const toDir = points.length > 1 ? norm(to.x - points[points.length - 2].x, to.y - points[points.length - 2].y) : { x: 1, y: 0 }

  const items: { card: string; x: number; y: number }[] = []
  if (rel.cardA && CARD_LABEL[rel.cardA]) items.push({ card: CARD_LABEL[rel.cardA], x: from.x + fromDir.x * 14, y: from.y + fromDir.y * 14 })
  if (rel.cardB && CARD_LABEL[rel.cardB]) items.push({ card: CARD_LABEL[rel.cardB], x: to.x - toDir.x * 14, y: to.y - toDir.y * 14 })

  return (
    <g>
      {items.map((l, i) => (
        <text key={i} x={l.x} y={l.y - 7} textAnchor="middle" fontSize={13} fontWeight={600} fill={color.textPrimary}>
          {l.card}
        </text>
      ))}
    </g>
  )
}

function EntityBox({ details, x, y, width, height }: { details: EntityDetails; x: number; y: number; width: number; height: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} fill={color.canvas} stroke={color.borderSubtle} strokeWidth={size.strokeWidth} />
      <text x={x + width / 2} y={y + ER_GEOM.nameCenter} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={600} fill={color.textPrimary}>
        {details.name}
      </text>
      <line x1={x} y1={y + ER_GEOM.divider} x2={x + width} y2={y + ER_GEOM.divider} stroke={color.borderSubtle} strokeWidth={1} />
      {details.attributes.map((a, i) => (
        <text key={i} x={x + 12} y={y + ER_GEOM.attrStart + i * ER_GEOM.attrH} fontSize={13} fill={color.textPrimary}>
          {a.keys.includes('PK') ? '🔑 ' : a.keys.includes('FK') ? '🔗 ' : ''}
          {a.line}
        </text>
      ))}
    </g>
  )
}
