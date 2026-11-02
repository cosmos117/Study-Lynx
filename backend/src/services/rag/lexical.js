// Keyword matching for retrieval. Embeddings capture meaning; this catches exact terms such as
// acronyms, formulas and names ("BCNF", "3NF", "Codd"), and keeps search working when the
// embedding provider is unavailable.

const STOPWORDS = new Set((
  'a an and are as at be but by for from has have how if in into is it its of on or that the their there '
  + 'these they this to was were what when where which who why will with you your do does did can could should would '
  + 'explain tell me give about describe define please'
).split(' '));

/** Lower-cased content words, with simple plurals folded so "keys" matches "key". */
export function terms(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .map((token) => (token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token));
}

/**
 * Share of the question's distinct terms that appear in the passage (0 to 1), weighting rarer
 * terms more: a term found in few passages says more than one found in all of them.
 * `documentFrequency` maps a term to how many candidate passages contain it.
 */
export function keywordScore(queryTerms, passageTerms, documentFrequency = new Map(), passageCount = 1) {
  const unique = [...new Set(queryTerms)];
  if (!unique.length) return 0;
  const present = new Set(passageTerms);
  const weight = (term) => Math.log(1 + (passageCount + 1) / ((documentFrequency.get(term) || 0) + 1));
  const total = unique.reduce((sum, term) => sum + weight(term), 0);
  const found = unique.filter((term) => present.has(term)).reduce((sum, term) => sum + weight(term), 0);
  return total ? found / total : 0;
}

/** How many of the given passages contain each term. */
export function documentFrequencies(passages) {
  const counts = new Map();
  for (const passageTerms of passages) {
    for (const term of new Set(passageTerms)) counts.set(term, (counts.get(term) || 0) + 1);
  }
  return counts;
}
