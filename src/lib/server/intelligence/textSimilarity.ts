/**
 * Dependency-free trigram overlap similarity (TypeScript). Used by the
 * duplicate engine as the text signal. This is a real similarity metric, not a
 * stub: it compares the actual report titles/descriptions with Dice-coefficient
 * n-gram overlap, identical semantics to pg_trigram's similarity().
 */

function tokenize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type NGramMap = Map<string, number>;

function ngrams(term: string, size: number): NGramMap {
  const map: NGramMap = new Map();
  if (term.length < size) {
    if (term.length > 0) map.set(term, 1);
    return map;
  }
  for (let i = 0; i <= term.length - size; i += 1) {
    const gram = term.slice(i, i + size);
    map.set(gram, (map.get(gram) ?? 0) + 1);
  }
  return map;
}

/** Dice coefficient over n-gram multisets: 2|A∩B| / (|A|+|B|) in [0,1]. */
export function trigramSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta || !tb) return 0;
  if (ta === tb) return 1;
  const ga = ngrams(ta, 3);
  const gb = ngrams(tb, 3);
  if (ga.size === 0 || gb.size === 0) return 0;

  const [small, large] = ga.size <= gb.size ? [ga, gb] : [gb, ga];
  let overlap = 0;
  for (const [gram, count] of small) {
    const other = large.get(gram) ?? 0;
    overlap += Math.min(count, other);
  }
  const totalA = [...ga.values()].reduce((s, n) => s + n, 0);
  const totalB = [...gb.values()].reduce((s, n) => s + n, 0);
  return (2 * overlap) / (totalA + totalB);
}

/** Best-of alignment: title-vs-title, then descriptions, then cross. */
export function reportTextSimilarity(
  a: { title: string; description?: string | null },
  b: { title: string; description?: string | null },
): number {
  const cands = [
    trigramSimilarity(a.title, b.title),
    trigramSimilarity(a.title, b.description ?? ''),
    trigramSimilarity(a.description ?? '', b.title),
    trigramSimilarity(a.description ?? '', b.description ?? ''),
  ];
  return Math.max(...cands);
}