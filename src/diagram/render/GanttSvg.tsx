import type { GanttIR } from '../ir'
import type { GanttLayout } from '../layout/layoutGantt'
import { color, font } from '../theme'

/**
 * Рендер gantt: секции, задачи-бары, шкала времени.
 */

interface Props {
  ir: GanttIR
  layout: GanttLayout
  svgRef?: React.Ref<SVGSVGElement>
}

export function GanttSvg({ ir, layout, svgRef }: Props) {
  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
      width={layout.width}
      height={layout.height}
      style={{ display: 'block', overflow: 'visible', fontFamily: font.family }}
      role="img"
      aria-label={ir.title ?? 'Gantt'}
    >
      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {ir.title && (
        <text x={24} y={20} fontSize={18} fontWeight={600} fill={color.textPrimary}>
          {ir.title}
        </text>
      )}

      {/* шкала времени */}
      <g>
        {layout.axis.ticks.map((tick, i) => (
          <g key={i}>
            <line x1={tick.x} y1={ir.title ? 44 : 16} x2={tick.x} y2={layout.height - 24} stroke={color.borderSubtle} strokeWidth={1} />
            <text x={tick.x} y={ir.title ? 38 : 10} textAnchor="middle" fontSize={11} fill={color.textSecondary}>
              {tick.label}
            </text>
          </g>
        ))}
      </g>

      {/* строки */}
      <g>
        {layout.rows.map((row, i) =>
          row.kind === 'section' ? (
            <text key={i} x={24} y={row.y + 20} fontSize={15} fontWeight={600} fill={color.textSecondary}>
              {row.name}
            </text>
          ) : (
            <g key={i}>
              <text x={24} y={row.y + 20} fontSize={13} fill={color.textPrimary}>
                {row.name}
              </text>
              <rect
                x={row.x}
                y={row.y + 6}
                width={row.width}
                height={ROW_BAR_H}
                rx={6}
                fill={color.brandNeo}
              />
              <text x={(row.x ?? 0) + (row.width ?? 0) + 6} y={row.y + 20} fontSize={11} fill={color.textSecondary}>
                {row.endLabel}
              </text>
            </g>
          ),
        )}
      </g>
    </svg>
  )
}

const ROW_BAR_H = 18
