import { useEffect, useMemo, useRef, useState } from 'react'
import { EXAMPLES, DEFAULT_EXAMPLE } from './examples'
import { parseMermaid, type ParseError } from './diagram/parse/parseMermaid'
import type { DiagramIR } from './diagram/ir'
import { measurer } from './diagram/measure/textMetrics'
import { measureNodes, type NodeBox } from './diagram/measure/measureNode'
import { layoutDiagram, type Layout } from './diagram/layout/layoutElk'
import { layoutTimeline } from './diagram/layout/layoutTimeline'
import { DiagramSvg } from './diagram/render/DiagramSvg'
import { TimelineSvg } from './diagram/render/TimelineSvg'
import { ZoomPane } from './diagram/render/ZoomPane'
import { SyntaxHelp } from './components/SyntaxHelp'
import { toSvgString, downloadSvg, downloadBlob } from './diagram/export/toSvgString'
import { svgToPngBlob } from './diagram/export/toPng'
import { font, type as typography } from './diagram/theme'

const DEFAULT_SOURCE = DEFAULT_EXAMPLE.source

type ParseState =
  | { status: 'idle' }
  | { status: 'ok'; ir: DiagramIR }
  | { status: 'error'; error: ParseError }

/** «4 узла», «5 узлов», «1 узел» */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function App() {
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [exampleId, setExampleId] = useState(DEFAULT_EXAMPLE.id)
  const debounced = useDebounced(source)

  const [parse, setParse] = useState<ParseState>({ status: 'idle' })
  const [layout, setLayout] = useState<Layout | null>(null)
  const [busy, setBusy] = useState<null | 'png' | 'svg'>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [scale, setScale] = useState(2)
  const [transparent, setTransparent] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const fontSpec = useMemo(
    () => ({ family: font.family, weight: font.weight.regular, size: typography.node.size }),
    [],
  )

  // [1-2] mermaid -> IR
  useEffect(() => {
    let cancelled = false
    parseMermaid(debounced).then((res) => {
      if (cancelled) return
      setParse(res.ok ? { status: 'ok', ir: res.ir } : { status: 'error', error: res.error })
    })
    return () => {
      cancelled = true
    }
  }, [debounced])

  const flowchartIr = parse.status === 'ok' && parse.ir.type === 'flowchart' ? parse.ir : null
  const timelineIr = parse.status === 'ok' && parse.ir.type === 'timeline' ? parse.ir : null

  // [3] габариты узлов (fit-text) — синхронно из IR
  const boxes: Record<string, NodeBox> | null = useMemo(
    () => (flowchartIr ? measureNodes(flowchartIr, fontSpec, measurer) : null),
    [flowchartIr, fontSpec],
  )

  // [4] раскладка — асинхронно (ELK)
  useEffect(() => {
    if (!flowchartIr || !boxes) {
      setLayout(null)
      return
    }
    let cancelled = false
    layoutDiagram(flowchartIr, boxes).then((result) => {
      if (!cancelled) setLayout(result)
    })
    return () => {
      cancelled = true
    }
  }, [flowchartIr, boxes])

  // таймлайн раскладывается синхронно (свой алгоритм, без ELK)
  const timelineLayout = useMemo(
    () => (timelineIr ? layoutTimeline(timelineIr, fontSpec, measurer) : null),
    [timelineIr, fontSpec],
  )

  const ready = !!svgRef.current && parse.status === 'ok' && (!!layout || !!timelineLayout)

  const stats = useMemo(() => {
    if (flowchartIr && boxes) {
      const shrunk = flowchartIr.nodes.filter((n) => (boxes[n.id]?.fit.fontSize ?? 0) < typography.node.size).length
      return {
        text: `${plural(flowchartIr.nodes.length, 'узел', 'узла', 'узлов')} · ${plural(
          flowchartIr.edges.length,
          'связь',
          'связи',
          'связей',
        )}${shrunk ? ` · ${shrunk} с уменьшенным шрифтом` : ''}`,
      }
    }
    if (timelineIr) {
      const events = timelineIr.points.reduce((sum, p) => sum + p.events.length, 0)
      return {
        text: `${plural(timelineIr.points.length, 'точка', 'точки', 'точек')} · ${plural(
          events,
          'событие',
          'события',
          'событий',
        )}`,
      }
    }
    return null
  }, [flowchartIr, timelineIr, boxes])

  const handleSvg = async () => {
    if (!svgRef.current) return
    setBusy('svg')
    setExportError(null)
    try {
      downloadSvg(await toSvgString(svgRef.current, { transparent }), 'schema.svg')
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const handlePng = async () => {
    if (!svgRef.current) return
    setBusy('png')
    setExportError(null)
    try {
      const svgString = await toSvgString(svgRef.current, { transparent })
      const blob = await svgToPngBlob(svgString, { scale, transparent })
      downloadBlob(blob, 'schema.png')
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const diagram =
    flowchartIr && boxes && layout ? (
      <DiagramSvg ir={flowchartIr} boxes={boxes} layout={layout} svgRef={svgRef} />
    ) : timelineIr && timelineLayout ? (
      <TimelineSvg ir={timelineIr} layout={timelineLayout} svgRef={svgRef} />
    ) : null

  const zoomSize = layout
    ? { width: layout.width, height: layout.height }
    : timelineLayout
      ? { width: timelineLayout.width, height: timelineLayout.height }
      : null

  return (
    <div className="app">
      <section className="pane pane--editor">
        <div className="pane__head">
          <h1 className="pane__title">Mermaid</h1>
          <button
            type="button"
            className="syntax-toggle"
            onClick={() => setHelpOpen((v) => !v)}
            title="Подсказки по синтаксису"
          >
            {helpOpen ? 'Скрыть синтаксис' : 'Синтаксис ?'}
          </button>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <select
            value={exampleId}
            onChange={(e) => {
              const next = EXAMPLES.find((x) => x.id === e.target.value)
              if (!next) return
              setExampleId(next.id)
              setSource(next.source)
            }}
            style={{
              height: 36,
              borderRadius: 12,
              border: '1px solid #D0D7DD',
              padding: '0 10px',
              fontFamily: 'inherit',
              fontSize: 13,
              background: '#fff',
            }}
          >
            <option value="">— свой вариант —</option>
            {EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: '#808080' }}>{EXAMPLES.find((x) => x.id === exampleId)?.checks}</span>
        </div>
        <textarea
          className="editor"
          value={source}
          onChange={(e) => {
            setSource(e.target.value)
            setExampleId('')
          }}
          spellCheck={false}
        />
        <span style={{ fontSize: 12, color: '#808080' }}>
          Поддерживаются flowchart/graph и timeline. Не помнишь синтаксис — кнопка «Синтаксис ?».
        </span>

        {helpOpen && (
          <SyntaxHelp
            onClose={() => setHelpOpen(false)}
            onInsert={(code) => {
              setSource(code)
              setExampleId('')
              setHelpOpen(false)
            }}
          />
        )}
      </section>

      <section className="pane pane--preview">
        <div className="pane__head">
          <h1 className="pane__title">Предпросмотр</h1>
          {stats && <span style={{ color: '#808080', fontSize: 13 }}>{stats.text}</span>}
        </div>

        <div className="preview-box">
          {parse.status === 'error' && (
            <div style={{ color: '#B93A33', fontSize: 14 }}>
              <strong>Не удалось разобрать разметку</strong>
              <div style={{ marginTop: 6 }}>
                {parse.error.line ? `Строка ${parse.error.line}: ` : ''}
                {parse.error.message}
              </div>
            </div>
          )}

          {parse.status === 'idle' && <div style={{ color: '#808080' }}>Разбираю…</div>}

          {parse.status === 'ok' && (
            <div
              style={{
                display: 'grid',
                gap: 12,
                flex: 1,
                minHeight: 0,
                gridTemplateRows: parse.ir.warnings.length ? 'auto 1fr' : '1fr',
              }}
            >
              {parse.ir.warnings.map((w) => (
                <div
                  key={w}
                  style={{
                    background: '#FFF7E6',
                    border: '1px solid #F3D9A4',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 13,
                  }}
                >
                  {w}
                </div>
              ))}
              {diagram && zoomSize ? (
                <ZoomPane
                  width={zoomSize.width}
                  height={zoomSize.height}
                  contentKey={`${parse.ir.type}-${zoomSize.width}x${zoomSize.height}`}
                >
                  {diagram}
                </ZoomPane>
              ) : (
                <div style={{ color: '#808080' }}>Считаю раскладку…</div>
              )}
            </div>
          )}
        </div>

        <div className="toolbar">
          <button
            type="button"
            style={btnStyle(!ready || busy !== null)}
            disabled={!ready || busy !== null}
            onClick={handlePng}
          >
            {busy === 'png' ? 'Готовлю PNG…' : 'Скачать PNG'}
          </button>
          <button
            type="button"
            style={btnStyle(!ready || busy !== null)}
            disabled={!ready || busy !== null}
            onClick={handleSvg}
          >
            {busy === 'svg' ? 'Готовлю SVG…' : 'Скачать SVG'}
          </button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#808080' }}>
            масштаб
            <select
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              style={{ height: 32, borderRadius: 10, border: '1px solid #D0D7DD', fontFamily: 'inherit', fontSize: 13 }}
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={3}>3×</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#808080' }}>
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
            прозрачный фон
          </label>
          {exportError && <span style={{ color: '#B93A33', fontSize: 12 }}>{exportError}</span>}
          <span style={{ color: '#808080', fontSize: 12, flexBasis: '100%' }}>
            колесо — зум, перетаскивание — панорама, двойной клик — вписать
          </span>
        </div>
      </section>
    </div>
  )
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 40,
    padding: '0 16px',
    borderRadius: 12,
    border: 'none',
    background: '#4BD0A0',
    color: '#27292D',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'opacity 120ms',
  }
}
