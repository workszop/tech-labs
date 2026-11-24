/**
 * Result of a knowledge-base search. Declared here so the tools (Task 3) can use
 * it before the search module exists; `kb/search.ts` re-exports it.
 */
export interface KnowledgeHit {
  chunkId: string
  docId: string
  docTitle: string
  section: string
  text: string
  score: number
  authority: 'manual' | 'model_specific' | 'warranty_policy' | 'service_bulletin' | 'support_procedure'
  status: 'current' | 'superseded'
  supersededBy?: string
  appliesTo: string[]
  effectiveDate: string
}
