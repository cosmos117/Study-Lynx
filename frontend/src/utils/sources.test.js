import { describe, expect, it } from 'vitest';
import { MAX_SOURCES, pickSources } from './sources.js';

const documents = (count, start, extra = {}) => Array.from({ length: count }, (_, index) => ({ id: start + index, status: 'READY', ...extra }));

describe('pickSources', () => {
  it('uses ready documents, shared ones included, and videos with a transcript', () => {
    const result = pickSources(
      [{ id: 1, status: 'READY' }, { id: 2, status: 'PROCESSING' }, { id: 3, status: 'FAILED' }, { id: 4, status: 'READY', fromSubject: true }],
      [{ id: 7, hasTranscript: true }, { id: 8, hasTranscript: false }],
    );
    expect(result).toEqual({ documentIds: [1, 4], resourceIds: [7] });
  });

  it('never exceeds the limit, and fills it with the topic\'s own sources first', () => {
    const result = pickSources(
      [...documents(8, 100, { fromSubject: true }), ...documents(7, 1)],
      [{ id: 50, hasTranscript: true }, { id: 51, hasTranscript: true }],
    );
    expect(result.documentIds).toEqual([1, 2, 3, 4, 5, 6, 7, 100]);
    expect(result.resourceIds).toEqual([50, 51]);
    expect(result.documentIds.length + result.resourceIds.length).toBe(MAX_SOURCES);
  });

  it('copes with a topic that has nothing yet', () => {
    expect(pickSources()).toEqual({ documentIds: [], resourceIds: [] });
  });
});
