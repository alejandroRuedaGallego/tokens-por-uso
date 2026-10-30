import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'tokens-por-modelo',
  component: 'Pane',
  requestId: 'tokens-por-modelo',
  props: {
    title: 'Tokens por modelo',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

function usage(model: string, input: number, output: number, read: number, write: number) {
  return { model, input_tokens: input, output_tokens: output, cache_read_input_tokens: read, cache_creation_input_tokens: write }
}

test('acumula por modelo, subagentes incluidos', async ($, on) => {
  const answers = [
    usage('claude-opus-5-5', 100, 50, 800, 50),
    usage('claude-haiku-5-5', 10, 20, 0, 0),
    usage('claude-opus-5-5', 100, 50, 0, 0),
  ]
  let i = 0
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: answers[i++] ?? null }
  })

  for (const [index, agentId] of [[0, undefined], [1, 'sub-1'], [2, undefined]] as const) {
    const stream = $.turn.step({ turnId: 't1', index, model: 'x', messageCount: 1, ...(agentId ? { agentId } : {}) })
    for await (const _ of stream) { /* sin trozos */ }
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^Opus$/ }))?.text).toBe('Opus')
  expect((await ui.find({ type: 'Text', text: /^Haiku$/ }))?.text).toBe('Haiku')
  expect((await ui.find({ type: 'Text', text: /97\.5%/ }))?.text).toBe("97.5%")
  expect((await ui.find({ type: 'Text', text: /3 peticiones/ })) != null).toBe(true)
  await ui.unmount()

  const band = await $.ui.mount({ plugin: 'tokens-por-modelo', component: 'AbovePrompt', props: {}, surface: 'terminal' } as any)
  expect((await band.find({ type: 'Text', text: /Tokens/ }))?.text).toMatch(/^Tokens: Opus 1\.[12]k · Haiku 30$/)
  await band.unmount()
})
