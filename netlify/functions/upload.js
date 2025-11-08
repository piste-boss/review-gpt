import { createStore } from './_lib/store.js'

export const handler = async () => {
  const store = createStore('uploads')
  await store.set('hello.txt', 'こんにちは Blobs')
  const txt = await store.get('hello.txt', { type: 'text' })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: `stored: ${txt}`,
  }
}
