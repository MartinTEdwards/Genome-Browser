/**
 * High-performance BitSet for Genomic "Sentences"
 */
export class GeneBitSet {
  words: Uint32Array

  constructor(size: number) {
    this.words = new Uint32Array(Math.ceil(size / 32))
  }

  add(index: number) {
    this.words[index >>> 5] |= 1 << (index & 31)
  }

  has(index: number): boolean {
    return (this.words[index >>> 5] & (1 << (index & 31))) !== 0
  }

  /**
   * Returns the count of shared genes (Intersection)
   */
  static intersectCount(a: GeneBitSet, b: GeneBitSet): number {
    let count = 0
    const len = Math.min(a.words.length, b.words.length)
    for (let i = 0; i < len; i++) {
      let v = a.words[i] & b.words[i]
      if (v === 0) continue
      v = v - ((v >> 1) & 0x55555555)
      v = (v & 0x33333333) + ((v >> 2) & 0x33333333)
      count += (((v + (v >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24
    }
    return count
  }
}
