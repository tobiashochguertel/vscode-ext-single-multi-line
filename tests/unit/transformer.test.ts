import { describe, it, expect } from 'vitest';
import { toSingleLine, toMultiLine, toggleLineLayout, compactBlocks } from '../../src/transformer';

describe('transformer', () => {

  describe('toSingleLine', () => {
    it('should collapse multi-line text to single line', () => {
      const input = '{\n  "name": "foo"\n}';
      expect(toSingleLine(input)).toBe('{  "name": "foo"}');
    });

    it('should strip tabs', () => {
      const input = '{\n\t"name": "foo"\n}';
      expect(toSingleLine(input)).toBe('{"name": "foo"}');
    });
  });

  describe('toMultiLine', () => {
    it('should add line breaks at separators', () => {
      const input = '{ a: 1, b: 2 }';
      const result = toMultiLine(input, { isCommaOnNewLine: false });
      expect(result).toContain('\n');
    });

    it('should respect isCommaOnNewLine option', () => {
      const input = 'a, b, c';
      const result = toMultiLine(input, { isCommaOnNewLine: true });
      // Commas should be at the start of new lines
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('toggleLineLayout', () => {
    it('should convert multi-line to single-line', () => {
      const input = '{\n  "a": 1\n}';
      const result = toggleLineLayout(input, { isCommaOnNewLine: false });
      expect(result).not.toContain('\n');
    });

    it('should convert single-line to multi-line', () => {
      const input = '{ a: 1, b: 2 }';
      const result = toggleLineLayout(input, { isCommaOnNewLine: false });
      expect(result).toContain('\n');
    });

    it('should return empty text unchanged', () => {
      expect(toggleLineLayout('', { isCommaOnNewLine: false })).toBe('');
      expect(toggleLineLayout('   ', { isCommaOnNewLine: false })).toBe('   ');
    });
  });

  describe('compactBlocks', () => {
    it('should compact multiple multiline objects into one-per-line', () => {
      const input = [
        '            {',
        '                "name": "content",',
        '                "regexp": "*"',
        '            },',
        '            {',
        '                "name": "filename",',
        '                "regexp": "*"',
        '            },',
      ].join('\n');

      const result = compactBlocks(input);
      const lines = result.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('{ "name": "content", "regexp": "*" },');
      expect(lines[1]).toContain('{ "name": "filename", "regexp": "*" },');
    });

    it('should preserve indentation from the first block', () => {
      const input = [
        '    {',
        '        "a": 1',
        '    },',
        '    {',
        '        "b": 2',
        '    },',
      ].join('\n');

      const result = compactBlocks(input);
      const lines = result.split('\n');
      expect(lines[0]).toMatch(/^    \{/);
      expect(lines[1]).toMatch(/^    \{/);
    });

    it('should handle a single block', () => {
      const input = '{\n  "name": "foo",\n  "value": 1\n}';
      const result = compactBlocks(input);
      expect(result).not.toContain('\n');
      expect(result).toContain('{ "name": "foo", "value": 1 }');
    });

    it('should fall back to single-line when no blocks found', () => {
      const input = 'just\nsome\ntext';
      const result = compactBlocks(input);
      expect(result).not.toContain('\n');
    });

    it('should handle nested objects', () => {
      const input = [
        '{',
        '  "a": {',
        '    "b": 1',
        '  }',
        '}',
      ].join('\n');

      const result = compactBlocks(input);
      // Should compact the top-level block (including nested)
      expect(result).toContain('{ "a": { "b": 1 } }');
    });

    it('should handle the large real-world example', () => {
      const input = [
        '            {',
        '                "name": "format_type",',
        '                "regexp": "*"',
        '            },',
        '            {',
        '                "name": "hint",',
        '                "regexp": "*"',
        '            },',
        '            {',
        '                "name": "item_count",',
        '                "regexp": "\\\\d+"',
        '            },',
      ].join('\n');

      const result = compactBlocks(input);
      const lines = result.split('\n');

      expect(lines).toHaveLength(3);
      lines.forEach(line => {
        expect(line.trim()).toMatch(/^\{.*\},?$/);
      });
    });
  });

});
