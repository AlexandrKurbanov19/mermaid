import type { MindmapIR } from '../ir'
import type { MindmapLayout } from '../layout/layoutMindmap'
import { color, font, size } from '../theme'

/**
 * Рендер mindmap: узлы-блоки + изогнутые связи от родителя к детям.
 */

interface Props {
  ir: MindmapIR
  layout: MindmapLayout
  svgRef?: React.Ref<SVGSVGElement>
}

export function MindmapSvg({ ir, layout, svgRef }: Props) {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]))

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
      width={layout.width}
      height={layout.height}
      style={{ display: 'block', overflow: 'visible', fontFamily: font.family }}
      role="img"
      aria-label="Mindmap"
    >
      <rect id="canvas-bg" x={0} y={0} width={layout.width} height={layout.height} fill={color.canvas} />

      {/* связи (изогнутые) */}
      <g>
        {layout.edges.map((edge, i) => {
          const from = byId.get(edge.from)!
          const to = byId.get(edge.to)!
          const x1 = from.x + from.width
          const y1 = from.y + from.height / 2
          const x2 = to.x
          const y2 = to.y + to.height / 2
          const mx = (x1 + x2) / 2
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={color.edgeAccent}
              strokeWidth={1.5}
            />
          )
        })}
      </g>

      {/* узлы */}
      <g>
        {layout.nodes.map((node, i) => (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx={node.id === ir.root.id ? 20 : 10}
              fill={node.id === ir.root.id ? color.brandNeo : color.nodeFill}
              stroke={node.id === ir.root.id ? 'none' : color.borderSubtle}
              strokeWidth={size.strokeWidth}
            />
            <text
              x={node.x + node.width / 2}
              y={node.y + node.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={15}
              fontWeight={node.id === ir.root.id ? 600 : 400}
              fill={node.id === ir.root.id ? color.textOnAccent : color.textPrimary}
            >
              {node.text}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
