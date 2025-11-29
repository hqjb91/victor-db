import assert from 'assert'
import {
  VictorDb,
  chunkerPlugin,
  quantizationPreprocessor,
  euclideanDistancePlugin,
} from '../src'
import {
  type EmbeddingModel,
  type DistanceMetric,
  type IndexStrategy,
  type PersistenceProvider,
  type Vector,
  type Payload,
  type EmbeddedItem,
  type SearchResult,
  type VectorPreprocessor,
} from '../src/core'
import { type VictorDbPlugin, type VictorDbPluginContext } from '../src/plugin'

class TestIndex implements IndexStrategy {
  name = 'test-index'
  added: EmbeddedItem[] = []
  lastSearchQuery: Vector | null = null
  loadCalled = false
  private persistence: PersistenceProvider | null = null

  setPersistenceProvider(provider: PersistenceProvider): void {
    this.persistence = provider
  }

  async loadFromPersistence(): Promise<void> {
    this.loadCalled = true
  }

  async add(item: EmbeddedItem, _metric: DistanceMetric): Promise<void> {
    this.added.push(item)
  }

  async search(
    query: Vector,
    k: number,
    _metric: DistanceMetric
  ): Promise<SearchResult[]> {
    this.lastSearchQuery = query
    return this.added.slice(0, k).map((i) => ({
      id: i.id,
      score: 0,
      payload: i.payload,
    }))
  }
}

class TestPersistence implements PersistenceProvider {
  name = 'test-persistence'
  async saveMetadata(): Promise<void> {}
  async loadMetadata(): Promise<any | null> {
    return null
  }
  async saveNode(): Promise<void> {}
  async loadNode(): Promise<any | null> {
    return null
  }
  async loadAllNodes(): Promise<Record<string, any>> {
    return {}
  }
  async clear(): Promise<void> {}
}

const testEmbedding: EmbeddingModel = {
  name: 'test-embedding',
  async embed(payload: Payload): Promise<Vector> {
    const tokens = payload.text.trim().length
      ? payload.text.trim().split(/\s+/)
      : []
    return tokens.map((_, idx) => idx)
  },
  async getTokenizer() {
    return {
      encode(text: string) {
        return text.trim().length
          ? text
              .trim()
              .split(/\s+/)
              .map((_, idx) => idx)
          : []
      },
      decode(ids: number[]) {
        return ids.map((id) => `t${id}`).join(' ')
      },
    }
  },
}

const testDistance: DistanceMetric = {
  name: 'test-distance',
  distance(a: Vector, b: Vector) {
    return Math.abs(a.length - b.length)
  },
}

function preprocessorPlugin(pre: VectorPreprocessor): VictorDbPlugin {
  return {
    name: 'test-preprocessor-plugin',
    async setup(ctx: VictorDbPluginContext) {
      ctx.registerPreprocessor(pre)
    },
  }
}

function embeddingPlugin(): VictorDbPlugin {
  return {
    name: 'test-embedding-plugin',
    async setup(ctx: VictorDbPluginContext) {
      ctx.registerEmbeddingModel(testEmbedding)
    },
  }
}

function distancePlugin(): VictorDbPlugin {
  return {
    name: 'test-distance-plugin',
    async setup(ctx: VictorDbPluginContext) {
      ctx.registerDistanceMetric(testDistance)
    },
  }
}

function indexPlugin(index: TestIndex): VictorDbPlugin {
  return {
    name: 'test-index-plugin',
    async setup(ctx: VictorDbPluginContext) {
      ctx.registerIndexStrategy(index)
    },
  }
}

function persistencePlugin(provider: PersistenceProvider): VictorDbPlugin {
  return {
    name: 'test-persistence-plugin',
    async setup(ctx: VictorDbPluginContext) {
      ctx.registerPersistenceProvider(provider)
    },
  }
}

async function setupDbWith(index: TestIndex) {
  const db = new VictorDb()
  await db.use(chunkerPlugin())
  await db.use(embeddingPlugin())
  await db.use(distancePlugin())
  await db.use(indexPlugin(index))
  await db.use(persistencePlugin(new TestPersistence()))
  return db
}

async function getQuantizationPreprocessor(): Promise<VectorPreprocessor> {
  let captured: VectorPreprocessor | null = null
  const ctx: VictorDbPluginContext = {
    registerChunker() {},
    registerEmbeddingModel() {},
    registerPreprocessor(pre: VectorPreprocessor) {
      captured = pre
    },
    registerDistanceMetric() {},
    registerIndexStrategy() {},
    registerPersistenceProvider() {},
  }
  await quantizationPreprocessor().setup(ctx as any)
  if (!captured) throw new Error('failed to capture quantization preprocessor')
  return captured
}

;(async () => {
  // chunker plugin rejects invalid parameters
  assert.throws(() => chunkerPlugin(0, 1), /maxTokens must be greater than 0/)
  assert.throws(() => chunkerPlugin(10, -1), /overlap must be 0 or greater/)
  assert.throws(
    () => chunkerPlugin(10, 10),
    /overlap must be smaller than maxTokens/
  )

  // chunker configure rejects invalid runtime config
  {
    const index = new TestIndex()
    const db = await setupDbWith(index)
    db.configure({
      chunker: 'hf-token-chunker',
      chunkSize: 2,
      chunkOverlap: 1,
      embeddingModel: 'test-embedding',
      distanceMetric: 'test-distance',
      indexStrategy: 'test-index',
      persistenceProvider: 'test-persistence',
    })
    assert.throws(
      () =>
        db.configure({
          chunker: 'hf-token-chunker',
          chunkSize: 2,
          chunkOverlap: 5,
          embeddingModel: 'test-embedding',
          distanceMetric: 'test-distance',
          indexStrategy: 'test-index',
          persistenceProvider: 'test-persistence',
        }),
      /chunkOverlap must be smaller than chunkSize/
    )
  }

  // chunker honors configured chunkSize/overlap
  const indexA = new TestIndex()
  const dbA = await setupDbWith(indexA)
  dbA.configure({
    chunker: 'hf-token-chunker',
    chunkSize: 3,
    chunkOverlap: 1,
    embeddingModel: 'test-embedding',
    distanceMetric: 'test-distance',
    indexStrategy: 'test-index',
    persistenceProvider: 'test-persistence',
  })
  await dbA.addText('doc', 'one two three four five six seven eight')
  assert.strictEqual(indexA.added.length, 4, 'expected four overlapping chunks')
  assert.deepStrictEqual(indexA.added[0].payload.chunkIndex, 0)

  // preprocessors applied during add and search
  const indexB = new TestIndex()
  const scalePre: VectorPreprocessor = {
    name: 'scale-pre',
    async process(vec: Vector) {
      return vec.map((v) => (typeof v === 'number' ? v * 10 : v))
    },
  }
  const dbB = new VictorDb()
  await dbB.use(chunkerPlugin())
  await dbB.use(embeddingPlugin())
  await dbB.use(distancePlugin())
  await dbB.use(indexPlugin(indexB))
  await dbB.use(persistencePlugin(new TestPersistence()))
  await dbB.use(preprocessorPlugin(scalePre))
  dbB.configure({
    chunker: 'hf-token-chunker',
    embeddingModel: 'test-embedding',
    distanceMetric: 'test-distance',
    indexStrategy: 'test-index',
    persistenceProvider: 'test-persistence',
    preprocessors: ['scale-pre'],
  })
  await dbB.addText('doc', 'a b c')
  assert.deepStrictEqual(indexB.added[0].vector, [0, 10, 20]) // scaled
  await dbB.search('a b', 1)
  assert.deepStrictEqual(indexB.lastSearchQuery, [0, 10]) // scaled query

  // load triggers underlying index persistence load
  {
    const index = new TestIndex()
    const db = await setupDbWith(index)
    db.configure({
      chunker: 'hf-token-chunker',
      embeddingModel: 'test-embedding',
      distanceMetric: 'test-distance',
      indexStrategy: 'test-index',
      persistenceProvider: 'test-persistence',
    })
    await db.load()
    assert.ok(index.loadCalled, 'expected loadFromPersistence to be invoked')
  }

  // quantization preprocessor rejects zero-range vectors
  const quantPre = await getQuantizationPreprocessor()
  await assert.rejects(() => quantPre.process([1, 1, 1]), /zero range/)
  // quantization produces metadata and quantized values otherwise
  const quantized = await quantPre.process([0, 10, 20, 30])
  const quantizedWithMeta = quantized as unknown as {
    _quantized: boolean
    _metadata: any
    length: number
  } & any[]
  assert.ok(Array.isArray(quantizedWithMeta))
  assert.ok(quantizedWithMeta._quantized)
  assert.ok(quantizedWithMeta._metadata)
  assert.strictEqual(quantizedWithMeta.length, 4)

  // exports reachable (imported at top); simple smoke check for euclidean plugin
  assert.ok(typeof euclideanDistancePlugin === 'function')

  // eslint-disable-next-line no-console
  console.log('All VictorDb tests passed')
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})
