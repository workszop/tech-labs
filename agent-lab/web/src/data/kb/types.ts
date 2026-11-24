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

/** One service document of the Northstar knowledge base (the same id and metadata in both languages). */
export interface KbDocument {
  id: string
  title: string
  authority: KnowledgeHit['authority']
  status: 'current' | 'superseded'
  supersededBy?: string
  /** Product model names exactly as in the product catalogue; [] = applies to all products. */
  appliesTo: string[]
  effectiveDate: string
  /** Markdown: `## Section` headings, paragraphs and lists. */
  body: string
}

/** Language-independent part of a document, kept once in `data/kb/index.ts`. */
export type KbDocumentMeta = Omit<KbDocument, 'title' | 'body'>

/** Language-specific part of a document, written in `data/kb/en` and `data/kb/pl`. */
export type KbDocumentText = Pick<KbDocument, 'id' | 'title' | 'body'>
