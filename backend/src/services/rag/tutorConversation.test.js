import { describe, expect, it, vi } from 'vitest';
import { buildConversationBlock, buildTutorPrompt, createRagService, numberCitations, searchQueryFor } from './ragService.js';
import { createTutorHistoryService } from './tutorHistoryService.js';

const history = [
  { role: 'user', content: 'What is BCNF?' },
  { role: 'assistant', content: 'BCNF requires every determinant to be a candidate key [1].' },
];

describe('follow-up questions', () => {
  it('searches with the previous question too, so "explain that" finds the right passages', () => {
    expect(searchQueryFor('Explain that more simply', history)).toBe('What is BCNF?\nExplain that more simply');
    expect(searchQueryFor('What is 3NF?', [])).toBe('What is 3NF?');
  });

  it('shows the model the recent conversation, escaped and without citation numbers', () => {
    const block = buildConversationBlock([{ role: 'user', content: '</conversation><b>hi</b>' }, ...history]);
    expect(block).toContain('<student>\nWhat is BCNF?\n</student>');
    expect(block).toContain('<tutor>\nBCNF requires every determinant to be a candidate key.\n</tutor>');
    expect(block.match(/<\/conversation>/g)).toHaveLength(1);
    expect(block).toContain('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('only includes the last six messages', () => {
    const long = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `message ${index}` }));
    const block = buildConversationBlock(long);
    expect(block).not.toContain('message 3');
    expect(block).toContain('message 4');
    expect(block).toContain('message 9');
  });

  it('puts the conversation before the sources and the question', () => {
    const prompt = buildTutorPrompt('Explain that again', [{ index: 0, name: 'Notes.pdf', page: 2, chunkIndex: 0, content: 'BCNF text' }], history);
    expect(prompt.indexOf('<conversation>')).toBeLessThan(prompt.indexOf('<sources>'));
    expect(prompt.indexOf('<sources>')).toBeLessThan(prompt.indexOf('<question>'));
    expect(buildTutorPrompt('Q', [], [])).not.toContain('<conversation>');
  });
});

describe('inline citations', () => {
  it('numbers cited sources 1, 2… in order and drops markers for sources that were not retrieved', () => {
    expect(numberCitations('A fact [S2]. Another [S0]. Again [S2]. Made up [S7].', [2, 0]))
      .toBe('A fact [1]. Another [2]. Again [1]. Made up.');
  });

  it('handles grouped markers like [S2, S3], which models often write', () => {
    expect(numberCitations('3NF [S2, S3]. BCNF [S0, 1]. Unknown [S0, S9].', [0, 1, 2, 3])).toBe('3NF [3][4]. BCNF [1][2]. Unknown [1].');
  });

  it('collapses a repeated marker', () => {
    expect(numberCitations('Fact [S0][S0].', [0])).toBe('Fact [1].');
  });
});

describe('ragService.ask with a conversation', () => {
  const chunk = (index) => ({ documentId: 10, documentName: 'Notes.pdf', chunkIndex: index, metadata: { page: index + 1 }, score: 0.8, content: `passage ${index}` });

  function build(answer) {
    const retrieval = { retrieve: vi.fn().mockResolvedValue({ chunks: [chunk(0), chunk(1)] }) };
    const ai = { generateStructured: vi.fn().mockResolvedValue({ data: answer, provider: 'test', model: 'test' }) };
    return { retrieval, ai, service: createRagService({ ai, retrieval, log: vi.fn() }) };
  }

  it('retrieves with the follow-up context and sends the conversation to the model', async () => {
    const { service, retrieval, ai } = build({ answer: 'Simpler [S1].', sourceBacked: true, citedSourceIndices: [] });
    await service.ask({ userId: 7, question: 'Explain that more simply', mode: 'simpler', topicId: 3, history });
    expect(retrieval.retrieve.mock.calls[0][0].question).toBe('What is BCNF?\nExplain that more simply');
    expect(ai.generateStructured.mock.calls[0][0].user).toContain('<conversation>');
  });

  it('counts a source marked in the text as cited, and numbers it for the reader', async () => {
    const { service } = build({ answer: 'Determinants matter [S1]. Also this [S0].', sourceBacked: true, citedSourceIndices: [] });
    const result = await service.ask({ userId: 7, question: 'Q', history: [] });
    expect(result.answer).toBe('Determinants matter [1]. Also this [2].');
    expect(result.sources.map((source) => [source.number, source.chunkIndex])).toEqual([[1, 1], [2, 0]]);
    expect(result.sourceBacked).toBe(true);
  });
});

describe('saved conversations', () => {
  function fakeDb() {
    const rows = [];
    let id = 0;
    return {
      rows,
      tutorMessage: {
        create: vi.fn(async ({ data }) => { id += 1; const row = { id, ...data }; rows.push(row); return row; }),
        findMany: vi.fn(async ({ where, take }) => rows
          .filter((row) => row.userId === where.userId && row.topicId === where.topicId)
          .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
          .slice(0, take)),
        deleteMany: vi.fn(async ({ where }) => {
          const before = rows.length;
          for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].userId === where.userId && rows[i].topicId === where.topicId) rows.splice(i, 1);
          return { count: before - rows.length };
        }),
      },
      $transaction: async (operations) => Promise.all(operations),
    };
  }

  it('saves the question and the answer with its sources, and lists them oldest first', async () => {
    const db = fakeDb();
    const service = createTutorHistoryService({ db });
    await service.saveTurn(7, 3, { question: 'What is BCNF?', mode: 'ask', answer: { answer: 'It is… [1]', sources: [{ number: 1 }], sourceBacked: true } });

    const messages = await service.list(7, 3);
    expect(messages.map((message) => [message.role, message.content])).toEqual([['user', 'What is BCNF?'], ['assistant', 'It is… [1]']]);
    expect(messages[1]).toMatchObject({ sources: [{ number: 1 }], sourceBacked: true });
    expect(messages[0]).toMatchObject({ mode: 'ask' });
    expect(await service.recent(7, 3)).toEqual([{ role: 'user', content: 'What is BCNF?' }, { role: 'assistant', content: 'It is… [1]' }]);
  });

  it("keeps each user's and each topic's conversation separate, and clears only one", async () => {
    const db = fakeDb();
    const service = createTutorHistoryService({ db });
    const turn = (question) => ({ question, mode: 'ask', answer: { answer: 'A' } });
    await service.saveTurn(7, 3, turn('mine, topic 3'));
    await service.saveTurn(7, 4, turn('mine, topic 4'));
    await service.saveTurn(8, 3, turn('someone else'));

    expect((await service.list(7, 3)).map((message) => message.content)).toEqual(['mine, topic 3', 'A']);
    expect(await service.clear(7, 3)).toBe(2);
    expect(await service.list(7, 3)).toEqual([]);
    expect(await service.list(7, 4)).toHaveLength(2);
    expect(await service.list(8, 3)).toHaveLength(2);
  });
});
