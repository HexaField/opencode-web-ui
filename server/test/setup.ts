import { vi } from 'vitest'

// Global mock for transformers to prevent sharp/native module errors across the entire suite
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockImplementation(() => {
    return async (_text: string) => ({
      data: new Float32Array(3).fill(0.1),
      dims: [3],
      size: 3
    })
  }),
  env: {
    allowLocalModels: false
  }
}))
