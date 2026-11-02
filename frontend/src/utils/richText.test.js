import { describe, expect, it } from 'vitest';
import { parseBlocks, parseInline, toPlainText } from './richText.js';

describe('parseBlocks', () => {
  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    expect(parseBlocks('First line\ncontinues here.\n\nSecond paragraph.')).toEqual([
      { type: 'p', text: 'First line continues here.' },
      { type: 'p', text: 'Second paragraph.' },
    ]);
  });

  it('groups bullet and numbered lines into lists', () => {
    expect(parseBlocks('Rules:\n1. In 3NF\n2. Determinant is a key\n- note a\n* note b')).toEqual([
      { type: 'p', text: 'Rules:' },
      { type: 'ol', items: ['In 3NF', 'Determinant is a key'] },
      { type: 'ul', items: ['note a', 'note b'] },
    ]);
  });

  it('turns a stray heading into a bold line', () => {
    expect(parseBlocks('## Summary\nText')).toEqual([{ type: 'p', text: '**Summary**' }, { type: 'p', text: 'Text' }]);
  });

  it('copes with empty input', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks(undefined)).toEqual([]);
  });
});

describe('parseInline', () => {
  it('finds bold, code and citations', () => {
    expect(parseInline('A **super key** like `emp_id` decides it [2].')).toEqual([
      { type: 'text', value: 'A ' },
      { type: 'bold', value: 'super key' },
      { type: 'text', value: ' like ' },
      { type: 'code', value: 'emp_id' },
      { type: 'text', value: ' decides it ' },
      { type: 'cite', number: 2 },
      { type: 'text', value: '.' },
    ]);
  });

  it('treats markup-looking text as plain text, never as HTML', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }]);
  });

  it('leaves unclosed bold markers as text', () => {
    expect(parseInline('a **b')).toEqual([{ type: 'text', value: 'a **b' }]);
  });
});

describe('toPlainText', () => {
  it('removes citation numbers and bold markers for notes', () => {
    expect(toPlainText('**BCNF** is stricter [1][2]. Keys matter [3].')).toBe('BCNF is stricter. Keys matter.');
  });
});
