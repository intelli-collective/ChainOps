// Review helper: requires Vite on 5173 and a dedicated Chrome debug instance on 9222.
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json()
export const ws = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let seq = 0
const pending = new Map()
export const errors = []
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  if (message.id) {
    const callback = pending.get(message.id)
    pending.delete(message.id)
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result)
  }
})
export const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})
export const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
export const waitFor = async expression => {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`Boolean(${expression})`)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Timed out: ' + expression)
}
export const click = text => evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(${JSON.stringify(text)})); b.focus(); b.click(); })()`)
export const setValue = (selector, value, type = 'select') => evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${type === 'select' ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event(${JSON.stringify(type === 'select' ? 'change' : 'input')}, { bubbles: true })); })()`)
export const assert = async (expression, message) => {
  if (!await evaluate(expression)) throw new Error(message)
  console.log('PASS ' + message)
}
