import { describe, expect, it } from 'vitest';
import { featureDefinitions } from './features.js';

const context = { topicName: 'Normalization', subjectName: 'Databases', examName: 'DBMS Finals', topicDifficulty: 'MEDIUM' };

describe('feature prompts', () => {
  it.each([
    ['NOTES', ['"title"', '"keyConcepts"', '"quickRevision"']],
    ['FLASHCARDS', ['"cards"', '"question"', '"answer"']],
    ['QUIZ', ['"questions"', '"options"', '"correctIndex"', '"explanation"']],
    ['MINDMAP', ['"label"', '"children"']],
  ])('%s tells the model the exact JSON keys it must return', (type, keys) => {
    const text = featureDefinitions[type].buildPrompt(context);
    for (const key of keys) expect(text).toContain(key);
  });

  it('accepts a quiz in the structure the prompt asks for', () => {
    const quiz = {
      questions: Array.from({ length: 10 }, (_, index) => ({
        question: `Question ${index + 1}?`,
        options: ['A', 'B', 'C', 'D'],
        correctIndex: index % 4,
        explanation: 'Because.',
      })),
    };
    expect(featureDefinitions.QUIZ.schema.safeParse(quiz).success).toBe(true);
  });

  it('rejects a quiz that does not have exactly 10 questions', () => {
    const question = (index) => ({ question: `Question ${index}?`, options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Because.' });
    expect(featureDefinitions.QUIZ.schema.safeParse({ questions: Array.from({ length: 9 }, (_, i) => question(i)) }).success).toBe(false);
    expect(featureDefinitions.QUIZ.schema.safeParse({ questions: Array.from({ length: 11 }, (_, i) => question(i)) }).success).toBe(false);
  });

  it('rejects a bare list of questions, which is what a model returns without a shape', () => {
    expect(featureDefinitions.QUIZ.schema.safeParse([{ id: 1, question: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }]).success).toBe(false);
  });
});

describe('mind map', () => {
  const schema = featureDefinitions.MINDMAP.schema;
  const branch = (label, points = 2) => ({
    label,
    note: `${label} in one sentence.`,
    children: Array.from({ length: points }, (_, index) => ({ label: `${label} point ${index + 1}`, note: 'A short fact.' })),
  });

  it('accepts a revision map with notes on branches and key points', () => {
    expect(schema.safeParse({ label: 'Normalization', children: [branch('1NF'), branch('2NF'), branch('3NF'), branch('BCNF')] }).success).toBe(true);
  });

  it('still accepts an older map without notes', () => {
    expect(schema.safeParse({ label: 'Normalization', children: [{ label: '1NF' }, { label: '2NF' }] }).success).toBe(true);
  });

  it('strips HTML from labels and notes', () => {
    const parsed = schema.parse({ label: '<b>Normalization</b>', children: [{ label: '1NF', note: '<i>Atomic</i> values' }] });
    expect(parsed.label).toBe('Normalization');
    expect(parsed.children[0].note).toBe('Atomic values');
  });

  it('rejects a map with no branches, an over-long note, or too many nodes', () => {
    expect(schema.safeParse({ label: 'Normalization' }).success).toBe(false);
    expect(schema.safeParse({ label: 'T', children: [{ label: 'B', note: 'x'.repeat(221) }] }).success).toBe(false);
    expect(schema.safeParse({ label: 'T', children: Array.from({ length: 9 }, (_, index) => branch(`B${index}`, 5)) }).success).toBe(false);
  });

  it('asks the model for a note on every branch and key point', () => {
    const text = featureDefinitions.MINDMAP.buildPrompt({ topicName: 'Normalization', subjectName: 'Databases', topicDifficulty: 'AVERAGE' });
    expect(text).toContain('"note"');
    expect(text).toContain('revision mind map');
  });
});
