import type { SequenceIR } from '../ir'
import type { SeqLayout } from '../layout/layoutSequence'
import { ArrowMarker } from './markers'
import { color, font, size, type as typography } from '../theme'

/**
 * Рендер sequence (pass 1): актёры-lifeline, сообщения, заметки, фреймы
 * loop/alt/opt/par/rect. Активации — в pass 2.
 */

interface Props {
  ir: SequenceIR
  layout: SeqLayout
  svgRef?: React.Ref<SVGSVGElement>
}

const BLOCK_LABEL: Record<string, string> = {
  loop: 'loop',
  alt: 'alt',
  opt: 'opt',
  par: 'par',
  rect: '',
}

export function SequenceSvg({ ir, layout, svgRef }: Props) {
  const firstX = layout.actors[0]?.x ?? 40
  const lastActor = layout.actors[layout.actors.length - 1]
  const frameX1 = firstX - 24
  const frameX2 = (lastActor ? lastActor.x + lastActor.width : firstX) + 24
  const lifelineBottom = layout.height - 24

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      style={{ display: 'block', overflow: 'visible', fontFamily: font.family }}
      role="img"
      aria-label="Диаграмма последовательности"
    >
      <defs>
        <ArrowMarker id="seq-arrow" fill={color.edgeAccent} />
      </defs>

      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {/* фреймы блоков */}
      <g>
        {layout.frames.map((f, i) => (
          <g key={i}>
            <rect
              x={frameX1}
              y={f.y1}
              width={frameX2 - frameX1}
              height={Math.max(f.y2 - f.y1, ROW_FIX)}
              fill="none"
              stroke={color.groupStrokeNeutral}
              strokeWidth={1}
            />
            <rect
              x={frameX1}
              y={f.y1}
              width={120}
              height={20}
              fill={color.nodeFill}
              stroke={color.groupStrokeNeutral}
              strokeWidth={1}
            />
            <text x={frameX1 + 8} y={f.y1 + 14} fontSize={13} fill={color.textPrimary}>
              {BLOCK_LABEL[f.block]}
              {f.text ? ` ${f.text}` : ''}
            </text>
            {f.elseLines.map((e, j) => (
              <line
                key={j}
                x1={frameX1}
                y1={e.y}
                x2={frameX2}
                y2={e.y}
                stroke={color.groupStrokeNeutral}
                strokeWidth={1}
                strokeDasharray="6 4"
              />
            ))}
          </g>
        ))}
      </g>

      {/* актёры и lifeline */}
      <g>
        {layout.actors.map((a) => (
          <g key={a.id}>
            <rect
              x={a.x - a.width / 2}
              y={16}
              width={a.width}
              height={36}
              rx={8}
              fill={color.nodeFill}
              stroke={color.borderSubtle}
              strokeWidth={size.strokeWidth}
            />
            <text
              x={a.x}
              y={34}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={15}
              fontWeight={font.weight.semibold}
              fill={color.textPrimary}
            >
              {a.name}
            </text>
            <line
              x1={a.x}
              y1={52}
              x2={a.x}
              y2={lifelineBottom}
              stroke={color.borderSubtle}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </g>
        ))}
      </g>

      {/* сообщения и заметки */}
      <g>
        {layout.rows.map((row) => {
          if (row.kind === 'message') {
            const dash = row.style === 'dashed' ? '6 4' : undefined
            return (
              <g key={row.id}>
                <line
                  x1={row.from}
                  y1={row.y}
                  x2={row.to}
                  y2={row.y}
                  stroke={color.edgeAccent}
                  strokeWidth={1.5}
                  strokeDasharray={dash}
                  markerEnd="url(#seq-arrow)"
                />
                {row.text && (
                  <text
                    x={(row.from! + row.to!) / 2}
                    y={row.y - 8}
                    textAnchor="middle"
                    fontSize={13}
                    fill={color.textPrimary}
                  >
                    {row.text}
                  </text>
                )}
              </g>
            )
          }
          if (row.kind === 'note') {
            const w = 120
            const x = (row.from ?? firstX) + 24
            return (
              <g key={row.id}>
                <rect x={x} y={row.y - 16} width={w} height={32} rx={6} fill="#FFF7E6" stroke="#F3D9A4" strokeWidth={1} />
                <text x={x + w / 2} y={row.y} textAnchor="middle" dominantBaseline="central" fontSize={12} fill={color.textPrimary}>
                  {row.text}
                </text>
              </g>
            )
          }
          return null
        })}
      </g>
    </svg>
  )
}

/** рамки блоков не схлопываются при коротком теле */
const ROW_FIX = 0
