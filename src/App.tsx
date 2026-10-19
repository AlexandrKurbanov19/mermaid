import { useEffect, useMemo, useRef, useState } from 'react'
import { parseMermaid, type ParseError } from './diagram/parse/parseMermaid'
import type { DiagramIR } from './diagram/ir'
import { measurer } from './diagram/measure/textMetrics'
import { measureNodes, type NodeBox } from './diagram/measure/measureNode'
import { layoutDiagram, type Layout } from './diagram/layout/layoutElk'
import { DiagramSvg } from './diagram/render/DiagramSvg'
import { toSvgString, downloadSvg, downloadBlob } from './diagram/export/toSvgString'
import { svgToPngBlob } from './diagram/export/toPng'
import { font, type as typography } from './diagram/theme'

import { EXAMPLES, DEFAULT_EXAMPLE } from './examples'

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
  const svgRef = useRef<SVGSVGElement>(null)

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

  // [3] габариты узлов (fit-text) — синхронно из IR
  const boxes: Record<string, NodeBox> | null = useMemo(() => {
    if (parse.status !== 'ok') return null
    return measureNodes(parse.ir, { family: font.family, weight: font.weight.regular, size: typography.node.size }, measurer)
  }, [parse])

  // [4] раскладка — асинхронно (ELK)
  useEffect(() => {
    if (parse.status !== 'ok' || !boxes) {
      setLayout(null)
      return
    }
    let cancelled = false
    layoutDiagram(parse.ir, boxes).then((result) => {
      if (!cancelled) setLayout(result)
    })
    return () => {
      cancelled = true
    }
  }, [parse, boxes])

  const stats = useMemo(() => {
    if (parse.status !== 'ok' || !boxes) return null
    const shrunk = parse.ir.nodes.filter((n) => (boxes[n.id]?.fit.fontSize ?? 0) < typography.node.size).length
    return { nodes: parse.ir.nodes.length, edges: parse.ir.edges.length, shrunk }
  }, [parse, boxes])

  const ready = parse.status === 'ok' && !!boxes && !!layout

  const handleSvg = async () => {
    if (!svgRef.current) return
    setBusy('svg')
    setExportError(null)
    try {
      downloadSvg(await toSvgString(svgRef.current), 'schema.svg')
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
      const svgString = await toSvgString(svgRef.current)
      const blob = await svgToPngBlob(svgString, { scale: 2 })
      downloadBlob(blob, 'schema.png')
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 1.2fr', gap: 24, padding: 24, height: '100vh' }}>
      <section style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 8, minHeight: 0 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Mermaid</h1>
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
            {EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: '#808080' }}>
            {EXAMPLES.find((x) => x.id === exampleId)?.checks}
          </span>
        </div>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            height: '100%',
            resize: 'none',
            padding: 12,
            border: '1px solid #D0D7DD',
            borderRadius: 12,
            fontFamily: "'Roboto Mono', ui-monospace, monospace",
            fontSize: 13,
            lineHeight: 1.6,
            outline: 'none',
          }}
        />
      </section>

      <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 12, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Предпросмотр</h1>
          {stats && (
            <span style={{ color: '#808080', fontSize: 13 }}>
              {plural(stats.nodes, 'узел', 'узла', 'узлов')} · {plural(stats.edges, 'связь', 'связи', 'связей')}
              {stats.shrunk ? ` · ${stats.shrunk} с уменьшенным шрифтом` : ''}
            </span>
          )}
        </div>

        <div
          style={{
            border: '1px solid #E3E5E9',
            borderRadius: 12,
            padding: 16,
            overflow: 'auto',
            minHeight: 0,
            background: '#fff',
          }}
        >
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
            <div style={{ display: 'grid', gap: 12 }}>
              {parse.ir.warnings.map((w) => (
                <div
                  key={w}
                  style={{ background: '#FFF7E6', border: '1px solid #F3D9A4', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                >
                  {w}
                </div>
              ))}
              {boxes && layout ? (
                <DiagramSvg ir={parse.ir} boxes={boxes} layout={layout} svgRef={svgRef} />
              ) : (
                <div style={{ color: '#808080' }}>Считаю раскладку…</div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={btnStyle} disabled={!ready || busy !== null} onClick={handlePng}>
            {busy === 'png' ? 'Готовлю PNG…' : 'Скачать PNG'}
          </button>
          <button type="button" style={btnStyle} disabled={!ready || busy !== null} onClick={handleSvg}>
            {busy === 'svg' ? 'Готовлю SVG…' : 'Скачать SVG'}
          </button>
          <span style={{ color: '#808080', fontSize: 12 }}>PNG 2×, белый фон</span>
          {exportError && <span style={{ color: '#B93A33', fontSize: 12 }}>{exportError}</span>}
        </div>
      </section>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  height: 40,
  padding: '0 16px',
  borderRadius: 12,
  border: 'none',
  background: '#4BD0A0',
  color: '#27292D',
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
  opacity: 0.5,
}
