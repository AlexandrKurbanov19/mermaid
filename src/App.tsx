import { useEffect, useMemo, useState } from 'react'
import { parseMermaid, type ParseError } from './diagram/parse/parseMermaid'
import { textBlockToString } from './diagram/parse/label'
import type { DiagramIR } from './diagram/ir'
import { measurer } from './diagram/measure/textMetrics'
import { measureNodes } from './diagram/measure/measureNode'
import { font, type as typography } from './diagram/theme'

const DEFAULT_SOURCE = `graph TD
    A[Пользователь] --> B{Авторизован?}
    B -- да --> C[Открыть дашборд]
    B -- нет --> D[Показать логин]
    D --> B`

type State =
  | { status: 'idle' }
  | { status: 'parsing' }
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

/** Дебаунс, чтобы не парсить на каждый символ. */
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
  const debounced = useDebounced(source)
  const [state, setState] = useState<State>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false
    setState((prev) => (prev.status === 'ok' ? prev : { status: 'parsing' }))

    parseMermaid(debounced).then((res) => {
      if (cancelled) return
      setState(res.ok ? { status: 'ok', ir: res.ir } : { status: 'error', error: res.error })
    })

    return () => {
      cancelled = true
    }
  }, [debounced])

  const summary = useMemo(() => {
    if (state.status !== 'ok') return null
    const { ir } = state
    return {
      direction: ir.direction,
      nodes: ir.nodes.length,
      edges: ir.edges.length,
      groups: ir.groups.length,
    }
  }, [state])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24, height: '100vh' }}>
      {/* левая колонка — разметка */}
      <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 8, minHeight: 0 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Mermaid</h1>
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

      {/* правая колонка — превью (SVG будет на следующем этапе) */}
      <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 12, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Предпросмотр</h1>
          {summary && (
            <span style={{ color: '#808080', fontSize: 13 }}>
              {summary.direction} · {plural(summary.nodes, 'узел', 'узла', 'узлов')} ·{' '}
              {plural(summary.edges, 'связь', 'связи', 'связей')}
              {summary.groups ? ` · ${plural(summary.groups, 'группа', 'группы', 'групп')}` : ''}
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
          {state.status === 'error' && (
            <div style={{ color: '#B93A33', fontSize: 14 }}>
              <strong>Не удалось разобрать разметку</strong>
              <div style={{ marginTop: 6 }}>
                {state.error.line ? `Строка ${state.error.line}: ` : ''}
                {state.error.message}
              </div>
            </div>
          )}

          {state.status !== 'error' && state.status !== 'ok' && <div style={{ color: '#808080' }}>Разбираю…</div>}

          {state.status === 'ok' && <IRPreview ir={state.ir} />}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled style={btnStyle}>
            Скачать PNG
          </button>
          <button disabled style={btnStyle}>
            Скачать SVG
          </button>
          <span style={{ alignSelf: 'center', color: '#808080', fontSize: 12 }}>
            кнопки включатся после этапа рендера
          </span>
        </div>
      </section>
    </div>
  )
}

/** Пока рендера нет — показываем разобранную модель + посчитанные габариты узлов. */
function IRPreview({ ir }: { ir: DiagramIR }) {
  const boxes = useMemo(
    () =>
      measureNodes(ir, { family: font.family, weight: font.weight.regular, size: typography.node.size }, measurer),
    [ir],
  )
  const shrunk = ir.nodes.filter((n) => (boxes[n.id]?.fit.fontSize ?? 0) < typography.node.size).length
  const truncated = ir.nodes.filter((n) => boxes[n.id]?.fit.truncated).length

  return (
    <div style={{ display: 'grid', gap: 16, fontSize: 13 }}>
      {ir.warnings.map((w) => (
        <div key={w} style={{ background: '#FFF7E6', border: '1px solid #F3D9A4', borderRadius: 8, padding: '8px 10px' }}>
          {w}
        </div>
      ))}

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          Узлы{' '}
          <span style={{ fontWeight: 400, color: '#808080' }}>
            {shrunk ? `· ${shrunk} с уменьшенным шрифтом` : '· шрифт везде базовый'}
            {truncated ? ` · ${truncated} обрезано` : ''}
          </span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {ir.nodes.map((n) => {
            const box = boxes[n.id]
            return (
              <li key={n.id}>
                <code>{n.id}</code> — {n.role}: «{textBlockToString(n.label)}»
                {box && (
                  <span style={{ color: '#808080' }}>
                    {' '}
                    [{Math.round(box.width)}×{Math.round(box.height)}, {box.fit.fontSize} px
                    {box.fit.lines.length ? `, ${box.fit.lines.length} стр.` : ''}]
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Связи</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {ir.edges.map((e) => (
            <li key={e.id}>
              <code>
                {e.from} → {e.to}
              </code>{' '}
              ({e.kind}, {e.arrow})
              {e.label ? ` — «${textBlockToString(e.label)}»` : ''}
            </li>
          ))}
        </ul>
      </div>
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
