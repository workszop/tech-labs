// Per-language document corpus. Document and folder ids are identical in every
// language; only titles, summaries and content differ.
import type { Lang } from '@shared/api-types'
import { useStore, getState } from '@/state/store'
import { DOCUMENTS as EN_DOCUMENTS, FOLDERS as EN_FOLDERS, SUGGESTED_QUESTIONS as EN_QUESTIONS, type CompanyDocument, type FolderInfo } from './documents'
import { PL_DOCUMENTS, PL_FOLDERS, PL_QUESTIONS } from './pl'

export interface Corpus {
  lang: Lang
  documents: CompanyDocument[]
  folders: FolderInfo[]
  suggestedQuestions: { question: string; hint: string }[]
  docById: Record<string, CompanyDocument>
}

function make(lang: Lang, documents: CompanyDocument[], folders: FolderInfo[], suggestedQuestions: Corpus['suggestedQuestions']): Corpus {
  return { lang, documents, folders, suggestedQuestions, docById: Object.fromEntries(documents.map((d) => [d.id, d])) }
}

const CORPORA: Record<Lang, Corpus> = {
  en: make('en', EN_DOCUMENTS, EN_FOLDERS, EN_QUESTIONS),
  pl: make('pl', PL_DOCUMENTS, PL_FOLDERS, PL_QUESTIONS),
}

export function getCorpus(lang: Lang = getState().settings.lang): Corpus {
  return CORPORA[lang]
}
/** Corpus for the current language; re-renders when the language changes. */
export function useCorpus(): Corpus {
  return CORPORA[useStore((s) => s.settings.lang)]
}
