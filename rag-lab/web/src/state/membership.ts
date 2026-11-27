/**
 * A ticked document belongs to the knowledge base. Ticking or unticking only changes the decision;
 * one build then brings the vector database in line: it adds, removes and re-splits.
 */
export interface BuildPlan {
  add: string[]
  remove: string[]
  resplit: string[]
}

/**
 * desired: ticked document ids. indexed: docId → docHash of what is in the database.
 * hashes: docId → current content hash. spaceChanged: fragment size, overlap, labels or model differ from the index.
 * add = ticked and not indexed, or indexed with a different hash. remove = indexed and not ticked.
 * resplit = ticked, indexed, same hash, and spaceChanged.
 */
export function planBuild(desired: string[], indexed: Record<string, string>, hashes: Record<string, string>, spaceChanged: boolean): BuildPlan {
  const ticked = new Set(desired)
  const add: string[] = []
  const resplit: string[] = []
  for (const id of ticked) {
    if (!(id in indexed) || indexed[id] !== hashes[id]) add.push(id)
    else if (spaceChanged) resplit.push(id)
  }
  const remove = Object.keys(indexed).filter((id) => !ticked.has(id))
  return { add, remove, resplit }
}

/** True when a build would change something. */
export function isStale(plan: BuildPlan): boolean {
  return plan.add.length > 0 || plan.remove.length > 0 || plan.resplit.length > 0
}

/**
 * Earlier versions cleared a document's tick once it was indexed. Under the membership rule an indexed
 * document is ticked, so the stored ticks are joined with what the database holds. The caller puts the
 * result in corpus order.
 */
export function migrateSelection(stored: string[], indexedIds: string[]): string[] {
  return [...new Set([...stored, ...indexedIds])]
}

/**
 * The ticks to start with. Prefs saved before ticks meant membership (no marker) are migrated once:
 * the indexed documents are ticked. After that the stored ticks are the truth, so an untick that was
 * not built yet survives a reload. Always in corpus order, without ids the corpus does not know.
 */
export function initialSelection(stored: string[], hasMarker: boolean, indexedIds: string[], corpusOrder: string[]): string[] {
  const ticked = new Set(hasMarker ? stored : migrateSelection(stored, indexedIds))
  return corpusOrder.filter((id) => ticked.has(id))
}
