import { type Vector, type VectorPreprocessor } from '../../core'
import { type VictorDbPlugin } from '../../plugin'

export function quantizationPreprocessor(bits: number = 8): VictorDbPlugin {
  const pre: VectorPreprocessor = {
    name: 'quantization-preprocessor',
    async process(vector: Vector): Promise<Vector> {
      const max = Math.max(...vector)
      const min = Math.min(...vector)
      const range = max - min
      if (range === 0)
        throw new Error('Cannot quantize a vector with zero range.')
      const levels = 2 ** bits
      const step = range / levels

      const quantizedLevels = vector.map((v) => {
        const level = Math.floor((v - min) / step)
        return Math.min(level, levels - 1)
      })

      let typedArray
      if (bits <= 8) {
        typedArray = new Uint8Array(quantizedLevels)
      } else if (bits <= 16) {
        typedArray = new Uint16Array(quantizedLevels)
      } else {
        typedArray = new Uint32Array(quantizedLevels)
      }

      const metadata = { min, step, bits }

      return Object.assign(Array.from(typedArray), {
        _quantized: true,
        _metadata: metadata,
      }) as Vector
    },
  }

  return {
    name: 'quantization-preprocessor-plugin',
    async setup(context) {
      context.registerPreprocessor(pre)
    },
  }
}
