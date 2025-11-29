import { Chunker, EmbeddingModel } from '@/core'
import { VictorDbPlugin } from '@/plugin'

export const noChunker: Chunker = {
  name: 'none',
  setEmbeddingModel(embedding) {},
  async chunk(text) {
    return [text]
  },
}

async function hfTokenChunker(
  defaultChunkSize: number,
  defaultOverlap: number
): Promise<Chunker> {
  let embedder: EmbeddingModel | null = null
  let chunkSize = defaultChunkSize
  let chunkOverlap = defaultOverlap

  return {
    name: 'hf-token-chunker',

    setEmbeddingModel(model) {
      embedder = model
    },

    configure(options) {
      const nextChunkSize =
        typeof options.chunkSize === 'number' ? options.chunkSize : chunkSize
      const nextChunkOverlap =
        typeof options.chunkOverlap === 'number'
          ? options.chunkOverlap
          : chunkOverlap

      if (nextChunkSize <= 0) {
        throw new Error('chunkSize must be greater than 0')
      }
      if (nextChunkOverlap < 0) {
        throw new Error('chunkOverlap must be 0 or greater')
      }
      if (nextChunkOverlap >= nextChunkSize) {
        throw new Error('chunkOverlap must be smaller than chunkSize')
      }

      chunkSize = nextChunkSize
      chunkOverlap = nextChunkOverlap
    },

    async chunk(text: string) {
      if (!embedder) throw new Error('Embedding model not set')

      const tokenizer = await embedder.getTokenizer()

      const input_ids = tokenizer.encode(text)

      const chunks = []
      let start = 0

      while (start < input_ids.length) {
        const end = start + chunkSize
        const slice = input_ids.slice(start, end)
        chunks.push(tokenizer.decode(slice))
        start = end - chunkOverlap
      }

      return chunks
    },
  }
}

export function chunkerPlugin(maxTokens = 256, overlap = 32): VictorDbPlugin {
  if (maxTokens <= 0) {
    throw new Error('chunkerPlugin: maxTokens must be greater than 0')
  }
  if (overlap < 0) {
    throw new Error('chunkerPlugin: overlap must be 0 or greater')
  }
  if (overlap >= maxTokens) {
    throw new Error('chunkerPlugin: overlap must be smaller than maxTokens')
  }

  return {
    name: 'chunker-plugin',
    async setup(context) {
      context.registerChunker(noChunker)
      context.registerChunker(await hfTokenChunker(maxTokens, overlap))
    },
  }
}
