# VictorDb

![VictorDb](assets/victor-db-screenshot.gif)

Local‑first vector database for browser environments. VictorDb handles chunking, embedding, preprocessing, Approximate Nearest Neighbors (ANN) indexing Hierachical Navigable Small Worlds (HNSW), and persistence on top of IndexedDB so you can run retrieval without a server.

```
RAW TEXT
   v
CHUNKER (text -> chunks)
   v
EMBEDDING MODEL (chunk -> vector)
   v
PREPROCESSORS (vector -> transformed vector)
   v
INDEX STRATEGY (HNSW)
   v
PERSISTENCE (IndexedDB)
```

## Features

- Works fully in the browser and persists to IndexedDB.
- Plugin-driven: swap chunkers, embedding models, distance metrics, preprocessors, index strategies, and persistence providers.
- Ships with Hugging Face token chunking, Hugging Face embeddings (model Xenova/all-MiniLM-L6-v2), cosine/euclidean distance, HNSW index, optional vector quantization preprocessor, and IndexedDB storage.

## Installation

VictorDb expects the embedding and storage dependencies to be installed by the host app:

```bash
npm install victor-db-ts @huggingface/transformers idb
```

## Quick start

```ts
import {
  VictorDb,
  chunkerPlugin,
  hfEmbeddingPlugin,
  cosineDistancePlugin,
  hnswIndexPlugin,
  indexedDbProviderPlugin,
  quantizationPreprocessor,
} from 'victor-db-ts'

const db = new VictorDb()

await db.use(chunkerPlugin())
await db.use(hfEmbeddingPlugin())
await db.use(cosineDistancePlugin())
await db.use(hnswIndexPlugin())
await db.use(indexedDbProviderPlugin())
await db.use(quantizationPreprocessor()) // optional

// Configure active components
db.configure({
  chunker: 'hf-token-chunker', // optional, simple chunker included matching default model
  chunkSize: 512, // optional
  chunkOverlap: 64, // optional
  embeddingModel: 'hf-embedding', // Xenova/all-MiniLM-L6-v2
  distanceMetric: 'cosine', // or "euclidean"
  indexStrategy: 'index-hnsw',
  persistenceProvider: 'indexeddb-provider',
  preprocessors: ['quantization-preprocessor'], // optional
})

// Load previously persisted index
await db.load()

// Index text and save it to IndexedDb
await db.addText('1', 'The Future of Remote Work: Trends to Watch in 2024...')
await db.addText(
  '2',
  'Sustainable Living: Small Changes That Make a Big Impact...'
)
// ...

// Search
const results = await db.search('Technology', 3)
console.log(results)
```

### Built-in plugins

- Chunker: `chunkerPlugin()` → `hf-token-chunker`
- Embedding: `hfEmbeddingPlugin()` → `hf-embedding`
- Distance metrics: `cosineDistancePlugin()`, `euclideanDistancePlugin()`.
- Index: `hnswIndexPlugin()` → `index-hnsw`
- Preprocessor: `quantizationPreprocessor(bits = 8)` → `quantization-preprocessor`.
- Persistence: `indexedDbProviderPlugin()` → `indexeddb-provider`.

### Writing your own plugin

```ts
import type { VictorDbPlugin } from 'victor-db-ts'

export function myDistancePlugin(): VictorDbPlugin {
  return {
    name: 'my-distance-plugin',
    async setup(ctx) {
      ctx.registerDistanceMetric({
        name: 'l1',
        distance: (a, b) =>
          a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0),
      })
    },
  }
}
```

Then register it with `await db.use(myDistancePlugin());` and select it in `configure`.

## License

ISC
