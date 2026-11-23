// Polish version of the corpus. Same ids, numbers and facts as ../documents.ts.
import type { CompanyDocument, FolderInfo } from '../documents'
import { SALES } from './sales'
import { HR } from './hr'
import { PRODUCTS } from './products'
import { SUPPORT } from './support'
import { FINANCE } from './finance'
import { PL_QUESTIONS } from './questions'

export const PL_FOLDERS: FolderInfo[] = [
  { id: 'sales', name: 'Sprzedaż', description: 'Cennik, zasady rabatowania, podręcznik sprzedaży i podział klientów na segmenty.' },
  { id: 'hr', name: 'Kadry', description: 'Zasady dla pracowników: praca zdalna, świadczenia, wdrożenie i urlopy.' },
  { id: 'products', name: 'Produkty', description: 'Co sprzedaje Northstar, plany rozwoju, specyfikacja techniczna i API.' },
  { id: 'support', name: 'Obsługa klienta', description: 'Zwroty, poziomy usług, rozwiązywanie problemów i eskalacja zgłoszeń.' },
  { id: 'finance', name: 'Finanse', description: 'Wydatki, budżety podróży, faktury i zasady zakupów.' },
]

export const PL_DOCUMENTS: CompanyDocument[] = [...SALES, ...HR, ...PRODUCTS, ...SUPPORT, ...FINANCE]
export { PL_QUESTIONS }
