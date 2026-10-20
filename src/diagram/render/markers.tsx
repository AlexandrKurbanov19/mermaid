import { color, size } from '../theme'

/** Общий наконечник стрелки — используется flowchart и state. */
export function ArrowMarker({ id, fill }: { id: string; fill: string }) {
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
