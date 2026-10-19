import { useCallback, useEffect, useRef, useState } from 'react'
import { color } from '../theme'

/**
 * Превью схемы с зумом (колесо, кнопки) и панорамированием (перетаскивание мышью).
 *
 * Два важных решения:
 *  1. Трансформация применяется к обёртке, а НЕ к самому <svg> — поэтому экспорт
 *     не зависит от текущего зума.
 *  2. Панорама ограничивается с учётом зума: схему нельзя утащить за пределы окна
 *     (при увеличении — не даём открыть «пустоту», при уменьшении — держим в кадре).
 */

interface Props {
  width: number
  height: number
  /** меняется при смене схемы: тогда вид сбрасывается на «вписать» */
  contentKey?: string
  children: React.ReactNode
}

interface View {
  scale: number
  x: number
  y: number
}

const MIN_SCALE = 0.2
const MAX_SCALE = 4
/** сколько «пустоты» разрешаем по краям, px */
const SLACK = 80

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Держит содержимое в кадре с учётом масштаба. */
function clampAxis(pos: number, viewport: number, content: number): number {
  if (content <= viewport) {
    // содержимое меньше окна: не даём уехать дальше, чем на SLACK
    return clamp(pos, -SLACK, Math.max(viewport - content, 0) + SLACK)
  }
  // содержимое больше окна: не даём открыть пустоту по краям
  return clamp(pos, viewport - content - SLACK, SLACK)
}

export function ZoomPane({ width, height, contentKey, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const viewRef = useRef<View>({ scale: 1, x: 0, y: 0 })
  const [view, setView] = useState<View>(viewRef.current)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  /** пока пользователь не двигал вьюпорт сам — держим «вписать в окно» при ресайзе */
  const autoFitRef = useRef(true)

  const apply = useCallback((next: View, clampIt = true) => {
    const el = containerRef.current
    let v = next
    if (clampIt && el) {
      v = {
        scale: next.scale,
        x: clampAxis(next.x, el.clientWidth, width * next.scale),
        y: clampAxis(next.y, el.clientHeight, height * next.scale),
      }
    }
    viewRef.current = v
    setView(v)
  }, [width, height])

  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el || !width || !height) return
    const scale = clamp(Math.min(el.clientWidth / width, el.clientHeight / height), MIN_SCALE, 1)
    autoFitRef.current = true
    apply(
      {
        scale,
        x: (el.clientWidth - width * scale) / 2,
        y: (el.clientHeight - height * scale) / 2,
      },
      false,
    )
  }, [width, height, apply])

  // новая схема — вписываем заново, даже если пользователь масштабировал предыдущую
  useEffect(() => {
    autoFitRef.current = true
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey])

  // габариты изменились (тот же контент) — тоже пересчитываем
  useEffect(() => {
    fit()
  }, [fit])

  // ресайз контейнера: если пользователь не масштабировал сам — переподгоняем,
  // иначе только пересчитываем допустимые границы панорамы
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      if (autoFitRef.current) fit()
      else apply(viewRef.current)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit, apply])

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = viewRef.current
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      if (scale === v.scale) return
      const ratio = scale / v.scale
      autoFitRef.current = false
      apply({ scale, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio })
    },
    [apply],
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
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-zoom-control]')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: viewRef.current.x, originY: viewRef.current.y }
    autoFitRef.current = false
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    apply({
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
