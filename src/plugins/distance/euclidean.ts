import { DistanceMetric, Vector } from '@/core'
import { VictorDbPlugin } from '@/plugin'

function euclideanDistance(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length')
  }

  let sumSquaredDifferences = 0

  for (let i = 0; i < a.length; i++) {
    const difference = a[i] - b[i]
    sumSquaredDifferences += difference * difference
  }

  return Math.sqrt(sumSquaredDifferences)
}

const euclideanMetric: DistanceMetric = {
  name: 'euclidean',
  distance(a, b) {
    return euclideanDistance(a, b)
  },
}

export function euclideanDistancePlugin(): VictorDbPlugin {
  return {
    name: 'euclidean-distance-plugin',
    async setup(context) {
      context.registerDistanceMetric(euclideanMetric)
    },
  }
}
