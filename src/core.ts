export type Vector = number[] | Uint8Array | Float32Array | Float64Array

export type Chunker = {
  name: string
  chunk(text: string): Promise<string[]>
  setEmbeddingModel(embedding: EmbeddingModel): void
  configure?(options: { chunkSize?: number; chunkOverlap?: number }): void
}

export type Payload = {
  parentId: string
  chunkIndex: number
  text: string
}

export type EmbeddedItem = {
  id: string
  vector: Vector
  payload: Payload
}

export type EmbeddingModel = {
  name: string
  embed(payload: Payload): Promise<Vector>
  getTokenizer(): Promise<any>
}

export type VectorPreprocessor = {
  name: string
  process(vector: Vector): Promise<Vector>
}

export type DistanceMetric = {
  name: string
  distance(a: Vector, b: Vector): number
}

export type SearchResult = {
  id: string
  score: number
  payload: Payload
}

export type IndexStrategy = {
  loadFromPersistence(): Promise<void>
  setPersistenceProvider(provider: PersistenceProvider): void
  name: string
  add(item: EmbeddedItem, metric: DistanceMetric): Promise<void>
  search(
    query: Vector,
    k: number,
    metric: DistanceMetric
  ): Promise<SearchResult[]>
}

export type PersistenceProvider = {
  name: string
  saveMetadata(metadata: any): Promise<void>
  loadMetadata(): Promise<any | null>

  saveNode(node: any): Promise<void>
  loadNode(id: string): Promise<any | null>
  loadAllNodes(): Promise<Record<string, any>>
  clear(): Promise<void>
}
