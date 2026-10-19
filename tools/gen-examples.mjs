// Генерирует docs/EXAMPLES.md из src/examples.ts, чтобы документация не разъезжалась с кодом.
// Запуск: yarn docs:examples (нужен Node 22+, поддерживает type stripping)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { EXAMPLES } = await import(resolve(root, 'src/examples.ts'))

let md = `# Кейсы для проверки

Тот же список доступен в приложении — выпадающий список над редактором.
Копируй блок целиком и вставляй в textarea.

`
for (const ex of EXAMPLES) {
  md += `## ${ex.title}

_Проверяет: ${ex.checks}_

\`\`\`mermaid
${ex.source}
\`\`\`

`
}
md += `## Сводка

| # | Кейс | Что проверяет |
|---|---|---|
`
for (const ex of EXAMPLES) {
  md += `| ${ex.title.split('.')[0]} | ${ex.title.replace(/^\d+\.\s*/, '')} | ${ex.checks} |\n`
}

writeFileSync(resolve(root, 'docs/EXAMPLES.md'), md)
console.log('docs/EXAMPLES.md обновлён:', EXAMPLES.length, 'кейсов')
