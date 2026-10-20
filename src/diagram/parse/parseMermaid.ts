import mermaid from 'mermaid'
import type { DiagramIR } from '../ir'
import { normalize } from './normalize'
import { normalizeState } from './normalizeState'
import { normalizeSequence } from './normalizeSequence'
import { normalizeClass } from './normalizeClass'
import { normalizeEr } from './normalizeEr'
import { normalizeMindmap } from './normalizeMindmap'
import { normalizeJourney } from './normalizeJourney'
import { normalizeGantt } from './normalizeGantt'

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

/** Поддерживаемые типы. v1 = flowchart; v2 добавляет state. */
const FLOWCHART_TYPES = new Set(['flowchart', 'flowchart-v2', 'graph', 'flow'])
const STATE_TYPES = new Set(['stateDiagram', 'stateDiagram-v2', 'state'])
const SEQUENCE_TYPES = new Set(['sequence'])
const CLASS_TYPES = new Set(['classDiagram', 'class'])
const ER_TYPES = new Set(['er', 'erDiagram'])
const MINDMAP_TYPES = new Set(['mindmap'])
const JOURNEY_TYPES = new Set(['journey'])
const GANTT_TYPES = new Set(['gantt'])

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

    if (GANTT_TYPES.has(type)) {
      if (!db || typeof db.getTasks !== 'function') {
        return { ok: false, error: { kind: 'unsupported-type', message: 'Не удалось разобрать gantt.' } }
      }
      return { ok: true, ir: normalizeGantt(db, source) }
    }

    if (JOURNEY_TYPES.has(type)) {
      if (!db || typeof db.getTasks !== 'function') {
        return { ok: false, error: { kind: 'unsupported-type', message: 'Не удалось разобрать journey.' } }
      }
      return { ok: true, ir: normalizeJourney(db, source) }
    }

    if (MINDMAP_TYPES.has(type)) {
      if (!db || typeof db.getMindmap !== 'function') {
        return { ok: false, error: { kind: 'unsupported-type', message: 'Не удалось разобрать mindmap.' } }
      }
      return { ok: true, ir: normalizeMindmap(db, source) }
    }

    if (ER_TYPES.has(type)) {
      if (!db || typeof db.getEntities !== 'function') {
        return { ok: false, error: { kind: 'unsupported-type', message: 'Не удалось разобрать ER-диаграмму.' } }
      }
      return { ok: true, ir: normalizeEr(db, source) }
    }

    if (CLASS_TYPES.has(type)) {
      if (!db || typeof db.getClasses !== 'function') {
        return { ok: false, error: { kind: 'unsupported-type', message: 'Не удалось разобрать class-диаграмму.' } }
      }
      return { ok: true, ir: normalizeClass(db, source) }
    }

    if (SEQUENCE_TYPES.has(type)) {
      if (!db || typeof db.getMessages !== 'function') {
        return { ok: false, error: { kind: 'unsupported-type', message: 'Не удалось разобрать sequence-диаграмму.' } }
      }
      return { ok: true, ir: normalizeSequence(db, source) }
    }

    if (STATE_TYPES.has(type)) {
      if (!db || typeof db.getRelations !== 'function') {
        return { ok: false, error: { kind: 'unsupported-type', message: 'Не удалось разобрать state-диаграмму.' } }
      }
      return { ok: true, ir: normalizeState(db, source) }
    }

    if (type && !FLOWCHART_TYPES.has(type)) {
      return {
        ok: false,
        error: {
          kind: 'unsupported-type',
          message: `Тип диаграммы «${type}» пока не поддерживается. Доступны flowchart, state, sequence, class, ER, mindmap, journey и gantt.`,
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
