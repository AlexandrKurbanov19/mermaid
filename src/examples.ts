/**
 * Набор кейсов для проверки. Используется в выпадающем списке в UI
 * и в docs/EXAMPLES.md (для копипаста вне приложения).
 */
export interface Example {
  id: string
  title: string
  /** что именно проверяет */
  checks: string
  source: string
}

export const EXAMPLES: Example[] = [
  {
    id: 'basic',
    title: '1. Пример из задачи',
    checks: 'база: бокс, ромб, подписи рёбер, цикл D → B',
    source: `flowchart TD
    A[Пользователь] --> B{Авторизован?}
    B -- да --> C[Открыть дашборд]
    B -- нет --> D[Показать логин]
    D --> B`,
  },
  {
    id: 'linear',
    title: '2. Линейный процесс',
    checks: 'простая цепочка, вертикальная раскладка',
    source: `flowchart TD
    A[Заявка] --> B[Проверка] --> C[Согласование] --> D[Запуск] --> E[Отчёт]`,
  },
  {
    id: 'shapes',
    title: '3. Все формы',
    checks: 'box, round, pill, circle, hexagon, decision',
    source: `flowchart LR
    A[Прямоугольник] --> B(Скруглённый)
    B --> C([Капсула])
    C --> D((Круг))
    D --> E{{Шестиугольник}}
    E --> F{Ромб}`,
  },
    {
    id: 'edges',
    title: '4. Все типы связей',
    checks: 'solid, dashed, thick, без стрелки, двусторонняя',
    source: `flowchart TD
    A --> B
    B -.-> C
    C ==> D
    D --- E
    E <--> F`,
  },
  {
    id: 'edge-labels',
    title: '5. Подписи связей, два синтаксиса',
    checks: '|текст| и -- текст -->',
    source: `flowchart TD
    A[Старт] -->|успех| B[Продолжить]
    A -- ошибка --> C[Повторить]
    B -->|готово| D[Конец]
    C --> A`,
  },
  {
    id: 'direction-lr',
    title: '6. Горизонтальная схема (LR)',
    checks: 'направление слева направо',
    source: `flowchart LR
    A[Идея] --> B[Исследование] --> C[Прототип] --> D[Запуск]`,
  },
  {
    id: 'direction-bt',
    title: '7. Снизу вверх (BT)',
    checks: 'обратное направление',
    source: `flowchart BT
    A[Факт] --> B[Вывод] --> C[Решение]`,
  },
  {
    id: 'text-short',
    title: '8. Текст: короткий (шрифт 18)',
    checks: 'базовый размер, минимальный бокс',
    source: `flowchart TD
    A[Ок] --> B[Да]`,
  },
  {
    id: 'text-medium',
    title: '9. Текст: средний (перенос строк)',
    checks: 'обёртка в 3 строки, шрифт ещё базовый',
    source: `flowchart TD
    A[Пользователь авторизован и открывает дашборд] --> B[Готово]`,
  },
  {
    id: 'text-long',
    title: '10. Текст: длинный (шрифт уменьшается)',
    checks: 'fit-text: бокс НЕ растёт, шрифт падает до ~13px',
    source: `flowchart TD
    A[Очень длинный текст в одном блоке, который описывает сразу несколько шагов сценария и никак не хочет помещаться в стандартный прямоугольник схемы] --> B[Короткий]`,
  },
  {
    id: 'text-huge',
    title: '11. Текст: огромный (обрезка «…»)',
    checks: 'предел: шрифт 11px, многоточие, бокс не выходит за 260×132',
    source: `flowchart TD
    A[Очень длинный текст в одном блоке. Очень длинный текст в одном блоке. Очень длинный текст в одном блоке. Очень длинный текст в одном блоке. Очень длинный текст в одном блоке. Очень длинный текст в одном блоке. Очень длинный текст в одном блоке. Очень длинный текст в одном блоке.] --> B[Короткий]`,
  },
  {
    id: 'text-word',
    title: '12. Текст: одно слово без пробелов',
    checks: 'жёсткий перенос по символам',
    source: `flowchart TD
    A[суперкалифраджилистикэкспиалидоция] --> B[Ок]`,
  },
  {
    id: 'markdown',
    title: '13. Markdown в подписях',
    checks: '**жирный**, `код`, <br/> перенос',
    source: `flowchart TD
    A["**Шаг 1**<br/>модель извлекает \`json\`"] --> B["Шаг 2<br/>сервис находит **заказ**"]`,
  },
  {
    id: 'accent',
    title: '14. Акцентный и приглушённый узлы',
    checks: ':::accent — брендовый градиент; :::muted — пунктирная рамка',
    source: `flowchart TD
    A[Обычный шаг] --> B[Важный шаг]:::accent
    B --> C[Необязательный шаг]:::muted
    C --> D[Финал]`,
  },
  {
    id: 'styles-ignored',
    title: '15. Пользовательские стили (игнорируются)',
    checks: 'classDef/style не применяются, показывается предупреждение',
    source: `flowchart TD
    A[Первый] --> B[Второй]
    classDef red fill:#ff0000,stroke:#000
    class A red
    style B fill:#00ff00`,
  },
  {
    id: 'subgraph',
    title: '16. Группа (subgraph)',
    checks: 'группы рисуются пунктирными контейнерами (ELK-кластеры)',
    source: `flowchart TD
    subgraph Стадион
      A[Бригады] --> B[Клубы]
    end
    subgraph Студия
      C[Режиссёр] --> D[Support]
    end
    B --> C`,
  },
  {
    id: 'many',
    title: '17. Много узлов (20)',
    checks: 'производительность и читаемость большой схемы',
    source: `flowchart TD
    N1 --> N2 --> N3 --> N4 --> N5
    N1 --> N6 --> N7 --> N8
    N3 --> N9 --> N10
    N5 --> N11 --> N12
    N7 --> N13 --> N14
    N9 --> N15
    N11 --> N16 --> N17
    N13 --> N18 --> N19 --> N20`,
  },
  {
    id: 'fan',
    title: '18. Веер: 1 → 6 и 6 → 1',
    checks: 'широкая раскладка, много параллельных линий',
    source: `flowchart TD
    A[Центр] --> B1[Раз]
    A --> B2[Два]
    A --> B3[Три]
    A --> B4[Четыре]
    A --> B5[Пять]
    A --> B6[Шесть]
    B1 --> C[Сбор]
    B2 --> C
    B3 --> C
    B4 --> C
    B5 --> C
    B6 --> C`,
  },
  {
    id: 'disconnected',
    title: '19. Несвязные компоненты',
    checks: 'два независимых графа на одном холсте',
    source: `flowchart TD
    A[Один] --> B[Два]
    C[Три] --> D[Четыре]`,
  },
  {
    id: 'self-loop',
    title: '20. Петля на себя',
    checks: 'ребро A → A не должно ломать раскладку',
    source: `flowchart TD
    A[Старт] --> A
    A --> B[Финал]`,
  },
  {
    id: 'decision-long',
    title: '21. Ромб с длинным текстом',
    checks: 'текст вписан в 0.60×0.50 ромба, не вылезает за скосы',
    source: `flowchart TD
    A{Пользователь авторизован и имеет активную подписку?} --> B[Да]
    A --> C[Нет]`,
  },
      {
    id: 'badges',
    title: '22. Бейджи-номера',
    checks: '«1. текст» -> номер в кружке слева, без нового синтаксиса',
    source: `flowchart LR
    A[1. Понять проблему] --> B[2. Сформулировать задачу]
    B --> C[3. Задать критерии]
    C --> D[4. Принять решение]`,
  },
  {
    id: 'chevron-secondary',
    title: '23. Шеврон и вторичный акцент',
    checks: 'A>текст] -> шеврон; :::secondary -> синяя карточка',
    source: `flowchart TD
    A>Старт процесса] --> B[Обычный шаг]
    B --> C[Второй поток]:::secondary
    C --> D>Финиш]`,
  },
  {
    id: 'chips-plus',
    title: '24. Чипы через «+»',
    checks: 'связь без линии и без стрелки: рисуется только разделитель «+»',
    source: `flowchart LR
    A[Входные данные] ---|+| B[Ответ модели] ---|+| C[Время ответа] ---|+| D[Результат проверки]`,
  },
  {
    id: 'outline-accent',
    title: '25. Акцент обводкой + цветные контейнеры',
    checks: ':::outline — белая карточка с зелёной рамкой; контейнеры чередуют зелёный и синий',
    source: `flowchart TD
    subgraph Стадион
      A[Бригады] --> B[Клубы]
    end
    subgraph Студия
      C[Режиссёр] --> D[Support]
    end
    B --> C
    C --> E[Директор по коммуникациям]:::outline`,
  },
  {
    id: 'all-shapes',
    title: '26. Разные блоки: БД, подпрограмма, ввод/вывод, трапеция, двойной круг',
    checks: 'полный набор фигур flowchart',
    source: `flowchart LR
  UI --> API --> DB[(Database)]
  API --> P[[Обработать данные]]
  P --> IO[/Входные данные/]
  IO --> M[/Ручная операция\\]
  M --> C(((Процесс)))`,
  },
  {
    id: 'database',
    title: '27. База данных (цилиндр)',
    checks: '[(...)] — цилиндр; LR-цепочка UI → API → DB',
    source: `flowchart LR
  UI --> API --> DB[(Database)]`,
  },
  {
    id: 'state',
    title: '28. State-диаграмма',
    checks: 'stateDiagram-v2: старт/конец, состояния, переходы с подписями',
    source: `stateDiagram-v2
    [*] --> Idle
    Idle --> Running : start
    Running --> [*] : stop
    Running --> Idle : reset`,
  },
  {
    id: 'sequence',
    title: '29. Sequence-диаграмма',
    checks: 'sequenceDiagram: актёры, сообщения, loop/alt',
    source: `sequenceDiagram
    Client->>API: запрос
    API-->>Client: ответ
    loop Повтор
      API->>DB: запрос к базе
      DB-->>API: данные
    end
    alt Успех
      API->>Client: 200 OK
    else Ошибка
      API->>Client: 500
    end`,
  },
  {
    id: 'class',
    title: '30. Class-диаграмма',
    checks: 'classDiagram: классы с полями/методами, наследование',
    source: `classDiagram
    class Animal {
      +String name
      +makeSound() void
    }
    class Dog {
      +bark() String
    }
    Animal <|-- Dog : наследует
    Dog ..> Owner : использует`,
  },
  {
    id: 'er',
    title: '31. ER-диаграмма',
    checks: 'erDiagram: сущности, атрибуты, связи с кардинальностью',
    source: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
      int id PK
      string name
    }
    ORDER {
      int id PK
      int customer_id FK
    }`,
  },
  {
    id: 'mindmap',
    title: '32. Mindmap',
    checks: 'mindmap: дерево слева направо',
    source: `mindmap
  root(Старт)
    Ветка A
      Лист A1
      Лист A2
    Ветка B
      Лист B1`,
  },
  {
    id: 'journey',
    title: '33. Journey',
    checks: 'journey: секции, задачи, оценка 1–5',
    source: `journey
    title Поездка
    section Утро
      Проснулся: 5: Я
      Кофе: 3: Я
    section День
      Работа: 2: Я, Команда`,
  },
  {
    id: 'gantt',
    title: '34. Gantt',
    checks: 'gantt: шкала времени, секции, задачи-бары',
    source: `gantt
    title План проекта
    section Этап 1
      Дизайн :a1, 2024-01-01, 5d
      Прототип :a2, after a1, 4d
    section Этап 2
      Разработка :a3, 2024-01-10, 10d`,
  },
  {
    id: 'timeline',
    title: '35. Timeline',
    checks: 'timeline: ось, кружки, подписи сверху/снизу',
    source: `timeline
    title История продукта
    2022 : Запуск
    2023 : Две программы : Рост
    2024 : Масштабирование`,
  },
  {
    id: 'error-syntax',
    title: '36. ОШИБКА: битый синтаксис',
    checks: 'плашка ошибки, превью не падает',
    source: `flowchart TD
    A[Старт] -->
    B -->--> C`,
  },
  {
    id: 'error-type',
    title: '37. ОШИБКА: другой тип диаграммы',
    checks: 'sequenceDiagram в v1 не поддерживается',
    source: `sequenceDiagram
    A->>B: привет`,
  },
]

export const DEFAULT_EXAMPLE = EXAMPLES[0]
