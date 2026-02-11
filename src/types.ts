/**
 * Shared types and interfaces for the Single-line, Multi-line extension.
 *
 * Following the Interface Segregation Principle (ISP) and
 * Dependency Inversion Principle (DIP) — consumers depend on
 * abstractions, not concrete implementations.
 */

/** Options that control how text is transformed. */
export interface TransformOptions {
  /** Place commas at the start of the new line instead of end of old line. */
  isCommaOnNewLine: boolean;
}

/** A single separator location found during parsing. */
export interface SeparatorLocation {
  /** Character index in the string. */
  index: number;
  /** Whether this separator is a comma (affects comma-on-new-line logic). */
  isComma: boolean;
}

/** Result of detecting whether text is single-line or multi-line. */
export enum TextLayout {
  SingleLine = 'single-line',
  MultiLine = 'multi-line',
}

/** A balanced block (e.g. `{ ... }`) found in the text. */
export interface BalancedBlock {
  /** Start index (inclusive) of the opening bracket. */
  start: number;
  /** End index (inclusive) of the closing bracket. */
  end: number;
}
