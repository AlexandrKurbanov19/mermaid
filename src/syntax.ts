/**
 * Справочник по поддерживаемому синтаксису.
 *
 * Каждая запись — рабочий сниппет. Это проверяется тестом (`syntax.test.ts`):
 * каждый `code` обязан успешно парситься, иначе справочник «сгниёт» и начнёт врать.
 */

export interface SyntaxItem {
  id: string
  title: string
  /** короткое пояснение «что получится» */
  note: string
  code: string
}

export interface SyntaxGroup {
  id: string
  title: string
  items: SyntaxItem[]
}

export const SYNTAX_GROUPS: SyntaxGroup[] = [
  {
    id: 'direction',
    title: 'Направление схемы (flowchart — современный, graph — легаси-синоним)',
    items: [
      { id: 'td', title: 'Сверху вниз', note: 'по умолчанию, самый частый вариант', code: 'flowchart TD\n    A[Первый] --> B[Второй]' },
      { id: 'lr', title: 'Слева направо', note: 'цепочки и процессы', code: 'flowchart LR\n    A[Первый] --> B[Второй] --> C[Третий]' },
      { id: 'bt', title: 'Снизу вверх', note: 'когда выводы идут вверх', code: 'flowchart BT\n    A[Факт] --> B[Вывод]' },
      { id: 'rl', title: 'Справа налево', note: 'редко, но поддерживается', code: 'flowchart RL\n    A[Первый] --> B[Второй]' },
    ],
  },
  {
    id: 'shapes',
    title: 'Формы блоков',
    items: [
      { id: 'box', title: 'Прямоугольник', note: 'обычный шаг процесса', code: 'flowchart TD\n    A[Обычный шаг] --> B[Следующий]' },
      { id: 'round', title: 'Скруглённый', note: 'визуально то же, что прямоугольник', code: 'flowchart TD\n    A(Скруглённый) --> B[Следующий]' },
      { id: 'pill', title: 'Капсула', note: 'начало и конец процесса', code: 'flowchart TD\n    A([Начало]) --> B([Конец])' },
      { id: 'decision', title: 'Ромб (решение)', note: 'из него выходят ветки «да/нет»', code: 'flowchart TD\n    A{Вопрос?} --> B[Да]\n    A --> C[Нет]' },
      { id: 'circle', title: 'Круг', note: 'текст сам уменьшится, если не влезает', code: 'flowchart TD\n    A((Старт)) --> B((Финиш))' },
      { id: 'hexagon', title: 'Шестиугольник', note: 'акцентный шаг', code: 'flowchart TD\n    A{{Шестиугольник}} --> B[Дальше]' },
      { id: 'chevron', title: 'Шеврон (блок-стрелка)', note: 'как этапы «1→2→3» в архиве', code: 'flowchart LR\n    A>Первый] --> B>Второй]' },
      { id: 'cylinder', title: 'Цилиндр (база данных)', note: 'хранилище, БД, таблица', code: 'flowchart LR\n    UI --> API --> DB[(Database)]' },
      { id: 'subroutine', title: 'Подпрограмма', note: 'процедура/функция — двойная рамка', code: 'flowchart TD\n    A[[Обработать данные]] --> B[Дальше]' },
      { id: 'parallelogram', title: 'Параллелограмм', note: 'ввод/вывод данных', code: 'flowchart TD\n    A[/Входные данные/] --> B[/Результат/]' },
      { id: 'exotic', title: 'Экзотика (трапеция)', note: 'сводится к обычному блоку — с предупреждением', code: 'flowchart TD\n    A[/трапеция\\] --> B[Дальше]' },
    ],
  },
  {
    id: 'edges',
    title: 'Связи',
    items: [
      { id: 'arrow', title: 'Обычная стрелка', note: 'основной вид', code: 'flowchart TD\n    A --> B' },
      { id: 'line', title: 'Линия без стрелки', note: '', code: 'flowchart TD\n    A --- B' },
      { id: 'dashed', title: 'Пунктир', note: 'необязательная связь', code: 'flowchart TD\n    A -.-> B' },
      { id: 'thick', title: 'Жирная', note: 'важный путь', code: 'flowchart TD\n    A ==> B' },
      { id: 'both', title: 'Двусторонняя', note: 'обмен в обе стороны', code: 'flowchart TD\n    A <--> B' },
      { id: 'label', title: 'Подпись на связи', note: 'второй способ записи — через -- текст -->', code: 'flowchart TD\n    A -->|да| B\n    A -- нет --> C' },
      { id: 'ghost', title: '«Плюс» без линии', note: 'чипы в ряд: связь есть, линии нет', code: 'flowchart LR\n    A[Входные данные] ---|+| B[Ответ модели] ---|+| C[Результат]' },
    ],
  },
  {
    id: 'text',
    title: 'Текст в блоках',
    items: [
      { id: 'bold', title: 'Жирный и код', note: 'markdown внутри подписи', code: 'flowchart TD\n    A["**Шаг 1** и `code`"] --> B[Дальше]' },
      { id: 'br', title: 'Перенос строки', note: 'вторая строка в блоке', code: 'flowchart TD\n    A["Первая строка<br/>вторая строка"] --> B[Дальше]' },
      { id: 'long', title: 'Много текста', note: 'блок НЕ растянется: уменьшится шрифт, в пределе — «…»', code: 'flowchart TD\n    A[Очень длинный текст, который описывает сразу несколько шагов сценария и не помещается в обычный блок схемы] --> B[Короткий]' },
      { id: 'badge', title: 'Номер в кружке', note: '«1.» в начале подписи становится бейджем', code: 'flowchart LR\n    A[1. Понять проблему] --> B[2. Сформулировать задачу]' },
    ],
  },
  {
    id: 'markers',
    title: 'Маркеры вида (единственный способ менять оформление)',
    items: [
      { id: 'accent', title: 'Акцентный блок', note: 'брендовая заливка градиентом', code: 'flowchart TD\n    A[Обычный] --> B[Главный шаг]:::accent' },
      { id: 'secondary', title: 'Вторичный (синий)', note: 'второй поток, альтернатива', code: 'flowchart TD\n    A[Первый поток] --> B[Второй поток]:::secondary' },
      { id: 'outline', title: 'Обводка вместо заливки', note: 'белая карточка с зелёной рамкой', code: 'flowchart TD\n    A[Обычный] --> B[С обводкой]:::outline' },
      { id: 'muted', title: 'Приглушённый', note: 'пунктирная рамка: необязательный шаг', code: 'flowchart TD\n    A[Обычный] --> B[Необязательный]:::muted' },
    ],
  },
  {
    id: 'groups',
    title: 'Группы (подграфы)',
    items: [
      {
        id: 'subgraph',
        title: 'Группа',
        note: 'пунктирный контейнер; цвет чередуется зелёный/синий',
        code: 'flowchart TD\n    subgraph Стадион\n        A[Бригады] --> B[Клубы]\n    end\n    subgraph Студия\n        C[Режиссёр] --> D[Support]\n    end\n    B --> C',
      },
    ],
  },
]

export const SYNTAX_TOTAL = SYNTAX_GROUPS.reduce((sum, group) => sum + group.items.length, 0)
