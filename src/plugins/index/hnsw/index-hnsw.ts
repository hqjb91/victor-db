import {
  type Payload,
  type DistanceMetric,
  type EmbeddedItem,
  type IndexStrategy,
  type SearchResult,
  type Vector,
  PersistenceProvider,
} from '../../../core'
import { PriorityQueue } from '../priority-queue'
import { type VictorDbPlugin } from '../../../plugin'

export interface HnswNode {
  id: string
  vector: Vector
  level: number
  neighbors: string[][]
  payload: Payload
}

export interface HnswMetadata {
  entryPointId: string
  maxLevel: number
  m: number
  efConstruction: number
  mL: number
}

export class HnswIndex implements IndexStrategy {
  public name = 'index-hnsw'

  private nodes = new Map<string, HnswNode>()
  private entryPointId: string = '-1'
  private maxLevel = 0
  private m: number
  private efConstruction: number
  private mL: number

  private persistence: any = null

  constructor(options: { m?: number; efConstruction?: number } = {}) {
    this.m = options.m ?? 16
    this.efConstruction = options.efConstruction ?? 200
    this.mL = 1 / Math.log(this.m)
  }

  setPersistenceProvider(provider: PersistenceProvider) {
    this.persistence = provider
  }

  private async saveNode(node: HnswNode) {
    if (this.persistence?.saveNode) {
      await this.persistence.saveNode(node)
    }
  }

  private async saveMetadata() {
    if (this.persistence?.saveMetadata) {
      const meta: HnswMetadata = {
        entryPointId: this.entryPointId,
        maxLevel: this.maxLevel,
        m: this.m,
        efConstruction: this.efConstruction,
        mL: this.mL,
      }
      await this.persistence.saveMetadata(meta)
    }
  }

  async loadFromPersistence(): Promise<void> {
    if (!this.persistence) return

    const meta: HnswMetadata | null = await this.persistence.loadMetadata()
    if (!meta) return

    this.entryPointId = meta.entryPointId
    this.maxLevel = meta.maxLevel
    this.m = meta.m
    this.efConstruction = meta.efConstruction
    this.mL = meta.mL

    const all: Record<string, any> = await this.persistence.loadAllNodes()
    this.nodes.clear()

    for (const [key, value] of Object.entries(all)) {
      this.nodes.set(key, value)
    }
  }

  private _getRandomLevel(): number {
    return Math.floor(-Math.log(Math.random()) * this.mL)
  }

  private _searchLayer(
    entryPointId: string,
    queryVector: Vector,
    ef: number,
    level: number,
    metric: DistanceMetric
  ): { id: string; distance: number }[] {
    const visited = new Set<string>()

    const candidates = new PriorityQueue<{ id: string; distance: number }>(
      (a, b) => a.distance < b.distance
    )

    const results = new PriorityQueue<{ id: string; distance: number }>(
      (a, b) => a.distance > b.distance
    )

    const entryPoint = this.nodes.get(entryPointId)
    if (!entryPoint) return []

    const entryDistance = metric.distance(queryVector, entryPoint.vector)
    candidates.insert({ id: entryPointId, distance: entryDistance })
    results.insert({ id: entryPointId, distance: entryDistance })
    visited.add(entryPointId)

    while (!candidates.isEmpty) {
      const current = candidates.poll()!
      const farthestResult = results.peek()

      if (
        farthestResult &&
        current.distance > farthestResult.distance &&
        results.size >= ef
      ) {
        break
      }

      const node = this.nodes.get(current.id)
      if (!node || level >= node.neighbors.length) continue

      for (const neighborId of node.neighbors[level]) {
        if (visited.has(neighborId)) continue
        const neighbor = this.nodes.get(neighborId)
        if (!neighbor) continue

        visited.add(neighborId)
        const distance = metric.distance(queryVector, neighbor.vector)
        const farthest = results.peek()

        if (results.size < ef || (farthest && distance < farthest.distance)) {
          candidates.insert({ id: neighborId, distance })
          results.insert({ id: neighborId, distance })
          if (results.size > ef) {
            results.poll()
          }
        }
      }
    }

    const finalResults: { id: string; distance: number }[] = []
    while (!results.isEmpty) {
      const r = results.poll()
      if (r) finalResults.push(r)
    }
    return finalResults.reverse()
  }

  private _selectNeighbors(
    neighbors: { id: string; distance: number }[],
    m: number
  ): { id: string; distance: number }[] {
    return neighbors.sort((a, b) => a.distance - b.distance).slice(0, m)
  }

  async add(item: EmbeddedItem, metric: DistanceMetric): Promise<void> {
    if (this.nodes.has(item.id)) return

    const level = this._getRandomLevel()
    const newNode: HnswNode = {
      id: item.id,
      vector: item.vector,
      level,
      neighbors: Array.from({ length: level + 1 }, () => []),
      payload: item.payload,
    }

    this.nodes.set(item.id, newNode)
    await this.saveNode(newNode)

    if (this.entryPointId === '-1') {
      this.entryPointId = item.id
      this.maxLevel = level
      await this.saveMetadata()
      return
    }

    let entryPoint = this.nodes.get(this.entryPointId)!

    for (
      let currentLevel = this.maxLevel;
      currentLevel > level;
      currentLevel--
    ) {
      const nearest = this._searchLayer(
        entryPoint.id,
        item.vector,
        1,
        currentLevel,
        metric
      )
      if (nearest.length > 0) {
        entryPoint = this.nodes.get(nearest[0].id)!
      }
    }

    for (
      let currentLevel = Math.min(level, this.maxLevel);
      currentLevel >= 0;
      currentLevel--
    ) {
      const neighbors = this._searchLayer(
        entryPoint.id,
        item.vector,
        this.efConstruction,
        currentLevel,
        metric
      )

      const maxConnections = currentLevel === 0 ? this.m * 2 : this.m
      const selected = this._selectNeighbors(neighbors, maxConnections)

      newNode.neighbors[currentLevel] = selected.map((n) => n.id)

      for (const n of selected) {
        const neighbor = this.nodes.get(n.id)
        if (!neighbor) continue

        const neighborMax = currentLevel === 0 ? this.m * 2 : this.m

        if (neighbor.neighbors[currentLevel].length < neighborMax) {
          neighbor.neighbors[currentLevel].push(item.id)
        } else {
          const candidates = neighbor.neighbors[currentLevel]
            .map((nid) => ({
              id: nid,
              distance: metric.distance(
                neighbor.vector,
                this.nodes.get(nid)!.vector
              ),
            }))
            .concat([
              {
                id: item.id,
                distance: metric.distance(neighbor.vector, item.vector),
              },
            ])

          const pruned = this._selectNeighbors(candidates, neighborMax)
          neighbor.neighbors[currentLevel] = pruned.map((c) => c.id)
        }

        await this.saveNode(neighbor)
      }

      if (neighbors.length > 0) {
        entryPoint = this.nodes.get(neighbors[0].id)!
      }
    }

    if (level > this.maxLevel) {
      this.maxLevel = level
      this.entryPointId = item.id
    }

    await this.saveMetadata()
  }

  async search(
    query: Vector,
    k: number,
    metric: DistanceMetric
  ): Promise<SearchResult[]> {
    if (this.entryPointId === '-1') return []

    let entryPoint = this.nodes.get(this.entryPointId)!

    for (let currentLevel = this.maxLevel; currentLevel > 0; currentLevel--) {
      const nearest = this._searchLayer(
        entryPoint.id,
        query,
        1,
        currentLevel,
        metric
      )
      if (nearest.length > 0) {
        entryPoint = this.nodes.get(nearest[0].id)!
      }
    }

    const ef = Math.max(this.efConstruction, k)
    const neighbors = this._searchLayer(entryPoint.id, query, ef, 0, metric)

    return neighbors.slice(0, k).map((n) => {
      const node = this.nodes.get(n.id)!
      return { id: n.id, score: n.distance, payload: node.payload }
    })
  }
}

export function hnswIndexPlugin(options?: {
  m?: number
  efConstruction?: number
}): VictorDbPlugin {
  return {
    name: 'index-hnsw-plugin',
    async setup(context) {
      const index = new HnswIndex(options)
      context.registerIndexStrategy(index)
    },
  }
}
