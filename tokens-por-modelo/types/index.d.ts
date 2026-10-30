export type ModelTotals = {
  /** Nombre que se muestra: Opus, Sonnet, Haiku o el id del modelo. */
  label: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** Peticiones contadas (pasos del turno principal y de subagentes). */
  requests: number
}

export type Totals = Record<string, ModelTotals>

declare module 'claude-code' {
  interface PluginState {
    'tokens-por-modelo': { totals: Shaped<Totals> }
  }
}
