// The most sources one AI generation accepts (the API rejects more).
export const MAX_SOURCES = 10;

/**
 * Chooses what flashcards, quizzes and mind maps are built from. A subject can hold more sources
 * than one generation accepts, so what was added for this topic takes priority over what is shared.
 */
export function pickSources(documents = [], videos = []) {
  const ready = documents.filter((document) => document.status === 'READY');
  const own = ready.filter((document) => !document.fromSubject).map((document) => document.id).slice(0, MAX_SOURCES);
  const resourceIds = videos.filter((video) => video.hasTranscript).map((video) => video.id).slice(0, MAX_SOURCES - own.length);
  const shared = ready.filter((document) => document.fromSubject).map((document) => document.id).slice(0, MAX_SOURCES - own.length - resourceIds.length);
  return { documentIds: [...own, ...shared], resourceIds };
}
