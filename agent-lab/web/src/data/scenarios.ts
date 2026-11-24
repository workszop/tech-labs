import type { ToolName } from '@shared/tools'
import type { Localized } from './company/types'

export interface Scenario {
  id: string
  customerId: string
  title: Localized
  message: Localized
  teaches: Localized
  expectTools: ToolName[]
}

/** Nine predefined requests (R23). Each customer's records make the request answerable. */
export const SCENARIOS: Scenario[] = [
  {
    id: 'product-failure-e04',
    customerId: 'CUST-1042',
    title: { en: 'Coffee machine shows E04', pl: 'Ekspres pokazuje błąd E04' },
    message: {
      en: 'Hi, my Barista Pro 500 shows error E04 and will not brew coffee. What should I do, and is this covered?',
      pl: 'Dzień dobry, mój ekspres Barista Pro 500 pokazuje błąd E04 i nie parzy kawy. Co mam zrobić i czy obejmuje to gwarancja?',
    },
    teaches: {
      en: 'The agent combines several systems: the order gives the serial number, the warranty system the coverage, the knowledge base the safe steps for E04.',
      pl: 'Agent łączy kilka systemów: z zamówienia bierze numer seryjny, z systemu gwarancji zakres ochrony, a z bazy wiedzy bezpieczne kroki dla E04.',
    },
    expectTools: ['get_customer_orders', 'check_warranty', 'search_service_knowledge'],
  },
  {
    id: 'delayed-shipment',
    customerId: 'CUST-1017',
    title: { en: 'Where is my replacement part?', pl: 'Gdzie jest moja część zamienna?' },
    message: {
      en: 'You promised to send me a new brush motor for my robot vacuum and said it would arrive on 14 November. It still has not come. Where is it?',
      pl: 'Obiecaliście wysłać mi nowy silnik szczotki do robota sprzątającego i miał dotrzeć 14 listopada. Nadal go nie ma. Gdzie jest?',
    },
    teaches: {
      en: 'The agent finds the shipment without being given its ID, reads the tracking events and explains the delay and the new estimate honestly.',
      pl: 'Agent sam znajduje przesyłkę bez podanego numeru, czyta zdarzenia śledzenia i uczciwie wyjaśnia opóźnienie oraz nowy termin.',
    },
    expectTools: ['get_shipments', 'track_shipment'],
  },
  {
    id: 'warranty-question',
    customerId: 'CUST-1008',
    title: { en: 'Is my vacuum still under warranty?', pl: 'Czy odkurzacz jest jeszcze na gwarancji?' },
    message: {
      en: 'The battery of my AeroClean V10 now lasts only a few minutes. Is the vacuum still under warranty?',
      pl: 'Akumulator w moim AeroClean V10 wystarcza teraz tylko na kilka minut. Czy odkurzacz jest jeszcze na gwarancji?',
    },
    teaches: {
      en: 'The answer depends on today\'s date: the warranty is still active but ends in a few days, so the agent should say so and suggest acting now.',
      pl: 'Odpowiedź zależy od dzisiejszej daty: gwarancja jeszcze trwa, ale kończy się za kilka dni, więc agent powinien to powiedzieć i zachęcić do szybkiego działania.',
    },
    expectTools: ['get_customer_orders', 'check_warranty'],
  },
  {
    id: 'repeated-failure',
    customerId: 'CUST-1029',
    title: { en: 'The same fault for the third time', pl: 'Ta sama usterka po raz trzeci' },
    message: {
      en: 'My Barista Compact 200 is leaking again and shows E07. This is the third time! I want this solved for good.',
      pl: 'Mój Barista Compact 200 znowu cieknie i pokazuje E07. To już trzeci raz! Chcę, żeby to wreszcie zostało rozwiązane.',
    },
    teaches: {
      en: 'The CRM history shows two earlier repairs of the same fault; the agent should notice the pattern and escalate instead of repeating basic troubleshooting.',
      pl: 'Historia w CRM pokazuje dwie wcześniejsze naprawy tej samej usterki; agent powinien dostrzec ten wzorzec i przekazać sprawę dalej zamiast powtarzać podstawowe kroki.',
    },
    expectTools: ['get_crm_history', 'get_service_case', 'check_warranty', 'create_service_ticket'],
  },
  {
    id: 'troubleshooting-s2',
    customerId: 'CUST-1033',
    title: { en: 'Air purifier shows S2', pl: 'Oczyszczacz pokazuje S2' },
    message: {
      en: 'My PureAir 300 shows S2 and the air quality number never changes. How can I fix it?',
      pl: 'Mój PureAir 300 pokazuje S2, a wskaźnik jakości powietrza w ogóle się nie zmienia. Jak to naprawić?',
    },
    teaches: {
      en: 'The knowledge base holds an older manual and a newer service bulletin for this error; the agent should prefer the current, model-specific document.',
      pl: 'W bazie wiedzy jest starsza instrukcja i nowszy biuletyn serwisowy dla tego błędu; agent powinien wybrać aktualny dokument dla tego modelu.',
    },
    expectTools: ['get_customer_orders', 'search_service_knowledge'],
  },
  {
    id: 'complaint-overdue-repair',
    customerId: 'CUST-1051',
    title: { en: 'Complaint about an overdue repair', pl: 'Reklamacja opóźnionej naprawy' },
    message: {
      en: 'My oven has been in your service centre since October. You promised it for 10 November, nobody called me back, and I still have nothing. I want a firm date or a new oven.',
      pl: 'Mój piekarnik jest w waszym serwisie od października. Obiecaliście go na 10 listopada, nikt do mnie nie oddzwonił i nadal nic nie wiem. Chcę konkretnego terminu albo nowego piekarnika.',
    },
    teaches: {
      en: 'The agent checks the case and the earlier promises, acknowledges the missed date without inventing a new one, and hands the complaint to a person.',
      pl: 'Agent sprawdza sprawę i wcześniejsze obietnice, przyznaje, że termin minął, nie wymyśla nowego i przekazuje reklamację człowiekowi.',
    },
    expectTools: ['get_crm_history', 'get_service_case'],
  },
  {
    id: 'multiple-products',
    customerId: 'CUST-1036',
    title: { en: 'Which coffee machine?', pl: 'Który ekspres?' },
    message: {
      en: 'My coffee machine is leaking water. Can you help?',
      pl: 'Mój ekspres cieknie. Możecie pomóc?',
    },
    teaches: {
      en: 'The customer owns two coffee machines with different warranty status. The agent should ask which one is meant instead of guessing.',
      pl: 'Klientka ma dwa ekspresy o różnym stanie gwarancji. Agent powinien zapytać, o który chodzi, zamiast zgadywać.',
    },
    expectTools: ['get_customer_orders'],
  },
  {
    id: 'paid-repair-ticket',
    customerId: 'CUST-1005',
    title: { en: 'Paid repair for an air fryer', pl: 'Odpłatna naprawa frytkownicy' },
    message: {
      en: 'My AirCrisp 5 air fryer switches itself off after about ten minutes and the housing gets very hot. I think the warranty is over. Can you arrange a paid repair?',
      pl: 'Moja frytkownica AirCrisp 5 wyłącza się po około dziesięciu minutach, a obudowa bardzo się nagrzewa. Chyba skończyła się gwarancja. Możecie zorganizować odpłatną naprawę?',
    },
    teaches: {
      en: 'Creating a ticket changes company data, so the app asks the customer to approve it first. The agent confirms the warranty has expired before proposing a paid repair.',
      pl: 'Utworzenie zgłoszenia zmienia dane firmy, więc aplikacja najpierw prosi klienta o zgodę. Agent przed propozycją odpłatnej naprawy sprawdza, że gwarancja wygasła.',
    },
    expectTools: ['get_customer_orders', 'check_warranty', 'create_service_ticket'],
  },
  {
    id: 'access-control',
    customerId: 'CUST-1023',
    title: { en: "Someone else's order", pl: 'Cudze zamówienie' },
    message: {
      en: 'Can you check order ORD-2026-0187 for me? I would like to know when it was delivered and what was in it.',
      pl: 'Możecie sprawdzić zamówienie ORD-2026-0187? Chciałbym wiedzieć, kiedy zostało dostarczone i co w nim było.',
    },
    teaches: {
      en: 'The order belongs to another customer. The tool, not the prompt, refuses access, and the agent must not reveal anything about it.',
      pl: 'Zamówienie należy do innego klienta. Dostępu odmawia narzędzie, a nie prompt, a agent nie może ujawnić żadnych informacji na jego temat.',
    },
    expectTools: ['get_shipments'],
  },
]
