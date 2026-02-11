import { describe, it, expect } from 'vitest';
import { detectLayout, findSeparatorIndexes, findBalancedBlocks } from '../../src/parser';
import { TextLayout } from '../../src/types';

describe('parser', () => {

  describe('detectLayout', () => {
    it('should detect single-line text', () => {
      expect(detectLayout('{ "name": "foo" }')).toBe(TextLayout.SingleLine);
    });

    it('should detect multi-line text', () => {
      expect(detectLayout('{\n  "name": "foo"\n}')).toBe(TextLayout.MultiLine);
    });

    it('should detect multi-line with carriage return', () => {
      expect(detectLayout('{\r\n  "name": "foo"\r\n}')).toBe(TextLayout.MultiLine);
    });

    it('should treat whitespace-only as single-line', () => {
      expect(detectLayout('   ')).toBe(TextLayout.SingleLine);
    });
  });

  describe('findSeparatorIndexes', () => {
    it('should find comma separators', () => {
      const result = findSeparatorIndexes('"a", "b"');
      const commas = result.filter(s => s.isComma);
      expect(commas.length).toBe(1);
    });

    it('should not find separators inside quoted strings', () => {
      const result = findSeparatorIndexes('"a,b,c"');
      const commas = result.filter(s => s.isComma);
      expect(commas.length).toBe(0);
    });

    it('should find bracket separators', () => {
      const result = findSeparatorIndexes('{ a: 1 }');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findBalancedBlocks', () => {
    it('should find a single block', () => {
      const blocks = findBalancedBlocks('{ "name": "foo" }');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].start).toBe(0);
      expect(blocks[0].end).toBe(16);
    });

    it('should find multiple blocks', () => {
      const text = '{ "a": 1 }, { "b": 2 }';
      const blocks = findBalancedBlocks(text);
      expect(blocks).toHaveLength(2);
    });

    it('should handle nested blocks', () => {
      const text = '{ "a": { "b": 1 } }';
      const blocks = findBalancedBlocks(text);
      // Only the top-level block
      expect(blocks).toHaveLength(1);
      expect(blocks[0].start).toBe(0);
      expect(blocks[0].end).toBe(text.length - 1);
    });

    it('should ignore braces inside quoted strings', () => {
      const text = '"no { block }" { "real": true }';
      const blocks = findBalancedBlocks(text);
      expect(blocks).toHaveLength(1);
    });

    it('should return empty for text without blocks', () => {
      const blocks = findBalancedBlocks('just some text');
      expect(blocks).toHaveLength(0);
    });
  });

});
