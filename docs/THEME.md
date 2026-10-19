# Тема: точные значения для `theme.ts`

Единственный файл, где живут цвета, шрифты, радиусы и отступы. Рендерер берёт значения **только** отсюда.

**Источники (по приоритету):**

1. **`apps/landings/src/stylesheets/vars.sass`** и `libs/shared/src/stylesheets/vars.sass` — брендовые токены Нетологии, живые значения из прод-кода. Главный источник для цвета.
2. **Архив референсов** (`~/Desktop/схемы/`, 25 слайдов) — формы, геометрия, стиль стрелок. Пиксельные замеры.
3. **DS `@salutejs/sdds-netology`** — семантические имена + поведение компонентов. Тема под ним — `plasma_b2c__light` (акцент **синий**, поэтому переопределяем).

---

## 0. Что проверено в рантайме (а не выведено из общих соображений)

Поднял минимальный проект (`src/`, Vite, порт 5199), поставил `@salutejs/sdds-netology@0.343.0` + `@salutejs/plasma-themes@0.45.0`, прочитал вычисленные CSS-переменные в браузере:

| Переменная | Значение в `plasma_b2c__light` |
|---|---|
| `--on-light-surface-accent` | `#2A72F8` (синий — **не бренд Нетологии**) |
| `--on-light-surface-accent-minor` | `#DEE9FF` |
| `--on-light-text-primary` | `#080808F5` |
| `--on-light-text-secondary` | `#0808088F` |
| `--on-light-surface-solid-primary` | `#F5F5F5` |
| `--on-light-surface-solid-secondary` | `#ECECEC` |
| `--on-light-surface-solid-tertiary` | `#DDDDDD` |
| `--on-light-surface-solid-card` | `#FFFFFFFF` |
| `--on-light-outline-accent` | `#2A72F8` |

Кнопка DS по умолчанию: фон `rgb(42,114,248)`, высота **48 px**, радиус **12 px**, шрифт **`SB Sans Text`**.

**Вывод:** DS — это инструмент, но не источник бренд-цвета. Зелёный берём из `vars.sass`.

### Как переопределить акцент на бренд-зелёный (проверено, работает)

DS подставляет алиасы (`--surface-accent` и т.п.) уже **резолвнутыми литералами** через runtime-стили, поэтому обычного `:root` **недостаточно** — нужен `!important`:

```css
/* src/theme/netology.css, импортируется после темы DS */
:root {
  --on-light-surface-accent: #4bd0a0;
  --on-light-surface-accent-hover: #65ebc3;
  --on-light-surface-accent-active: #37bc8b;
  --on-light-surface-accent-minor: #e8fbf3;

  --surface-accent: #4bd0a0 !important;
  --surface-accent-hover: #65ebc3 !important;
  --surface-accent-active: #37bc8b !important;
}
```

Результат в рантайме: `--surface-accent: #4bd0a0`, фон кнопки `rgb(75,208,160)`. Файл уже лежит в репозитории.

---

## 1. Палитра

```ts
export const color = {
  // Холст
  canvas:            '#FFFFFF',

  // Текст: $c-darkblack #2B2B2B / архив #27292D → стандартизовано
  textPrimary:       '#27292D',
  textSecondary:     '#808080',   // $c-grey / архив #898989
  textOnAccent:      '#27292D',   // см. предупреждение по контрасту

  // Бренд (vars.sass)
  brandNeo:          '#4BD0A0',   // $c-brand-neo — мятно-зелёный Нетологии
  brandNeoHover:     '#65EBC3',   // 2-я точка градиента из apps/blog
  brandNeoActive:    '#37BC8B',   // придумано (темнее для :active)
  brandNeoInk:       '#2B8A64',   // придумано: зелёный для ТЕКСТА (контраст 4.27 на белом)
  brandBlue:         '#0066FF',   // $c-brand-accent
  gradient:          ['#4BD0A0', '#65EBC3', '#B3FBFB'],

  // Узлы (архив, семейство A)
  nodeFill:          '#F3F4F7',   // $c-light-grey, точно совпало с замером архива (#F3F4F7)
  nodeStroke:        '#D0D7DD',   // архив, 4 вхождения в стилях landings
  nodeAccentFill:    '#4BD0A0',
  nodeMutedFill:     '#FAFBFC',   // придумано
  nodeMutedStroke:   '#D0D7DD',

  // Тинты
  tintAccent:        '#E8FBF3',   // придумано на базе --on-light-surface-accent-minor
  borderSubtle:      '#E3E5E9',   // из стилей landings

  // Рёбра
  edgeNeutral:       '#9FA3A7',   // архив (#C4C5C4) + landings (#9FA3A7) → взято контрастнее
  edgeAccent:        '#4BD0A0',
  edgeLabelBg:       '#FFFFFF',
} as const
```

### Контраст (посчитано, не на глаз)

| Комбинация | Контраст | Решение |
|---|---|---|
| `#4BD0A0` на белом (как текст/иконка) | **1.94 : 1** | не использовать для текста |
| `#2B8A64` на белом (зелёный текст) | **4.27 : 1** | использовать для текста-акцента |
| `#27292D` на `#4BD0A0` (текст в акцентном узле) | **7.51 : 1** | ✅ так и делаем |
| белый на `#4BD0A0` | 1.94 : 1 | ❌ так в архиве, но нечитаемо |
| `#27292D` на `#F3F4F7` | 14.4 : 1 | ✅ |

`[РЕШЕНО]` В акцентных узлах — **тёмный текст**. Флаг `accentTextMode: 'light'` оставляем для буквальной верности архиву.

---

## 2. Типографика

```ts
export const font = {
  // Решение заказчика: SB Sans Text везде (гарнитура DS Сбера)
  family: "'SB Sans Text', Arial, sans-serif",
  mono: "'Roboto Mono', ui-monospace, monospace",
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
}

export const type = {
  node:       { size: 18, lineHeight: 1.3, minSize: 11 },
  edgeLabel:  { size: 16, lineHeight: 1.3 },
  groupLabel: { size: 16, lineHeight: 1.3 },
}
```

Файлы (скачаны в `public/fonts/`, сигнатура `wOF2` проверена):

| Файл | Вес | Размер |
|---|---|---|
| `SBSansText-Regular.woff2` | 400 | 39.5 КБ |
| `SBSansText-Medium.woff2` | 500 | 36.8 КБ |
| `SBSansText-Semibold.woff2` | 600 | 42.7 КБ |
| `SBSansText-Bold.woff2` | 700 | 40.2 КБ |

**Источник:** CDN Сбера — тот же CSS, что подключают лендинги (`apps/landings/src/pages/_app.tsx:203`):
`https://cdn-app.sberdevices.ru/shared-static/0.0.0/styles/SBSansText.0.2.0.css`
→ `.../fonts/SBSansText.0.2.0/SBSansText-<Weight>.woff2`.

Почему локально, а не `<link>` на CDN: файлы нужны **в байтах** — их придётся вшивать base64 в SVG при экспорте PNG (PLAN §9.2). С CDN-ссылки этого не сделать.

`[РИСК: лицензия]` Гарнитура Сбера, размещённая на их CDN; лендинги Нетологии её уже используют. Хранение копии в своём репозитории стоит согласовать с владельцем бренда.

`[ПРОВЕРЕНО В РАНТАЙМЕ]` `document.fonts.check('400 16px "SB Sans Text"') === true`, веса 400/600/700 → `loaded`, `body` считает `font-family: "SB Sans Text", Arial, sans-serif`.


`[НЕ ПРОВЕРЕНО]` Совпадает ли шрифт архива с SB Sans Text — не доказано: проверяется наложением рендера на кроп слайда.

---

## 3. Геометрия

```ts
export const size = {
  radius: 12,            // $border-radius-m: 12px в vars.sass — точное совпадение
  strokeWidth: 1,
  edgeWidth: 2,          // архив, семейство A
  edgeWidthThick: 2.5,   // `==>`
  dash: '6 4',
  arrow: 8,              // придумано

  paddingX: 16,          // придумано
  paddingY: 12,          // придумано

  nodeMinWidth: 120,     // придумано
  nodeMaxWidth: 260,     // придумано — ключевое число «не растягивать бокс»
  nodeMinHeight: 56,     // придумано
  nodeMaxHeight: 132,    // придумано

  layerSpacing: 64,      // ELK
  nodeSpacing: 40,       // ELK
  canvasPadding: 32,     // придумано
  groupPadding: 24,      // придумано
}
```

### Распределение текста (fit-text)

| Форма | Текстовая область |
|---|---|
| `box`, `pill`, `round` | `width - 2*16` × `height - 2*12` |
| `decision` (ромб) | **`0.60 * width` × `0.50 * height`** — иначе текст вылезает за скосы |
| `circle` | `0.70 * diameter` × `0.70 * diameter` |
| `hexagon` | `0.75 * width` × `height - 2*12` |

Порядок: `wrap @ 18px` → влезает: бокс = фактическая ширина (в пределах min/max) → не влезает: бинарный поиск `fontSize` в `[11, 18]` → не влезает и 11 px: троеточие.
Бокс **никогда** не растёт из-за текста сверх `nodeMaxWidth × nodeMaxHeight`.

---

## 4. Маппинг фигур Mermaid → «кирпичи»

| Mermaid | role | Как рисуем |
|---|---|---|
| `A[текст]` | `box` | прямоугольник r=12, `nodeFill` |
| `A(текст)` | `round` | то же (стандартизация) |
| `A([текст])` | `pill` | радиус = height/2 |
| `A{текст}` | `decision` | ромб |
| `A((текст))` | `circle` | круг |
| `A{{текст}}` | `hexagon` | шестиугольник |
| `[[ ]]`, `[( )]`, `> ]`, `[/ /]`, `[\ \]`, `[/ \]`, `[\ /]` | `box` | нейтральный бокс |
| `subgraph` | `group` | пунктирный контейнер + подпись |
| `A:::accent` | `accent` | `nodeAccentFill` + тёмный текст |

`[НУЖНО РЕШЕНИЕ, не блокирует]` Способ пометить акцентный узел: `:::accent` (совместимо с Mermaid) — мой выбор по умолчанию.

---

## 5. Что осталось непроверенным

| Что | Как закрыть |
|---|---|
| Шрифт архива = SB Sans Text? | наложить рендер на кроп слайда |
| base64-шрифт в SVG → PNG в Safari | спайк №0 (PLAN §9) |
| `canvas.measureText` vs SVG-рендер для SB Sans Text | юнит-тест с допуском ±2 % |

