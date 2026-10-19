/**
 * Тема схемы — ЕДИНСТВЕННОЕ место, где живут цвета, шрифты, размеры и отступы.
 * Значения и их происхождение см. docs/THEME.md.
 *
 * Источники:
 *  - vars.sass (проект Нетологии): бренд-зелёный, серые, радиус;
 *  - архив референсов: геометрия и стиль;
 *  - DS @salutejs/sdds-netology: гарнитура SB Sans Text.
 */

export const color = {
  canvas: '#FFFFFF',

  textPrimary: '#27292D',
  textSecondary: '#808080',
  textOnAccent: '#27292D',

  brandNeo: '#4BD0A0',
  brandNeoHover: '#65EBC3',
  brandNeoActive: '#37BC8B',
  brandNeoInk: '#2B8A64',
  brandBlue: '#0066FF',

  nodeFill: '#F3F4F7',
  nodeStroke: '#D0D7DD',
  nodeAccentFill: '#4BD0A0',
  nodeMutedFill: '#FAFBFC',
  nodeMutedStroke: '#D0D7DD',

  tintAccent: '#E8FBF3',
  borderSubtle: '#E3E5E9',

  /**
   * Стрелки в референсах Нетологии ЗЕЛЁНЫЕ (замерено: #47C397 в image (25), #31C2A7 в image (3)),
   * а не серые. Поэтому основной цвет связи — брендовый зелёный.
   */
  edgeAccent: '#4BD0A0',
  edgeNeutral: '#9FA3A7', // оставлен для вторичных/приглушённых связей
  edgeLabelBg: '#FFFFFF',
  groupStroke: '#9FA3A7',
  groupLabel: '#808080',
} as const

export const font = {
  // решение заказчика: SB Sans Text везде
  family: "'SB Sans Text', Arial, sans-serif",
  mono: "'Roboto Mono', ui-monospace, monospace",
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const

export const type = {
  node: { size: 18, lineHeight: 1.3, minSize: 11 },
  edgeLabel: { size: 16, lineHeight: 1.3, minSize: 10 },
  groupLabel: { size: 16, lineHeight: 1.3, minSize: 10 },
} as const

export const size = {
  radius: 12,
  strokeWidth: 1,
  edgeWidth: 2,
  edgeWidthThick: 2.5,
  dash: '6 4',
  arrow: 8,

  paddingX: 16,
  paddingY: 12,

  nodeMinWidth: 120,
  nodeMaxWidth: 260,
  nodeMinHeight: 56,
  nodeMaxHeight: 132,

  layerSpacing: 64,
  nodeSpacing: 40,
  canvasPadding: 32,
  groupPadding: 24,
} as const

/**
 * Текстовая область внутри фигуры, как доля от её габаритов.
 * Для ромба и круга это критично: иначе текст вылезает за скосы/дугу.
 */
export const textArea = {
  box: { width: 1, height: 1 }, // минус паддинги
  round: { width: 1, height: 1 },
  pill: { width: 1, height: 1 },
  hexagon: { width: 0.75, height: 1 },
  decision: { width: 0.6, height: 0.5 },
  circle: { width: 0.7, height: 0.7 },
  accent: { width: 1, height: 1 },
} as const

export const theme = { color, font, type, size, textArea } as const
