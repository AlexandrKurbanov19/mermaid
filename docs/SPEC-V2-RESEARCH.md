# V2: детальный ресёрч типов диаграмм (mermaid `db`)

Проверено прогоном на `mermaid@12.2.0` (не по докам). Для каждого типа — что реально отдаёт `db`, особенности и уточнённая оценка.

**Общее:** парсинг бесплатный (mermaid сам парсит любой тип), переиспользуем метрики/тему/экспорт/зум. Работа на тип = **IR + normalize + layout + render + тесты**.

---

## Сводная таблица

| Тип | mermaid `type` | API `db` | Качество данных | Раскладка | Оценка |
|---|---|---|---|---|---|
| Sequence | `sequence` | `getMessages()`, `getActors()` (Map), `getActorKeys()`, `getBoxes()`, `getConfig()` | чистое | своя вертикальная | 3–4 д |
| State | `stateDiagram` | `getData()` (shape), `getStates()`, `getRelations()` | чистое | **ELK (переиспользуем)** | 2–3 д |
| Class | `classDiagram` | `getClasses()` (Map), `getRelations()`, `getNotes()` | чистое | ELK | 2–3 д |
| ER | `er` | `getEntities()` (Map), `getRelationships()`, `getSubGraphs()` | чистое | ELK | 2–3 д |
| Gantt | `gantt` | **методы в полях**: `getTasks()`, `getSections()`, `getDateFormat()` | грязноватое (даты уже распарсены в ISO) | своя (шкала времени) | 3–4 д |
| Timeline | `timeline` | `getSections()`, `getTasks()` | грязное (пробелы, скобки) | **уже сделано** | ~1 д (включить) |
| Mindmap | `mindmap` | `getMindmap()` → готовое дерево | чистое | своя (дерево) | 2–3 д |
| Journey | `journey` | `getTasks()`, `getSections()`, `getActors()` | чистое | по сути чарт | 1.5–2 д |

---

## Sequence (самый востребованный, самый сложный)

```json
// getMessages()
[{ "id":"0","from":"Alice","to":"Bob","message":"Привет","type":0,"activate":false },
 { "id":"1","from":"Bob","to":"Alice","message":"Ответ","type":1 },
 { "id":"2","from":"Bob","to":"Bob","message":"заметка","type":2,"placement":1 }]

// getActors() — Map
Map([["Alice",{"type":"participant","nextActor":"Bob"}], ["Bob",{"type":"participant"}]])

// getBoxes() — группы участников, getConfig() — отступы (actorMargin, messageMargin, width, height)
```

- `message.type`: 0 = сплошная стрелка, 1 = пунктир (return), 2 = Note.
- Активации/`loop`/`alt` приходят не в `getMessages()`, а парсятся в `addSignal`/блоки — **нужен отдельный спайк** на `loop/alt/opt` (главный риск оценки).
- Раскладка своя: ширина актёров = max ширина сообщения; высота = N сообщений × messageMargin.
- **Уточнение: 3–4 дня, но 0.5 дня сначала — спайк на `loop/alt/par`.**

## State (первым к внедрению)

```json
// getData().nodes
[{ "id":"root_start","label":"root_start","shape":"stateStart","isGroup":false, "descriptions":[] },
 { "id":"Idle","label":"Idle","shape":"state","descriptions":[] },
 { "id":"root_end","label":"root_end","shape":"stateEnd" }]

// getRelations()
[{ "id1":"root_start","id2":"Idle","relationTitle":"" },
 { "id1":"Idle","id2":"Running","relationTitle":"start" }]
```

- `shape`: `stateStart` / `stateEnd` / `state` / `choice` / `fork` / `join` / `composite` / `divider`.
- Рёбра — обычный граф → **раскладка переиспользует ELK** (это и есть причина начинать со state).
- `descriptions` — подпись под названием состояния.
- **Уточнение: 2 дня** (start/end — кружки, choice — ромб, composite — двойная рамка).

## Class

```json
// getClasses() — Map
Map([["Animal",{"label":"Animal","methods":[{ "visibility":"+","text":"makeSound() : void","returnType":"void" }],
                "members":[{ "memberType":"attribute","visibility":"+","text":"String name" }],"annotations":[]}]])

// getRelations()
[{ "id1":"Animal","id2":"Dog","relation":{"type1":1,"type2":"none","lineType":0},"title":"наследует" }]
```

- Блок = 3 секции (имя / поля / методы), стрелки: наследование (пустой треугольник), ассоциация, агрегация/композиция (ромб).
- Раскладка ELK. **2–3 дня.**

## ER

```json
// getEntities() — Map
Map([["CUSTOMER",{"label":"CUSTOMER","attributes":[{ "type":"string","name":"name","keys":[] }] }]])

// getRelationships()
[{ "entityA":"entity-CUSTOMER-0","roleA":"places","entityB":"entity-ORDER-1",
   "relSpec":{"cardA":"ZERO_OR_MORE","relType":"IDENTIFYING","cardB":"ONLY_ONE"}}]
```

- Кардинальность — строки (`ZERO_OR_MORE`, `ONLY_ONE`, `ONE_OR_MORE`…) → рисуем `||--o{`.
- Раскладка ELK. **2–3 дня** (много мелочей в подписях связи).

## Gantt

```json
// getTasks()
[{ "section":"Этап 1","task":"Задача ","id":"a1","order":0,
   "startTime":"2024-01-01T00:00:00.000Z","endTime":"2024-01-06T00:00:00.000Z" }]

// getSections() → ["Этап 1"]
```

- Даты **уже распарсены в ISO** — это большой плюс (не парсить длительности).
- Поля: `getTasks()`, `getSections()`, `getDateFormat()`, `getAxisFormat()`, `getTickInterval()`, `getTodayMarker()`.
- Раскладка своя: ось времени, бары, milestones, зависимости. **3–4 дня** (ось/тики — самое муторное).

## Timeline (уже сделан)

Сделано в итерации 2, выключено из v1. Включить = вернуть ветку в парсер + UI + примеры. **~1 день**, включая проверку.

## Mindmap

```json
// getMindmap() — готовое дерево
{ "id":0,"nodeId":"root","level":0,"descr":"Корень","children":[
    { "nodeId":"Ветка A","descr":"Ветка A","children":[...],"width":200,"padding":10 } ] }
```

- Дерево уже собрано, даже `width` подсчитан. Раскладка своя: уровни слева/направо, изогнутые связи. **2–3 дня.**

## Journey

```json
// getTasks()
[{ "section":"Утро","people":["Я"],"task":"Проснулся","score":5 }]
// getSections() → ["Утро","День"]   getActors() → ["Я","Команда"]
```

- Это чарт «задача × оценка 1–5». Рендер простой. **1.5–2 дня.**

---

## Рекомендованный порядок

1. **State** — переиспользует ELK и рёбра, дешёвый и показательный (2 д).
2. **Sequence** — самый нужный для «фронт ↔ бэк», но перед ним спайк на `loop/alt` (3–4 д).
3. **Class + ER** — парой, обе про «блоки + подписи на связях» (4–5 д вместе).
4. **Mindmap / Journey** — быстрые победы (4 д вместе).
5. **Gantt** — напоследок, своя ось времени (3–4 д).
6. **Timeline** — включить в любой момент за ~1 день.

Стартовый риск: `sequence` `loop/alt/opt` и композитные `state` — единственные места, где данные могут оказаться сложнее, чем в спайке выше. Перед фиксацией сроков по ним — отдельный 0.5-дневный спайк.
