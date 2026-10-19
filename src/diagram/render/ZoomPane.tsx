import { useCallback, useEffect, useRef, useState } from 'react'
import { color } from '../theme'

/**
 * Превью схемы с зумом (колесо, кнопки) и панорамированием (перетаскивание мышью).
 *
 * Важно: трансформация применяется к обёртке, а НЕ к самому <svg>.
 * Поэтому экспорт не зависит от текущего зума и панорамы.
 */

interface Props {
  width: number
  height: number
  children: React.ReactNode
}

interface View {
  scale: number
  x: number
  y: number
}

const MIN_SCALE = 0.2
const MAX_SCALE = 4
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function ZoomPane({ width, height, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // держим актуальные значения в ref, чтобы обработчики не зависели от замыканий
  const viewRef = useRef<View>({ scale: 1, x: 0, y: 0 })
  const [view, setView] = useState<View>(viewRef.current)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const update = useCallback((next: View) => {
    viewRef.current = next
    setView(next)
  }, [])

  /** Вписать схему в контейнер (не увеличивая больше 100 %). */
  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el || !width || !height) return
    const scale = clamp(Math.min(el.clientWidth / width, el.clientHeight / height), MIN_SCALE, 1)
    update({
      scale,
      x: (el.clientWidth - width * scale) / 2,
      y: (el.clientHeight - height * scale) / 2,
    })
  }, [width, height, update])

  // новая схема (другие габариты) — вписываем заново
  useEffect(() => {
    fit()
  }, [fit])

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = viewRef.current
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      if (scale === v.scale) return
      const ratio = scale / v.scale
      update({ scale, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio })
    },
    [update],
  )

  // колесо = зум к курсору (нативный слушатель, чтобы можно было preventDefault)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // тащим только левой кнопкой/пальцем; на кнопках управления — не тащим
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-zoom-control]')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: viewRef.current.x, originY: viewRef.current.y }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    update({
      scale: viewRef.current.scale,
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    })
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const zoomByButton = (factor: number) => {
    const el = containerRef.current
    if (!el) return
    zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={fit}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: dragging ? 'none' : 'transform 80ms linear',
          willChange: 'transform',
        }}
      >
        {children}
      </div>

      <div
        data-zoom-control
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          background: 'rgba(255,255,255,0.92)',
          border: `1px solid ${color.borderSubtle}`,
          borderRadius: 10,
          padding: 4,
        }}
      >
        <ControlButton label="−" onClick={() => zoomByButton(1 / 1.2)} title="Уменьшить" />
        <button
          type="button"
          data-zoom-control
          onClick={fit}
          title="Вписать в окно"
          style={{
            border: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 12,
            color: color.textSecondary,
            cursor: 'pointer',
            minWidth: 44,
            padding: '2px 4px',
          }}
        >
          {Math.round(view.scale * 100)}%
        </button>
        <ControlButton label="+" onClick={() => zoomByButton(1.2)} title="Увеличить" />
        <ControlButton label="⤢" onClick={fit} title="Вписать в окно" />
      </div>
    </div>
  )
}

function ControlButton({ label, onClick, title }: { label: string; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      data-zoom-control
      onClick={onClick}
      title={title}
      style={{
        width: 26,
        height: 26,
        border: 'none',
        borderRadius: 8,
        background: color.nodeFill,
        color: color.textPrimary,
        fontFamily: 'inherit',
        fontSize: 14,
        lineHeight: 1,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
