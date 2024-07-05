/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains a simple implementation of an fixed-size
 * updatable Index-MinHeap
 */

/**
 * Updatable Index-MinHeap of fixed size.
 * "Index-MinHeap" means, that the heap only stores numbers which
 * are meant to represent indices.
 * The "value" or "weight" of each index is defined by a weighting-function
 * "Updatable" means that the weight of an index can change.
 * Finally, "fixed-size" refers to the fact, that the heap cannot be
 * enlarged after it was created
 *
 */
export class MinHeap {
  private mapping: number[];
  private heap: number[];
  private weighting: (idx: number) => number;
  private currentSize: number;

  /**
   * Constructor
   *
   * @param size fixed size of the heap
   * @param weighting weighting function
   */
  public constructor(size: number, weighting: (idx: number) => number) {
    this.weighting = weighting;
    this.currentSize = size;
    this.heap = Array.from(Array(size).keys());
    this.mapping = new Array<number>(size);
    // Initially the heap is sorted which may seem strange
    // However, note that the main purpose of this structure
    // is to keep a kind-of-sorted order (top has to be the minimum)
    this.heap.sort((a, b) => weighting(a) - weighting(b));
    this.heap.forEach((n, i) => (this.mapping[n] = i));
  }

  /**
   * Method invoking the update-procedure for a given
   * element. Every time a element changes (or the weight of an element to
   * be more precise), this function has to be called
   * immediately after and especially before any other element is
   * updated!
   *
   * @param elem element that changed
   */
  public update(elem: number) {
    if (elem < 0 || elem > this.mapping.length) {
      throw new Error("Element does not exist");
    }
    let i = this.mapping[elem];
    if (i >= this.currentSize) {
      // Element already removed
      throw new Error("Element does not exist");
    }

    while (
      i > 0 &&
      this.weighting(this.heap[i]) <
        this.weighting(this.heap[MinHeap.parentIdx(i)])
    ) {
      const parent = MinHeap.parentIdx(i);
      this.swap(parent, i);
      i = parent;
    }
  }

  /**
   * Returns the peek of the heap (element with the minimum weight)
   * without deleting it from the heap
   *
   * @returns peek of the heap
   */
  public peek(): number {
    if (this.currentSize === 0) {
      throw new Error("Heap underflow");
    }
    return this.heap[0];
  }

  /**
   * Returns the peek of the heap (element with the minimum weight)
   * by poping it of the heap. This will remove the element from the heap
   * and re-order the heap such that heap properties are not violated.
   *
   * @returns peek of the heap
   */
  public pop(): number {
    if (this.currentSize === 0) {
      throw new Error("Heap underflow");
    }
    const min = this.heap[0];
    this.swap(0, this.currentSize - 1);
    this.currentSize--;
    this.heapify(0);
    return min;
  }

  /**
   * Internal function for re-ordering the heap
   * in order to restore the heap properties.
   * This function is recursive. To properly reorder
   * the heap it must be called with idx=0
   *
   * @param idx index from where to start the reordering
   */
  private heapify(idx: number): void {
    const left = MinHeap.leftIdx(idx);
    const right = MinHeap.rightIdx(idx);
    let min = idx;
    if (
      left < this.currentSize &&
      this.weighting(this.heap[left]) < this.weighting(this.heap[min])
    ) {
      min = left;
    }
    if (
      right < this.currentSize &&
      this.weighting(this.heap[right]) < this.weighting(this.heap[min])
    ) {
      min = right;
    }
    if (min !== idx) {
      this.swap(min, idx);
      this.heapify(min);
    }
  }

  /**
   * Getter for the current heap size
   * @returns current size
   */
  public size(): number {
    return this.currentSize;
  }

  /**
   * Debug function for testing if the
   * heap properties holds. Will throw an error
   * if it does not hold.
   */
  public validate() {
    this.validateIdx(0);
  }

  /**
   * Internal debug function for validating the heap
   * property starting from a specific index. Will throw
   * an error if it does not hold. If the whole heap needs
   * to be validated, call this function with idx=0
   *
   * @param idx index from where to start the validation
   */
  private validateIdx(idx: number) {
    if (idx >= this.currentSize) return;
    const left = MinHeap.leftIdx(idx);
    const right = MinHeap.rightIdx(idx);

    if (
      left < this.currentSize &&
      this.weighting(this.heap[left]) < this.weighting(this.heap[idx])
    ) {
      throw new Error("Internal error: Heap-Property does not hold");
    }
    if (
      right < this.currentSize &&
      this.weighting(this.heap[right]) < this.weighting(this.heap[idx])
    ) {
      throw new Error("Internal error: Heap-Property does not hold");
    }

    this.validateIdx(left);
    this.validateIdx(right);
  }

  /**
   * Internal function for swapping two elements
   * by specifying there index in the heap
   *
   * @param i first index
   * @param j second index
   */
  private swap(i: number, j: number) {
    this.mapping[this.heap[i]] = j;
    this.mapping[this.heap[j]] = i;

    const buffer = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = buffer;
  }

  /**
   * Internal function for calculating the parent
   * of an element
   *
   * @param idx index of the element
   * @returns index of the element's parent
   */
  private static parentIdx(idx: number): number {
    return Math.floor(idx / 2);
  }

  /**
   * Internal function for calculating the left child
   * of an element
   *
   * @param idx index of the element
   * @returns index of the element's left child
   */
  private static leftIdx(idx: number): number {
    return idx * 2 + 1;
  }

  /**
   * Internal function for calculating the right child
   * of an element
   *
   * @param idx index of the element
   * @returns index of the element's right child
   */
  private static rightIdx(idx: number): number {
    return idx * 2 + 2;
  }
}
