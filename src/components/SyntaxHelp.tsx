import { SYNTAX_GROUPS } from '../syntax'
import { color } from '../diagram/theme'

/**
 * Справочник по синтаксису: выезжающая панель внутри колонки редактора.
 * Кнопка «вставить» подставляет рабочий сниппет в textarea.
 */

interface Props {
  onInsert: (code: string) => void
  onClose: () => void
}

export function SyntaxHelp({ onInsert, onClose }: Props) {
  return (
    <div className="syntax-panel">
      <div className="syntax-panel__head">
        <strong style={{ fontSize: 14 }}>Синтаксис</strong>
        <span style={{ color: color.textSecondary, fontSize: 12 }}>нажми «вставить» — код появится слева</span>
        <button type="button" onClick={onClose} className="syntax-panel__close" title="Закрыть">
          ✕
        </button>
      </div>

      <div className="syntax-panel__body">
        {SYNTAX_GROUPS.map((group) => (
          <section key={group.id} style={{ display: 'grid', gap: 8 }}>
            <h3 style={{ margin: '8px 0 0', fontSize: 13, color: color.textSecondary, textTransform: 'uppercase' }}>
              {group.title}
            </h3>
            {group.items.map((item) => (
              <div key={item.id} className="syntax-item">
                <div style={{ display: 'grid', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</span>
                  {item.note && <span style={{ fontSize: 12, color: color.textSecondary }}>{item.note}</span>}
                  <code className="syntax-item__code">{item.code}</code>
                </div>
                <button type="button" className="syntax-item__insert" onClick={() => onInsert(item.code)}>
                  вставить
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
