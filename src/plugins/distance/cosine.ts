import { DistanceMetric, Vector } from '@/core'
import { VictorDbPlugin } from '@/plugin'

function cosineSimilarity(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length')
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const va = a[i]
    const vb = b[i]
    dot += va * vb
    normA += va * va
    normB += vb * vb
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

const cosineMetric: DistanceMetric = {
  name: 'cosine',
  distance(a, b) {
    const sim = cosineSimilarity(a, b)
    return 1 - sim
  },
}

export function cosineDistancePlugin(): VictorDbPlugin {
  return {
    name: 'cosine-distance-plugin',
    async setup(context) {
      context.registerDistanceMetric(cosineMetric)
    },
  }
}
