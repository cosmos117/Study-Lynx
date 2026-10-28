export function createMockProvider({ name = 'mock', model = 'mock-model', generate } = {}) {
  return {
    name,
    model,
    generate: generate || (async () => ({ text: '{}', model })),
  };
}
