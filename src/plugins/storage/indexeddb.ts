import { openDB, type IDBPDatabase } from 'idb'
import { type PersistenceProvider } from '../../core'
import { type VictorDbPlugin } from '../../plugin'

const DB_NAME = 'VictorDb'
const STORE_NAME = 'VictorStore'

const META_KEY = 'hnsw_metadata'
const NODE_KEY_PREFIX = 'node:'

export class IndexedDbPersistence implements PersistenceProvider {
  public name = 'indexeddb-provider'
  private dbPromise: Promise<IDBPDatabase<unknown>>

  constructor() {
    this.dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }

  async saveMetadata(metadata: any): Promise<void> {
    const db = await this.dbPromise
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await tx.store.put(JSON.stringify(metadata), META_KEY)
    await tx.done
  }

  async loadMetadata(): Promise<any | null> {
    const db = await this.dbPromise
    const raw = await db.get(STORE_NAME, META_KEY)
    return raw ? JSON.parse(raw as string) : null
  }

  async saveNode(node: any): Promise<void> {
    const id = NODE_KEY_PREFIX + node.id
    const db = await this.dbPromise
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await tx.store.put(JSON.stringify(node), id)
    await tx.done
  }

  async loadNode(id: string): Promise<any | null> {
    const key = NODE_KEY_PREFIX + id
    const db = await this.dbPromise
    const raw = await db.get(STORE_NAME, key)
    return raw ? JSON.parse(raw as string) : null
  }

  async loadAllNodes(): Promise<Record<string, any>> {
    const db = await this.dbPromise
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.store

    const nodes: Record<string, any> = {}
    let cursor = await store.openCursor()

    while (cursor) {
      const key = cursor.key as string

      if (key.startsWith(NODE_KEY_PREFIX)) {
        const raw = cursor.value as string
        const node = JSON.parse(raw)
        nodes[node.id] = node
      }

      cursor = await cursor.continue()
    }

    return nodes
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await tx.store.clear()
    await tx.done
  }
}

export function indexedDbProviderPlugin(): VictorDbPlugin {
  return {
    name: 'indexeddb-provider-plugin',
    async setup(context) {
      context.registerPersistenceProvider(new IndexedDbPersistence())
    },
  }
}
