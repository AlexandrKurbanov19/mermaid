import mermaid from 'mermaid'
import type { DiagramIR } from '../ir'
import { normalize } from './normalize'

/**
 * Шаг [1] пайплайна: Mermaid-разметка -> IR.
 *
 * Парсим не своим парсером, а самим mermaid (getDiagramFromText) — он источник истины
 * по синтаксису. Внутренний `db` дальше не выпускаем: он превращается в наш IR.
 *
 * `[РИСК]` `mermaidAPI.getDiagramFromText` и `db` — внутренний API mermaid, не публичный
 * контракт. Версия закреплена (12.2.0), поведение покрыто снапшот-тестами IR.
 */

export type ParseError = {
  kind: 'syntax' | 'unsupported-type' | 'internal'
  message: string
  /** номер строки во входной разметке, если mermaid его дал */
  line?: number
}

export type ParseResult =
  | { ok: true; ir: DiagramIR }
  | { ok: false; error: ParseError }

let initialized = false

function ensureInit() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    // не даём mermaid ходить наружу и вставлять произвольный HTML
    securityLevel: 'strict',
  })
  initialized = true
}

/** В v1 поддерживается только flowchart (блок-схемы) с любым направлением. */
const FLOWCHART_TYPES = new Set(['flowchart', 'flowchart-v2', 'graph', 'flow'])

function extractLine(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const e = err as Record<string, any>
  const candidates = [
    e.hash?.loc?.first_line,
    e.hash?.line,
    e.result?.hash?.loc?.first_line,
    e.location?.start?.line,
  ]
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c
  }
  return undefined
}

function readableMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  // mermaid добавляет длинные хвосты со стеком парсера — оставляем первую осмысленную строку
  const firstLine = msg.split('\n').map((l) => l.trim()).filter(Boolean)[0] ?? msg
  return firstLine.replace(/^Error:\s*/i, '')
}

export async function parseMermaid(text: string): Promise<ParseResult> {
  const source = text.trim()
  if (!source) {
    return { ok: false, error: { kind: 'syntax', message: 'Пустая разметка' } }
  }

  ensureInit()

  let diagram: any
  try {
    diagram = await mermaid.mermaidAPI.getDiagramFromText(source)
  } catch (err) {
    return {
      ok: false,
      error: { kind: 'syntax', message: readableMessage(err), line: extractLine(err) },
    }
  }

  try {
    const type: string = diagram?.type ?? ''
    const db = diagram?.db

    if (type && !FLOWCHART_TYPES.has(type)) {
      return {
        ok: false,
        error: {
          kind: 'unsupported-type',
          message: `Тип диаграммы «${type}» не поддерживается в первой версии: только flowchart (блок-схемы). sequence, class, state, ER, gantt, timeline, mindmap и др. — вне v1.`,
        },
      }
    }

    if (!db || typeof db.getVertices !== 'function' || typeof db.getDirection !== 'function') {
      return {
        ok: false,
        error: {
          kind: 'unsupported-type',
          message: 'Это не блок-схема: не удалось получить узлы и связи.',
        },
      }
    }

    return { ok: true, ir: normalize(db, source) }
  } catch (err) {
    return {
      ok: false,
      error: { kind: 'internal', message: readableMessage(err), line: extractLine(err) },
    }
  }
}
