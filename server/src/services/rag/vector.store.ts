import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface VectorDocument {
  id: string
  content: string
  metadata: Record<string, any>
  vector: number[]
}

export interface SearchResult extends Omit<VectorDocument, 'vector'> {
  score: number
}

export class VectorStore {
  private documents: VectorDocument[] = []
  private embedder: FeatureExtractionPipeline | null = null
  private modelName = 'Xenova/all-MiniLM-L6-v2'
  private indexPath: string

  constructor(storageDir: string) {
    this.indexPath = path.join(storageDir, 'index.json')
  }

  public async initialize() {
    // 1. Load Index
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8')
      this.documents = JSON.parse(data)
    } catch (e) {
      // Ignore if file doesn't exist
      this.documents = []
    }

    // 2. Init Embedder
    try {
      // @ts-ignore - Types for transformers are a bit loose in some versions
      this.embedder = await pipeline('feature-extraction', this.modelName)
    } catch (e) {
      console.error('Failed to load embedding model', e)
      throw e
    }
  }

  public async addDocument(id: string, content: string, metadata: Record<string, any> = {}) {
    if (!this.embedder) throw new Error('Embedder not initialized')

    const output = await this.embedder(content, { pooling: 'mean', normalize: true })
    const vector = Array.from(output.data) as number[]

    // Remove existing if any
    this.documents = this.documents.filter((d) => d.id !== id)

    this.documents.push({
      id,
      content,
      metadata,
      vector
    })
  }

  public async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.embedder) throw new Error('Embedder not initialized')

    const output = await this.embedder(query, { pooling: 'mean', normalize: true })
    const queryVector = Array.from(output.data) as number[]

    // Calculate Cosine Similarity (Dot product since vectors are normalized)
    const scored = this.documents.map((doc) => {
      const score = this.cosineSimilarity(queryVector, doc.vector)
      return {
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        score
      }
    })

    // Sort descending
    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, limit)
  }

  public async save() {
    const dir = path.dirname(this.indexPath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(this.indexPath, JSON.stringify(this.documents))
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
    }
    return dot
  }
}
