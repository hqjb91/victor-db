import { EmbeddingModel, Payload, Vector } from '@/core'
import { VictorDbPlugin } from '@/plugin'

let embedderPromise: Promise<any> | null = null
let pipelineFn: any = null

async function loadEmbedder() {
  if (!pipelineFn) {
    throw new Error(
      'hfEmbeddingPlugin: @huggingface/transformers not loaded yet.'
    )
  }

  if (!embedderPromise) {
    embedderPromise = pipelineFn(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        dtype: 'fp32',
        device: 'wasm',
        pooling: 'mean',
        normalize: true,
      }
    )
  }

  return embedderPromise
}

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = loadEmbedder()
  }
  return embedderPromise
}

export const hfEmbeddingModel: EmbeddingModel = {
  name: 'hf-embedding',

  async embed(payload: Payload): Promise<Vector> {
    const embedder = await getEmbedder()
    const output = await embedder(payload.text, {
      pooling: 'mean',
      normalize: true,
    })

    return typeof output.tolist === 'function' ? output.tolist()[0] : output[0]
  },

  async getTokenizer(): Promise<any> {
    const embedder = await getEmbedder()
    return embedder.tokenizer
  },
}

export function hfEmbeddingPlugin(): VictorDbPlugin {
  return {
    name: 'hf-embedding-plugin',

    async setup(context) {
      // dynamic import so bundler wont include unless plugin is used
      const mod = await import('@huggingface/transformers')
      pipelineFn = mod.pipeline
      context.registerEmbeddingModel(hfEmbeddingModel)
    },
  }
}
