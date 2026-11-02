import { describe, expect, it } from 'vitest';
import { featureDefinitions, quizFeature } from './features.js';

const context = { topicName: 'Normalization', subjectName: 'Databases', examName: 'DBMS Finals', topicDifficulty: 'MEDIUM' };

describe('feature prompts', () => {
  it.each([
    ['FLASHCARDS', ['"cards"', '"question"', '"answer"']],
    ['QUIZ', ['"questions"', '"options"', '"correctIndex"', '"explanation"', '"shortQuestions"', '"longQuestions"', '"answer"']],
    ['MINDMAP', ['"label"', '"children"']],
  ])('%s tells the model the exact JSON keys it must return', (type, keys) => {
    const text = featureDefinitions[type].buildPrompt(context);
    for (const key of keys) expect(text).toContain(key);
  });

  const mcq = (index) => ({ question: `Question ${index + 1}?`, options: ['A', 'B', 'C', 'D'], correctIndex: index % 4, explanation: 'Because.' });
  const written = (label, index) => ({ question: `${label} question ${index + 1}?`, answer: `Model answer for ${label} ${index + 1}.` });
  const quizWith = ({ mcqs = 10, short = 5, long = 5 } = {}) => ({
    questions: Array.from({ length: mcqs }, (_, i) => mcq(i)),
    shortQuestions: Array.from({ length: short }, (_, i) => written('Two-mark', i)),
    longQuestions: Array.from({ length: long }, (_, i) => written('Five-mark', i)),
  });

  it('accepts a quiz in the structure the prompt asks for: 10 MCQs, 5 two-mark and 5 five-mark questions', () => {
    expect(featureDefinitions.QUIZ.schema.safeParse(quizWith()).success).toBe(true);
  });

  it('rejects a quiz that does not have exactly 10 questions', () => {
    expect(featureDefinitions.QUIZ.schema.safeParse(quizWith({ mcqs: 9 })).success).toBe(false);
    expect(featureDefinitions.QUIZ.schema.safeParse(quizWith({ mcqs: 11 })).success).toBe(false);
  });

  it('needs exactly 5 two-mark and 5 five-mark questions, each with a model answer', () => {
    expect(featureDefinitions.QUIZ.schema.safeParse(quizWith({ short: 4 })).success).toBe(false);
    expect(featureDefinitions.QUIZ.schema.safeParse(quizWith({ long: 6 })).success).toBe(false);
    const missingAnswer = quizWith();
    delete missingAnswer.longQuestions[0].answer;
    expect(featureDefinitions.QUIZ.schema.safeParse(missingAnswer).success).toBe(false);
  });

  it('rejects the same question appearing twice across sections', () => {
    const quiz = quizWith();
    quiz.longQuestions[0].question = quiz.shortQuestions[0].question;
    expect(featureDefinitions.QUIZ.schema.safeParse(quiz).success).toBe(false);
  });

  it.each([
    ['mcq', { questions: 10 }, '10 multiple-choice questions', ['shortQuestions', 'longQuestions']],
    ['short', { shortQuestions: 5 }, '5 two-mark questions', ['questions', 'longQuestions']],
    ['long', { longQuestions: 5 }, '5 five-mark questions', ['questions', 'shortQuestions']],
  ])('a "%s" quiz asks for and accepts only that section', (type, sections, asked, absent) => {
    const feature = quizFeature(type);
    const text = feature.buildPrompt({ topicName: 'Normalization', subjectName: 'Databases', topicDifficulty: 'AVERAGE' });
    expect(text).toContain(asked);
    for (const key of absent) expect(text).not.toContain(`"${key}"`);

    const quiz = {};
    if (sections.questions) quiz.questions = Array.from({ length: 10 }, (_, i) => mcq(i));
    if (sections.shortQuestions) quiz.shortQuestions = Array.from({ length: 5 }, (_, i) => written('Two-mark', i));
    if (sections.longQuestions) quiz.longQuestions = Array.from({ length: 5 }, (_, i) => written('Five-mark', i));
    expect(feature.schema.safeParse(quiz).success).toBe(true);
  });

  it('falls back to the full quiz for an unknown type', () => {
    expect(quizFeature('nonsense').promptVersion).toBe(quizFeature('all').promptVersion);
  });

  it('asks for all three sections in a single request', () => {
    const text = featureDefinitions.QUIZ.buildPrompt({ topicName: 'Normalization', subjectName: 'Databases', topicDifficulty: 'AVERAGE' });
    expect(text).toContain('10 multiple-choice questions, 5 two-mark questions and 5 five-mark questions');
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
