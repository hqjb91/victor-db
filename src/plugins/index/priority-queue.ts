export class PriorityQueue<T> {
  private _heap: T[] = []
  private _comparator: (a: T, b: T) => boolean

  constructor(comparator: (a: T, b: T) => boolean) {
    this._comparator = comparator
  }

  get size(): number {
    return this._heap.length
  }

  get isEmpty(): boolean {
    return this._heap.length === 0
  }

  peek(): T | undefined {
    return this._heap[0]
  }

  insert(value: T): void {
    this._heap.push(value)
    this._bubbleUp()
  }

  poll(): T | undefined {
    if (this._heap.length === 0) return undefined
    if (this._heap.length === 1) return this._heap.pop()

    this._swap(0, this._heap.length - 1)
    const popped = this._heap.pop()
    this._bubbleDown()
    return popped
  }

  private _bubbleUp(): void {
    let index = this._heap.length - 1
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this._comparator(this._heap[index], this._heap[parentIndex])) {
        this._swap(index, parentIndex)
        index = parentIndex
      } else {
        break
      }
    }
  }

  private _bubbleDown(): void {
    let index = 0
    const length = this._heap.length

    while (true) {
      const left = 2 * index + 1
      const right = 2 * index + 2
      let best = index

      if (
        left < length &&
        this._comparator(this._heap[left], this._heap[best])
      ) {
        best = left
      }
      if (
        right < length &&
        this._comparator(this._heap[right], this._heap[best])
      ) {
        best = right
      }

      if (best === index) break

      this._swap(index, best)
      index = best
    }
  }

  private _swap(i: number, j: number) {
    ;[this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]]
  }
}
