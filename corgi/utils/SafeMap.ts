/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains an implementation of a "safe" map where
 * instead of returning `undefined`, the `Maybe` type is
 * used. This eases the handling of undefined keys by exploiting
 * the functions provided by `Maybe`
 */
import { Maybe } from "./Maybe";

/**
 * Class implementing a map where the values associated
 * to the keys are wrapped in the `Maybe` construct
 * to represent whether the key is defined or not
 */
export class SafeMap<K, V> {
  private readonly internal: Map<K, V>;

  /**
   * Constructor
   *
   * @param init array of key-value-tuples representing the initial
   *             assignment of the map (opt).
   */
  public constructor(init: [K, V][] = []) {
    this.internal = new Map(init);
  }

  /**
   * Static generator-function for generating a `SafeMap`
   * based on an ordinary map. This will copy over all the values
   * of the map.
   *
   * @param map map based on which the `SafeMap` should be created
   * @returns instance of `SafeMap` containing the same key-value
   *          definitions as specified by the passed map
   *
   * @remark As the values are copied-over, changes of the passed map
   *         after calling this function will NOT effect the returned instance
   *         of `SafeMap`. However, if the values of the map are reference-types
   *         (i.e. Objects or Arrays), changes of the value itself will also effect
   *         the value stored in the created instance of `SafeMap`.
   */
  public static from<K, V>(map: Map<K, V>): SafeMap<K, V> {
    return new SafeMap(Array.from(map.entries()));
  }

  /**
   * Deletes all the values of the map
   */
  public clear(): void {
    this.internal.clear();
  }

  /**
   * Deletes a specified key. Will not change anything if
   * the key is undefined.
   *
   * @param key key to delete
   */
  public delete(key: K): void {
    this.internal.delete(key);
  }

  /**
   * Getter for the stored key-value pairs.
   *
   * @returns an ```Iterable``` of all key-values-pairs
   * stores in the map
   */
  public entries(): Iterable<[K, V]> {
    return this.internal.entries();
  }

  /**
   * Executes a function for each key-value pair stored
   * in the map
   *
   * @param callback function that should be executed
   * @param thisArg value to use as `this` when executing
   *                the callback
   */
  public forEach(callback: (v: V, k: K) => void, thisArg?: unknown) {
    this.internal.forEach(callback, thisArg);
  }

  /**
   * Get the value associated to a specified key. In case the
   * the key is undefined, `Maybe.Nothing` will be returned.
   *
   * @param key key to query
   *
   * @returns the value wrapped in the `Maybe` construct; if
   *          the key is undefined `Maybe.Nothing()` will be
   *          returned.
   */
  public get(key: K): Maybe<V> {
    if (!this.internal.has(key)) return Maybe.Nothing();
    return Maybe.of(this.internal.get(key) as V);
  }

  /**
   * Get the value associated to a specific key by asserting
   * that it is defined. In case it is undefined, an error will
   * be thrown.
   *
   * @param key key to query
   * @returns the value associated to the key
   */
  public assertExist(key: K): V {
    return this.get(key).assertPresent();
  }

  /**
   * Query wether or not a specified key is defined in the map.
   *
   * @param key key to query
   * @returns `true` if the key is defined and `false` otherwise.
   */
  public has(key: K): boolean {
    return this.internal.has(key);
  }

  /**
   * Getter for all the keys stored in the map
   *
   * @returns an `Iterable` of all keys stored in the map
   */
  public keys(): Iterable<K> {
    return this.internal.keys();
  }

  /**
   * (Re)set the value of a specified key. If the key was
   * defined previously, the associated value will be overwritten
   * with the newly specified value.
   *
   * @param key key to set
   * @param value value to set
   */
  public set(key: K, value: V): void {
    this.internal.set(key, value);
  }

  /**
   * Getter for the map's size
   *
   * @returns the number of keys defined in the map
   */
  public size(): number {
    return this.internal.size;
  }

  /**
   * Getter for all the values stored in the map.
   *
   * @returns an `Iterable` of all the values stored in the map
   */
  public values(): Iterable<V> {
    return this.internal.values();
  }
}
