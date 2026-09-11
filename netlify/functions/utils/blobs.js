import { connectLambda, getStore } from '@netlify/blobs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

const STORE_NAME = 'data'

function createFsStore() {
  const root = path.join(process.cwd(), '.netlify', 'blobs-local', STORE_NAME)

  return {
    async setJSON(key, value) {
      const file = path.join(root, key)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(value, null, 2), 'utf8')
    },
    async get(key, options = {}) {
      const file = path.join(root, key)
      try {
        const raw = await readFile(file, 'utf8')
        if (options.type === 'json') return JSON.parse(raw)
        return raw
      } catch (err) {
        if (err && err.code === 'ENOENT') return null
        throw err
      }
    },
    async delete(key) {
      const { unlink } = await import('fs/promises')
      const file = path.join(root, key)
      try {
        await unlink(file)
      } catch (err) {
        if (err && err.code === 'ENOENT') return
        throw err
      }
    },
  }
}

/**
 * Returns a Netlify Blobs store when Netlify injects `event.blobs`
 * (production / linked `netlify dev`). Falls back to a local filesystem
 * store under `.netlify/blobs-local/` so Phase 1 works without linking a site.
 */
export async function getDataStore(event) {
  if (event?.blobs) {
    connectLambda(event)
    return getStore(STORE_NAME)
  }

  return createFsStore()
}
