import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ModelTotals, Totals } from '../types'

const PANE = 'tokens-por-modelo'
const TITLE = 'Tokens por modelo'

// Solo $.state: vive en memoria durante la sesión, nunca en $.store ni en disco.
const totals = atom({ plugin: 'tokens-por-modelo', key: 'totals' } as const, {}, {
  shape: 'totals-1',
})

const FAMILIES = ['opus', 'sonnet', 'haiku', 'fable']

/** "claude-opus-5-5" -> "Opus"; un modelo desconocido conserva su id. */
export function familyOf(model: string): string {
  const id = model.toLowerCase()
  const family = FAMILIES.find(name => id.includes(name))

  return family ? family.charAt(0).toUpperCase() + family.slice(1) : model
}

export function sumOf(row: ModelTotals): number {
  return row.input + row.output + row.cacheRead + row.cacheWrite
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`

  return String(n)
}

function full(n: number): string {
  return n.toLocaleString('es-ES')
}

function sorted(all: Totals): ModelTotals[] {
  return Object.values(all).sort((a, b) => sumOf(b) - sumOf(a))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tokens',
      description: 'Abre el panel de tokens por modelo de esta sesión',
    })

    return next(e)
  })

  on('command.run', { command: 'tokens' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })

    return {
      text: isPlaced
        ? 'Panel de tokens por modelo abierto.'
        : 'Panel de tokens por modelo listo; esta superficie no puede mostrarlo ahora.',
    }
  })

  // Cada petición al modelo (turno principal y subagentes) pasa por turn.step.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage

    if (usage) {
      const label = familyOf(usage.model || e.model)
      await update($, totals, all => {
        const row = all[label] ?? {
          label,
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          requests: 0,
        }

        return {
          ...all,
          [label]: {
            ...row,
            input: row.input + usage.input_tokens,
            output: row.output + usage.output_tokens,
            cacheRead: row.cacheRead + usage.cache_read_input_tokens,
            cacheWrite: row.cacheWrite + usage.cache_creation_input_tokens,
            requests: row.requests + 1,
          },
        }
      })
    }

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const rows = sorted(await read($, totals))
    const grand = rows.reduce((acc, row) => acc + sumOf(row), 0)

    if (rows.length === 0) {
      return <Text dimColor>Aún no hay peticiones al modelo en esta sesión.</Text>
    }

    const cols = [
      { title: 'Modelo', width: 12 },
      { title: 'Entrada', width: 12 },
      { title: 'Salida', width: 12 },
      { title: 'Lect. caché', width: 14 },
      { title: 'Escr. caché', width: 14 },
      { title: 'Total', width: 14 },
      { title: '%', width: 8 },
    ]
    const line = (cells: string[], opts: { bold?: boolean; dim?: boolean; key: string }) => (
      <Box key={opts.key} flexDirection="row">
        {cells.map((cell, i) => (
          <Box width={cols[i]?.width ?? 12}>
            <Text bold={opts.bold} dimColor={opts.dim} tabular wrap="truncate">
              {cell}
            </Text>
          </Box>
        ))}
      </Box>
    )
    const pct = (n: number) => (grand > 0 ? `${((n / grand) * 100).toFixed(1)}%` : '0%')
    const totalRow: ModelTotals = rows.reduce(
      (acc, row) => ({
        ...acc,
        input: acc.input + row.input,
        output: acc.output + row.output,
        cacheRead: acc.cacheRead + row.cacheRead,
        cacheWrite: acc.cacheWrite + row.cacheWrite,
        requests: acc.requests + row.requests,
      }),
      { label: 'Total', input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0 },
    )
    const cellsOf = (row: ModelTotals) => [
      row.label,
      full(row.input),
      full(row.output),
      full(row.cacheRead),
      full(row.cacheWrite),
      full(sumOf(row)),
      pct(sumOf(row)),
    ]

    return (
      <Box flexDirection="column">
        {line(cols.map(c => c.title), { bold: true, key: 'head' })}
        {rows.map(row => line(cellsOf(row), { key: `row-${row.label}` }))}
        {line(cellsOf(totalRow), { bold: true, key: 'total' })}
        <Text dimColor>
          {totalRow.requests} peticiones, subagentes incluidos. Solo en memoria: se borra al cerrar la sesión.
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rows = sorted(await read($, totals))

    if (e.props.hasSurvey || rows.length === 0) {
      return next(e)
    }

    const { Text } = $.ui.resolve(e)
    const parts = rows.map(row => `${row.label} ${compact(sumOf(row))}`).join(' · ')

    return <Text dimColor>Tokens: {parts}</Text>
  })
}
