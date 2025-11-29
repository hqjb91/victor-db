import {
  type Payload,
  type Chunker,
  type DistanceMetric,
  type EmbeddedItem,
  type EmbeddingModel,
  type IndexStrategy,
  type PersistenceProvider,
  type SearchResult,
  type Vector,
  type VectorPreprocessor,
} from './core'
import { type VictorDbPlugin, type VictorDbPluginContext } from './plugin'

export type VictorDbConfig = {
  chunker?: string
  chunkSize?: number
  chunkOverlap?: number
  embeddingModel: string
  preprocessors?: string[]
  distanceMetric: string
  indexStrategy: string
  persistenceProvider: string
}

export class VictorDb {
  private _chunkers = new Map<string, Chunker>()
  private _embeddingModels = new Map<string, EmbeddingModel>()
  private _preprocessors = new Map<string, VectorPreprocessor>()
  private _distanceMetrics = new Map<string, DistanceMetric>()
  private _indexStrategies = new Map<string, IndexStrategy>()
  private _persistenceProviders = new Map<string, PersistenceProvider>()

  private _activeChunker?: Chunker
  private _activeEmbeddingModel?: EmbeddingModel
  private _activePreprocessors: VectorPreprocessor[] = []
  private _activeDistanceMetric?: DistanceMetric
  private _activeIndexStrategy?: IndexStrategy
  private _activePersistenceProvider?: PersistenceProvider

  async use(plugin: VictorDbPlugin) {
    const context: VictorDbPluginContext = {
      registerChunker: (chunker) => {
        this._chunkers.set(chunker.name, chunker)
      },
      registerEmbeddingModel: (model) => {
        this._embeddingModels.set(model.name, model)
      },
      registerPreprocessor: (preprocessor) => {
        this._preprocessors.set(preprocessor.name, preprocessor)
      },
      registerDistanceMetric: (metric) => {
        this._distanceMetrics.set(metric.name, metric)
      },
      registerIndexStrategy: (strategy) => {
        this._indexStrategies.set(strategy.name, strategy)
      },
      registerPersistenceProvider: (provider) => {
        this._persistenceProviders.set(provider.name, provider)
      },
    }

    await plugin.setup(context)
  }

  private async _applyPreprocessors(vector: Vector): Promise<Vector> {
    let current = vector
    for (const pre of this._activePreprocessors) {
      current = await pre.process(current)
    }
    return current
  }

  configure(config: VictorDbConfig) {
    const chunker = this._chunkers.get(config.chunker ?? 'none')
    const chunkSize = config.chunkSize
    const chunkOverlap = config.chunkOverlap
    const embedding = this._embeddingModels.get(config.embeddingModel)
    const metric = this._distanceMetrics.get(config.distanceMetric)
    const index = this._indexStrategies.get(config.indexStrategy)
    const provider = this._persistenceProviders.get(config.persistenceProvider)

    if (!chunker) {
      throw new Error(`Chunker '${config.chunker}' not found`)
    }
    if (!embedding) {
      throw new Error(`Embedding model '${config.embeddingModel}' not found`)
    }
    if (!metric) {
      throw new Error(`Distance metric '${config.distanceMetric}' not found`)
    }
    if (!index) {
      throw new Error(`Index strategy '${config.indexStrategy}' not found`)
    }
    if (!provider) {
      throw new Error(
        `Persistence provider '${config.persistenceProvider}' not found`
      )
    }

    this._activeChunker = chunker
    this._activeEmbeddingModel = embedding
    this._activeDistanceMetric = metric
    this._activeIndexStrategy = index
    this._activePersistenceProvider = provider

    index.setPersistenceProvider(provider)
    chunker.setEmbeddingModel(embedding)
    if (
      chunker.configure &&
      (chunkSize !== undefined || chunkOverlap !== undefined)
    ) {
      chunker.configure({
        chunkSize,
        chunkOverlap,
      })
    }

    this._activePreprocessors = []
    if (config.preprocessors?.length) {
      this._activePreprocessors = config.preprocessors.map((name) => {
        const preprocessor = this._preprocessors.get(name)
        if (!preprocessor) throw new Error(`Preprocessor '${name}' not found`)
        return preprocessor
      })
    }
  }

  private _ensureConfigured() {
    if (
      !this._activeEmbeddingModel ||
      !this._activeDistanceMetric ||
      !this._activeIndexStrategy ||
      !this._activePersistenceProvider
    ) {
      throw new Error('VictorDb is not configured. Call configure() first.')
    }
  }

  async addText(id: string, text: string) {
    this._ensureConfigured()
    const model = this._activeEmbeddingModel!
    const metric = this._activeDistanceMetric!
    const index = this._activeIndexStrategy!
    const chunker = this._activeChunker!

    const chunks = await chunker.chunk(text)
    let chunkIndex = 0

    for (const chunk of chunks) {
      const payload = {
        parentId: id,
        chunkIndex,
        text: chunk,
      }
      const vector = await this._applyPreprocessors(await model.embed(payload))

      const item: EmbeddedItem = {
        id: `${id}_chunk_${chunkIndex}`,
        vector,
        payload: payload ?? '',
      }

      item.payload = payload

      await index.add(item, metric)
      chunkIndex++
    }
  }

  async search(queryText: string, k: number): Promise<SearchResult[]> {
    this._ensureConfigured()
    const model = this._activeEmbeddingModel!
    const metric = this._activeDistanceMetric!
    const index = this._activeIndexStrategy!

    const queryPayload = {
      parentId: '-1',
      text: queryText,
      chunkIndex: 0,
    }

    const raw = await model.embed(queryPayload)
    const query = await this._applyPreprocessors(raw)

    return index.search(query, k, metric)
  }

  async load(): Promise<void> {
    this._ensureConfigured()
    const index = this._activeIndexStrategy!
    await index.loadFromPersistence()
  }
}
