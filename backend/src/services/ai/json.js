import { AiInvalidOutputError } from './errors.js';

export function stripJsonFences(text) {
  const value = String(text || '').trim();
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : value;
}

export function parseAndValidateJson(text, schema) {
  let parsed;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch (_error) {
    throw new AiInvalidOutputError('The AI provider returned malformed JSON');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'output'}: ${issue.message}`)
      .join('; ');
    throw new AiInvalidOutputError(`The AI provider returned invalid data: ${details}`);
  }

  return result.data;
}

