import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'

export class EmbeddingService {
  private static instance: EmbeddingService
  private pipe: FeatureExtractionPipeline | null = null

  private constructor() {}

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  async initialize() {
    if (!this.pipe) {
      this.pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    }
  }

  async embed(text: string): Promise<Float32Array | null> {
    if (!this.pipe) await this.initialize()
    if (!this.pipe) return null

    const output = await this.pipe(text, { pooling: 'mean', normalize: true })
    return output.data as Float32Array
  }
}
