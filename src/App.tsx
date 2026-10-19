import { useEffect, useState } from 'react'
import { Button } from '@salutejs/sdds-netology'

/** Токены, которые нужны для схем. Читаем вычисленные CSS-переменные темы. */
const TOKENS = [
  '--on-light-surface-accent',
  '--on-light-surface-accent-minor',
  '--on-light-text-primary',
  '--on-light-text-secondary',
  '--on-light-surface-solid-primary',
  '--on-light-surface-solid-secondary',
  '--on-light-surface-solid-tertiary',
  '--on-light-surface-solid-card',
  '--on-light-outline-accent',
  '--on-light-outline-transparent-secondary',
  '--on-light-surface-transparent-secondary',
] as const

export function App() {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    const next: Record<string, string> = {}
    for (const t of TOKENS) next[t] = cs.getPropertyValue(t).trim() || '(пусто)'
    setValues(next)
  }, [])

  return (
    <div style={{ padding: 24, display: 'grid', gap: 24, maxWidth: 760 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>DS подключён</h1>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button text="Кнопка из DS" view="accent" />
        <Button text="Вторичная" view="secondary" />
      </div>

      <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {TOKENS.map((t) => (
            <tr key={t}>
              <td style={{ borderBottom: '1px solid #e3e5e9', padding: '6px 12px 6px 0', fontFamily: 'monospace' }}>
                {t}
              </td>
              <td style={{ borderBottom: '1px solid #e3e5e9', padding: '6px 12px' }}>{values[t] ?? '…'}</td>
              <td style={{ borderBottom: '1px solid #e3e5e9', padding: '6px 0' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 28,
                    height: 16,
                    borderRadius: 4,
                    background: values[t] || 'transparent',
                    border: '1px solid #d0d7dd',
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
