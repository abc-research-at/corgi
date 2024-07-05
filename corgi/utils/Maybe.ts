/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains an implementation of the well known Maybe-
 * construct.
 */

/**
 * Maybe construct
 */
export abstract class Maybe<T> {
  /**
   * Generates a new Maybe-object by wrapping
   * a passed value inside the Just-construct
   *
   * @param value value to wrap
   * @returns value wrapped in the just-construct
   */
  public static of<T>(value: T): Just<T> {
    return new Just(value);
  }

  /**
   * Returns a new Nothing-construct
   * @remark the nothing-construct is typed too.
   *         this is different then to common implementations
   * @returns the Nothing-construct for a certain type
   */
  public static Nothing<T>() {
    return new Nothing<T>();
  }

  /**
   * Maps the Maybe-constructor using a specified function.
   * It will return Nothing of type T2 if the current object
   * is of type Nothing
   * @param map function to apply
   * @returns a new Maybe-object
   */
  public map<T2>(map: (t: T) => T2): Maybe<T2> {
    if (!this.isPresent()) return new Nothing<T2>();
    return new Just(map(this.val() as T));
  }

  /**
   * Returns the value of the construct by assuming
   * it is present. If it is not present, an error will
   * be thrown.
   *
   * @return value if present
   * @throws error if value is not present
   */
  public assertPresent(): T {
    if (!this.isPresent()) {
      throw new Error("Assertion Error: Value is not present");
    }
    return this.val() as T;
  }

  /**
   * Executes a passed function in case the value is
   * present
   *
   * @param exec function to execute
   */
  public ifPresent(exec: (val: T) => void) {
    if (this.isPresent()) {
      exec(this.assertPresent());
    }
  }

  /**
   * Executes a passed function in case the value is
   * not present
   *
   * @param exec function to execute
   */
  public ifNotPresent(exec: () => void) {
    if (!this.isPresent()) {
      exec();
    }
  }

  /**
   * Returns the value if present or else the specified value.
   *
   * @param def value to return if not present
   * @returns value or default
   */
  public valOrElse(def: T): T {
    if (!this.isPresent()) {
      return def;
    }
    return this.assertPresent();
  }

  /**
   * Indicates whether or the object is present.
   * @remark if isPresent is false, val has to return false
   * @returns flag indicating if the value is present
   */
  public abstract isPresent(): this is Just<T>;

  /**
   * Internal function returning the value of the object
   * if present. Will be implemented by the specific Maybe-types
   * Just and Nothing
   *
   * @returns value or null (if not present)
   */
  protected abstract val(): T | null;
}

/**
 * Class representing the Just-Construct
 */
class Just<T> extends Maybe<T> {
  /**
   * Constructor
   *
   * @param value value to wrap
   */
  public constructor(private readonly value: T) {
    super();
  }

  /**
   * Getter for the value
   * @returns the wrapped value
   */
  public override val(): T {
    return this.value;
  }

  /**
   * Indicates if the value is present
   * @returns true
   */
  public override isPresent(): boolean {
    return true;
  }
}

/**
 * Class representing the Nothing construct
 */
class Nothing<T> extends Maybe<T> {
  /**
   * Getter for the value
   * @returns null
   */
  protected override val(): T | null {
    return null;
  }

  /**
   * Indicates if the value is present
   * @returns false
   */
  public override isPresent(): boolean {
    return false;
  }
}
