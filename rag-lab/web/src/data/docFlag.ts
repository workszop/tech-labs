import { getCorpus } from './corpus'

/**
 * Why to think twice about a document: superseded ('outdated'), newer but not approved ('draft'),
 * or holding personal data ('personal-data'). null = nothing to warn about.
 */
export type DocFlag = 'outdated' | 'draft' | 'personal-data' | null
export function docFlag(docId: string): DocFlag {
  const doc = getCorpus().docById[docId]
  if (!doc) return null
  if (doc.status === 'outdated' || doc.status === 'draft') return doc.status
  return (doc as { sensitive?: string }).sensitive === 'personal-data' ? 'personal-data' : null
}
