import { useEffect, useMemo, useRef, useState } from 'react'
import { EXAMPLES, DEFAULT_EXAMPLE } from './examples'
import { parseMermaid, type ParseError } from './diagram/parse/parseMermaid'
import type { DiagramIR } from './diagram/ir'
import { measurer } from './diagram/measure/textMetrics'
import { measureNodes, type NodeBox } from './diagram/measure/measureNode'
import { layoutDiagram, type Layout } from './diagram/layout/layoutElk'
import { DiagramSvg } from './diagram/render/DiagramSvg'
import { StateSvg } from './diagram/render/StateSvg'
import { measureStateNodes } from './diagram/measure/measureState'
import { stateToFlowchart } from './diagram/layout/stateAdapter'
import { SequenceSvg } from './diagram/render/SequenceSvg'
import { layoutSequence } from './diagram/layout/layoutSequence'
import { ClassSvg } from './diagram/render/ClassSvg'
import { measureClassNodes, type ClassDetails } from './diagram/measure/measureClass'
import { classToFlowchart } from './diagram/layout/classAdapter'
import { ErSvg } from './diagram/render/ErSvg'
import { measureErNodes, type EntityDetails } from './diagram/measure/measureEr'
import { erToFlowchart } from './diagram/layout/erAdapter'
import { MindmapSvg } from './diagram/render/MindmapSvg'
import { layoutMindmap } from './diagram/layout/layoutMindmap'
import { JourneySvg } from './diagram/render/JourneySvg'
import { layoutJourney } from './diagram/layout/layoutJourney'
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
  const stateIr = parse.status === 'ok' && parse.ir.type === 'state' ? parse.ir : null
  const sequenceIr = parse.status === 'ok' && parse.ir.type === 'sequence' ? parse.ir : null
  const classIr = parse.status === 'ok' && parse.ir.type === 'class' ? parse.ir : null
  const erIr = parse.status === 'ok' && parse.ir.type === 'er' ? parse.ir : null
  const mindmapIr = parse.status === 'ok' && parse.ir.type === 'mindmap' ? parse.ir : null
  const journeyIr = parse.status === 'ok' && parse.ir.type === 'journey' ? parse.ir : null

  // [3] габариты узлов (fit-text) — синхронно из IR
  const boxes: Record<string, NodeBox> | null = useMemo(
    () => (flowchartIr ? measureNodes(flowchartIr, fontSpec, measurer) : null),
    [flowchartIr, fontSpec],
  )
  const sequenceLayout = useMemo(
    () => (sequenceIr ? layoutSequence(sequenceIr, measurer, fontSpec) : null),
    [sequenceIr, fontSpec],
  )

  const classMeasure = useMemo(
    () => (classIr ? measureClassNodes(classIr, fontSpec, measurer) : null),
    [classIr, fontSpec],
  )

  const [classLayout, setClassLayout] = useState<Layout | null>(null)
  useEffect(() => {
    if (!classIr || !classMeasure) {
      setClassLayout(null)
      return
    }
    let cancelled = false
    layoutDiagram(classToFlowchart(classIr), classMeasure.boxes).then((result) => {
      if (!cancelled) setClassLayout(result)
    })
    return () => {
      cancelled = true
    }
  }, [classIr, classMeasure])

  const erMeasure = useMemo(
    () => (erIr ? measureErNodes(erIr, fontSpec, measurer) : null),
    [erIr, fontSpec],
  )

  const [erLayout, setErLayout] = useState<Layout | null>(null)
  useEffect(() => {
    if (!erIr || !erMeasure) {
      setErLayout(null)
      return
    }
    let cancelled = false
    layoutDiagram(erToFlowchart(erIr), erMeasure.boxes).then((result) => {
      if (!cancelled) setErLayout(result)
    })
    return () => {
      cancelled = true
    }
  }, [erIr, erMeasure])

  const mindmapLayout = useMemo(
    () => (mindmapIr ? layoutMindmap(mindmapIr, measurer, fontSpec) : null),
    [mindmapIr, fontSpec],
  )

  const journeyLayout = useMemo(
    () => (journeyIr ? layoutJourney(journeyIr, measurer, fontSpec) : null),
    [journeyIr, fontSpec],
  )

  const stateBoxes: Record<string, NodeBox> | null = useMemo(
    () => (stateIr ? measureStateNodes(stateIr, fontSpec, measurer) : null),
    [stateIr, fontSpec],
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

  // [4] раскладка state — тоже через ELK (через адаптер state->flowchart)
  const [stateLayout, setStateLayout] = useState<Layout | null>(null)
  useEffect(() => {
    if (!stateIr || !stateBoxes) {
      setStateLayout(null)
      return
    }
    let cancelled = false
    layoutDiagram(stateToFlowchart(stateIr), stateBoxes).then((result) => {
      if (!cancelled) setStateLayout(result)
    })
    return () => {
      cancelled = true
    }
  }, [stateIr, stateBoxes])


  const stats = useMemo(() => {
    if (journeyIr) {
      const tasks = journeyIr.sections.reduce((s, sec) => s + sec.tasks.length, 0)
      return { text: `${plural(journeyIr.sections.length, 'секция', 'секции', 'секций')} · ${plural(tasks, 'задача', 'задачи', 'задач')}` }
    }
    if (mindmapIr) {
      const count = (n: any): number => 1 + n.children.reduce((s: number, c: any) => s + count(c), 0)
      return { text: `${count(mindmapIr.root)} узлов` }
    }
    if (erIr) {
      const rels = erIr.relationships.length
      return {
        text: `${plural(erIr.entities.length, 'сущность', 'сущности', 'сущностей')} · ${plural(rels, 'связь', 'связи', 'связей')}`,
      }
    }
    if (classIr) {
      const rels = classIr.relations.length
      return {
        text: `${plural(classIr.nodes.length, 'класс', 'класса', 'классов')} · ${plural(rels, 'связь', 'связи', 'связей')}`,
      }
    }
    if (sequenceIr) {
      const messages = sequenceIr.items.filter((i) => i.kind === 'message').length
      return {
        text: `${plural(sequenceIr.actors.length, 'актёр', 'актёра', 'актёров')} · ${plural(
          messages,
          'сообщение',
          'сообщения',
          'сообщений',
        )}`,
      }
    }
    if (stateIr) {
      return {
        text: `${plural(stateIr.nodes.length, 'состояние', 'состояния', 'состояний')} · ${plural(
          stateIr.transitions.length,
          'переход',
          'перехода',
          'переходов',
        )}`,
      }
    }
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
    return null
  }, [flowchartIr, boxes])

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

  const diagram = flowchartIr && boxes && layout ? (
    <DiagramSvg ir={flowchartIr} boxes={boxes} layout={layout} svgRef={svgRef} />
  ) : stateIr && stateBoxes && stateLayout ? (
    <StateSvg ir={stateIr} boxes={stateBoxes} layout={stateLayout} svgRef={svgRef} />
  ) : sequenceIr && sequenceLayout ? (
    <SequenceSvg ir={sequenceIr} layout={sequenceLayout} svgRef={svgRef} />
  ) : classIr && classMeasure && classLayout ? (
    <ClassSvg ir={classIr} boxes={classMeasure.boxes} details={classMeasure.details} layout={classLayout} svgRef={svgRef} />
  ) : erIr && erMeasure && erLayout ? (
    <ErSvg ir={erIr} boxes={erMeasure.boxes} details={erMeasure.details} layout={erLayout} svgRef={svgRef} />
  ) : mindmapIr && mindmapLayout ? (
    <MindmapSvg ir={mindmapIr} layout={mindmapLayout} svgRef={svgRef} />
  ) : journeyIr && journeyLayout ? (
    <JourneySvg ir={journeyIr} layout={journeyLayout} svgRef={svgRef} />
  ) : null

  const zoomSize = layout
    ? { width: layout.width, height: layout.height }
    : stateLayout
      ? { width: stateLayout.width, height: stateLayout.height }
      : sequenceLayout
        ? { width: sequenceLayout.width, height: sequenceLayout.height }
        : classLayout
          ? { width: classLayout.width, height: classLayout.height }
          : erLayout
            ? { width: erLayout.width, height: erLayout.height }
            : mindmapLayout
              ? { width: mindmapLayout.width, height: mindmapLayout.height }
              : journeyLayout
                ? { width: journeyLayout.width, height: journeyLayout.height }
                : null

  // НЕ использовать svgRef в рендере: реф не триггерит перерисовку, и после первого
  // рендера кнопки оставались задизейбленными до следующего взаимодействия.
  const ready = parse.status === 'ok' && !!diagram

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
              width: '100%',
              maxWidth: '100%',
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
          Поддерживаются flowchart (TD/TB, LR, BT, RL) и state-диаграммы. Не помнишь синтаксис — кнопка «Синтаксис ?».
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
