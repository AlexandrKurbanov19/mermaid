import type { JourneyIR } from '../ir'
import type { JourneyLayout } from '../layout/layoutJourney'
import { color, font, size } from '../theme'

/**
 * Рендер journey: секции + строки задач с оценкой 1–5 (точки).
 */

interface Props {
  ir: JourneyIR
  layout: JourneyLayout
  svgRef?: React.Ref<SVGSVGElement>
}

export function JourneySvg({ ir, layout, svgRef }: Props) {
  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
      width={layout.width}
      height={layout.height}
      style={{ display: 'block', overflow: 'visible', fontFamily: font.family }}
      role="img"
      aria-label={ir.title ?? 'Journey'}
    >
      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {ir.title && (
        <text x={24} y={20} fontSize={18} fontWeight={600} fill={color.textPrimary}>
          {ir.title}
        </text>
      )}

      {layout.rows.map((row, i) =>
        row.kind === 'section' ? (
          <text key={i} x={24} y={row.y + 22} fontSize={15} fontWeight={600} fill={color.textSecondary}>
            {row.name}
          </text>
        ) : (
          <g key={i}>
            <text x={24} y={row.y + 22} fontSize={14} fill={color.textPrimary}>
              {row.name}
            </text>
            {[1, 2, 3, 4, 5].map((d) => (
              <circle
                key={d}
                cx={layout.width - 200 + d * 22}
                cy={row.y + 22}
                r={6}
                fill={(row.score ?? 0) >= d ? color.brandNeo : color.nodeFill}
                stroke={color.borderSubtle}
                strokeWidth={1}
              />
            ))}
            {row.people && (
              <text x={layout.width - 70} y={row.y + 22} fontSize={12} fill={color.textSecondary}>
                {row.people}
              </text>
            )}
          </g>
        ),
      )}
    </svg>
  )
}
