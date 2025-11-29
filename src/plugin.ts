import {
  Chunker,
  type DistanceMetric,
  type EmbeddingModel,
  type IndexStrategy,
  type PersistenceProvider,
  type VectorPreprocessor,
} from './core'

export type VictorDbPluginContext = {
  registerChunker(chunker: Chunker): void
  registerEmbeddingModel(model: EmbeddingModel): void
  registerPreprocessor(preprocessor: VectorPreprocessor): void
  registerDistanceMetric(metric: DistanceMetric): void
  registerIndexStrategy(strategy: IndexStrategy): void
  registerPersistenceProvider(provider: PersistenceProvider): void
}

export type VictorDbPlugin = {
  name: string
  setup(context: VictorDbPluginContext): Promise<void>
}
