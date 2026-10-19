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
    title: 'Направление схемы',
    items: [
      { id: 'td', title: 'Сверху вниз', note: 'по умолчанию, самый частый вариант', code: 'graph TD\n    A[Первый] --> B[Второй]' },
      { id: 'lr', title: 'Слева направо', note: 'цепочки и процессы', code: 'graph LR\n    A[Первый] --> B[Второй] --> C[Третий]' },
      { id: 'bt', title: 'Снизу вверх', note: 'когда выводы идут вверх', code: 'graph BT\n    A[Факт] --> B[Вывод]' },
      { id: 'rl', title: 'Справа налево', note: 'редко, но поддерживается', code: 'graph RL\n    A[Первый] --> B[Второй]' },
    ],
  },
  {
    id: 'shapes',
    title: 'Формы блоков',
    items: [
      { id: 'box', title: 'Прямоугольник', note: 'обычный шаг процесса', code: 'graph TD\n    A[Обычный шаг] --> B[Следующий]' },
      { id: 'round', title: 'Скруглённый', note: 'визуально то же, что прямоугольник', code: 'graph TD\n    A(Скруглённый) --> B[Следующий]' },
      { id: 'pill', title: 'Капсула', note: 'начало и конец процесса', code: 'graph TD\n    A([Начало]) --> B([Конец])' },
      { id: 'decision', title: 'Ромб (решение)', note: 'из него выходят ветки «да/нет»', code: 'graph TD\n    A{Вопрос?} --> B[Да]\n    A --> C[Нет]' },
      { id: 'circle', title: 'Круг', note: 'текст сам уменьшится, если не влезает', code: 'graph TD\n    A((Старт)) --> B((Финиш))' },
      { id: 'hexagon', title: 'Шестиугольник', note: 'акцентный шаг', code: 'graph TD\n    A{{Шестиугольник}} --> B[Дальше]' },
      { id: 'chevron', title: 'Шеврон (блок-стрелка)', note: 'как этапы «1→2→3» в архиве', code: 'graph LR\n    A>Первый] --> B>Второй]' },
      { id: 'exotic', title: 'Экзотика', note: '[[ ]] и [( )] сводятся к обычному блоку — с предупреждением', code: 'graph TD\n    A[[Подпрограмма]] --> B[(База)]' },
    ],
  },
  {
    id: 'edges',
    title: 'Связи',
    items: [
      { id: 'arrow', title: 'Обычная стрелка', note: 'основной вид', code: 'graph TD\n    A --> B' },
      { id: 'line', title: 'Линия без стрелки', note: '', code: 'graph TD\n    A --- B' },
      { id: 'dashed', title: 'Пунктир', note: 'необязательная связь', code: 'graph TD\n    A -.-> B' },
      { id: 'thick', title: 'Жирная', note: 'важный путь', code: 'graph TD\n    A ==> B' },
      { id: 'both', title: 'Двусторонняя', note: 'обмен в обе стороны', code: 'graph TD\n    A <--> B' },
      { id: 'label', title: 'Подпись на связи', note: 'второй способ записи — через -- текст -->', code: 'graph TD\n    A -->|да| B\n    A -- нет --> C' },
      { id: 'ghost', title: '«Плюс» без линии', note: 'чипы в ряд: связь есть, линии нет', code: 'graph LR\n    A[Входные данные] ---|+| B[Ответ модели] ---|+| C[Результат]' },
    ],
  },
  {
    id: 'text',
    title: 'Текст в блоках',
    items: [
      { id: 'bold', title: 'Жирный и код', note: 'markdown внутри подписи', code: 'graph TD\n    A["**Шаг 1** и `code`"] --> B[Дальше]' },
      { id: 'br', title: 'Перенос строки', note: 'вторая строка в блоке', code: 'graph TD\n    A["Первая строка<br/>вторая строка"] --> B[Дальше]' },
      { id: 'long', title: 'Много текста', note: 'блок НЕ растянется: уменьшится шрифт, в пределе — «…»', code: 'graph TD\n    A[Очень длинный текст, который описывает сразу несколько шагов сценария и не помещается в обычный блок схемы] --> B[Короткий]' },
      { id: 'badge', title: 'Номер в кружке', note: '«1.» в начале подписи становится бейджем', code: 'graph LR\n    A[1. Понять проблему] --> B[2. Сформулировать задачу]' },
    ],
  },
  {
    id: 'markers',
    title: 'Маркеры вида (единственный способ менять оформление)',
    items: [
      { id: 'accent', title: 'Акцентный блок', note: 'брендовая заливка градиентом', code: 'graph TD\n    A[Обычный] --> B[Главный шаг]:::accent' },
      { id: 'secondary', title: 'Вторичный (синий)', note: 'второй поток, альтернатива', code: 'graph TD\n    A[Первый поток] --> B[Второй поток]:::secondary' },
      { id: 'outline', title: 'Обводка вместо заливки', note: 'белая карточка с зелёной рамкой', code: 'graph TD\n    A[Обычный] --> B[С обводкой]:::outline' },
      { id: 'muted', title: 'Приглушённый', note: 'пунктирная рамка: необязательный шаг', code: 'graph TD\n    A[Обычный] --> B[Необязательный]:::muted' },
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
        code: 'graph TD\n    subgraph Стадион\n        A[Бригады] --> B[Клубы]\n    end\n    subgraph Студия\n        C[Режиссёр] --> D[Support]\n    end\n    B --> C',
      },
    ],
  },
  {
    id: 'timeline',
    title: 'Таймлайн (отдельный тип схемы)',
    items: [
      {
        id: 'timeline-simple',
        title: 'Годы и события',
        note: 'подписи чередуются сверху и снизу',
        code: 'timeline\n    2022 : Запуск продукта\n    2023 : Две новые программы : Рост аудитории\n    2024 : Масштабирование',
      },
      {
        id: 'timeline-sections',
        title: 'С секциями',
        note: 'section попадает в кружок, строка после неё — заголовок подписи',
        code: 'timeline\n    section 2022\n        Запуск : Первый продукт\n    section 2023\n        Рост : Две новые программы',
      },
      {
        id: 'timeline-title',
        title: 'С заголовком',
        note: 'заголовок выводится в описании к картинке',
        code: 'timeline\n    title История продукта\n    2022 : Запуск',
      },
    ],
  },
]

export const SYNTAX_TOTAL = SYNTAX_GROUPS.reduce((sum, group) => sum + group.items.length, 0)
