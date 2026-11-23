export const PL_QUESTIONS: { question: string; hint: string }[] = [
  {
    question: 'Jakie są zasady zwrotów w firmie?',
    hint: 'Zasady zwrotów (support-refund-policy); streszcza je też Polityka cenowa.',
  },
  {
    question: 'Czy w firmie możliwa jest praca zdalna?',
    hint: 'Zasady pracy zdalnej v4.0 (hr-remote-work). Uwaga: nieaktualne zasady z 2022 r. (hr-remote-work-2022) dają sprzeczną, przestarzałą odpowiedź.',
  },
  {
    question: 'Jakie rabaty przysługują klientom Enterprise?',
    hint: 'Rabaty dla klientów Enterprise (sales-enterprise-discounts); limit 10% dla AE i górny pułap 35% podaje też Polityka cenowa (sales-pricing-policy).',
  },
  {
    question: 'Co gwarantuje umowa o poziomie usług (SLA)?',
    hint: 'Umowa o poziomie usług (SLA) (support-sla): gwarantowana dostępność, poziomy wsparcia i czasy reakcji.',
  },
  {
    question: 'Jak wygląda zwrot wydatków za podróże służbowe?',
    hint: 'Zwrot wydatków (finance-expense-reimbursement); wcześniejszą zgodę i te same limity opisuje Budżet podróży służbowych (finance-travel-budget).',
  },
  {
    question: 'Które produkty obsługują integracje przez API?',
    hint: 'Przewodnik integracji API (products-api-guide) i Przegląd produktów (products-overview): Beacon, Relay i Vault; Pulse tylko przez Relay lub CSV.',
  },
  {
    question: 'Ile wynosi dodatek na biuro domowe?',
    hint: 'Zasady pracy zdalnej v4.0 (hr-remote-work): 750 USD jednorazowo i 50 USD miesięcznie. Nieaktualne zasady z 2022 r. podają 300 USD i brak dodatku miesięcznego.',
  },
  {
    question: 'Ile dni urlopu mi przysługuje i jak złożyć wniosek?',
    hint: 'Zasady urlopowe (hr-leave-policy). Nie mylić z wnioskami o zwrot ani z eskalacją zgłoszeń.',
  },
  {
    question: 'Jaki limit na hotel ma handlowiec podczas wizyty u klienta w Nowym Jorku?',
    hint: 'Potrzebne są dwa dokumenty: Podręcznik sprzedaży (sales-playbook) mówi, że wizyty u klientów podlegają zasadom podróży służbowych pracowników; Budżet podróży służbowych (finance-travel-budget) podaje limit 350 USD dla miasta o wysokich kosztach.',
  },
  {
    question: 'Czy dostaniemy zwrot pieniędzy, jeśli Northstar nie dotrzyma gwarantowanej dostępności?',
    hint: 'Potrzebne są dwa dokumenty: Umowa o poziomie usług (SLA) (support-sla) podaje procenty kredytu na usługi, a Zasady zwrotów (support-refund-policy) mówią, że kredyt na usługi nie jest zwrotem pieniędzy.',
  },
  {
    question: 'Jaki jest limit zapytań do API w planie Professional?',
    hint: 'Przewodnik integracji API (products-api-guide): 300 zapytań na minutę. To nie to samo co limity rabatów w Sprzedaży.',
  },
  {
    question: 'Ile zarabia prezes?',
    hint: 'Żaden dokument nie zawiera odpowiedzi. Dobry system RAG powinien odpowiedzieć, że nie ma wystarczających informacji.',
  },
]
