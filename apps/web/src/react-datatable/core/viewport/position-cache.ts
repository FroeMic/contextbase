export interface PositionCacheOptions {
  count: number
  defaultSize: number
  getSizeAt?: (index: number) => number | undefined
}

/**
 * Prefix-sum position cache for variable-sized rows or columns.
 *
 * The cache materializes item offsets eagerly so the viewport engine can:
 * - map index -> offset in O(1)
 * - map offset -> index in O(log n)
 * - read total axis size in O(1)
 */
export class PositionCache {
  private readonly count: number
  private readonly defaultSize: number
  private readonly sizeResolver?: (index: number) => number | undefined

  private offsets: number[] | null = null
  private sizes: number[] | null = null
  private totalSize = 0

  constructor(options: PositionCacheOptions) {
    this.count = options.count
    this.defaultSize = options.defaultSize
    this.sizeResolver = options.getSizeAt
  }

  build() {
    const offsets = new Array<number>(this.count)
    const sizes = new Array<number>(this.count)

    let runningOffset = 0

    for (let index = 0; index < this.count; index += 1) {
      const size = this.sizeResolver?.(index) ?? this.defaultSize
      offsets[index] = runningOffset
      sizes[index] = size
      runningOffset += size
    }

    this.offsets = offsets
    this.sizes = sizes
    this.totalSize = runningOffset
  }

  ensureBuilt() {
    if (this.offsets && this.sizes) {
      return
    }

    this.build()
  }

  invalidate() {
    this.offsets = null
    this.sizes = null
    this.totalSize = 0
  }

  getCount() {
    return this.count
  }

  getTotalSize() {
    this.ensureBuilt()
    return this.totalSize
  }

  getOffset(index: number) {
    this.ensureBuilt()

    if (index <= 0 || !this.offsets?.length) {
      return 0
    }

    if (index >= this.count) {
      return this.totalSize
    }

    return this.offsets![index] ?? this.totalSize
  }

  getSizeAt(index: number) {
    this.ensureBuilt()

    if (index < 0 || index >= this.count || !this.sizes?.length) {
      return this.defaultSize
    }

    return this.sizes![index] ?? this.defaultSize
  }

  findIndexAtOffset(offset: number) {
    this.ensureBuilt()

    if (this.count === 0 || !this.offsets?.length) {
      return 0
    }

    if (offset <= 0) {
      return 0
    }

    if (offset >= this.totalSize) {
      return Math.max(this.count - 1, 0)
    }

    let low = 0
    let high = this.count - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const start = this.offsets[mid] ?? 0
      const size = this.sizes?.[mid] ?? this.defaultSize
      const end = start + size

      if (offset < start) {
        high = mid - 1
        continue
      }

      if (offset >= end) {
        low = mid + 1
        continue
      }

      return mid
    }

    return Math.min(Math.max(low, 0), this.count - 1)
  }
}
