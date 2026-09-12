// Future home of embeddings + vector search (RAG). For the MVP we do a
// simple keyword-overlap retrieval over MaterialChunk rows so aiService
// always has *some* grounded context. Swap this implementation for real
// embeddings later; callers (aiController) do not need to change.
export const findRelevantChunks = (chunks, query, limit = 3) => {
  const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const scored = chunks.map((c) => {
    const words = c.content.toLowerCase().split(/\W+/);
    const score = words.reduce((acc, w) => acc + (queryWords.has(w) ? 1 : 0), 0);
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.c.content);
};
