// Polskie teksty czatu z klientem (prawy panel): widżet obsługi klienta Northstar.
import type { Dict } from '../en'

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (n === 1) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export const chat: Dict['chat'] = {
  widget: {
    label: 'Czat obsługi klienta Northstar Appliances',
    company: 'Northstar Appliances',
    title: 'Obsługa klienta',
    agentName: 'Asystent Northstar',
    agentRole: 'Agent AI',
    status: {
      online: 'Dostępny',
      working: 'Sprawdza Twoją sprawę…',
      waiting: 'Czeka na Twoją zgodę',
      offline: 'Niedostępny',
    },
    scenarios: 'Scenariusze',
  },

  identity: {
    label: 'Zalogowano jako',
    hint: 'Narzędzia agenta zwracają tylko dane tego klienta.',
  },

  empty: {
    title: 'W czym możemy pomóc?',
    body: 'Jesteś klientem Northstar. Napisz własne pytanie albo zacznij od jednego ze scenariuszy.',
  },

  scenarios: {
    title: 'Scenariusze',
    intro: 'Każdy scenariusz loguje Cię jako konkretnego klienta i wpisuje jego wiadomość. Wysyłasz ją sam.',
    newConversation: 'Wybór scenariusza rozpoczyna nową rozmowę.',
    signsInAs: 'Logujesz się jako',
    teaches: 'Czego uczy',
    pick: (title: string) => `Wybierz scenariusz: ${title}`,
    confirmTitle: (title: string) => `Uruchomić scenariusz „${title}”?`,
    confirmBody: (name: string) => `Obecna rozmowa się zakończy i zacznie się nowa, jako ${name}. Wcześniejsze przebiegi zostają w panelu agenta.`,
    confirm: 'Uruchom scenariusz',
    cancel: 'Anuluj',
  },

  composer: {
    label: 'Twoja wiadomość do obsługi klienta',
    placeholder: 'Napisz wiadomość…',
    send: 'Wyślij',
    stop: 'Zatrzymaj',
    keys: 'Enter wysyła · Shift+Enter dodaje wiersz',
    counter: (n: number, max: number) => `${n}/${max}`,
    activate: 'Aktywuj',
    reasons: {
      inactive: 'Aktywuj laboratorium kodem dostępu, żeby porozmawiać z agentem.',
      loading: 'Wczytuję rozmowę…',
      kbChecking: 'Sprawdzam dokumenty serwisowe… Za chwilę możesz pisać.',
      kbIndexing: (done: number, total: number) => `Przygotowuję dokumenty serwisowe (${done}/${total}). Gdy skończę, możesz pisać.`,
      running: 'Agent odpowiada. Zatrzymaj go, jeśli chcesz napisać coś nowego.',
      awaiting: 'Zatwierdź albo odrzuć proponowane działanie powyżej, żeby kontynuować.',
    },
  },

  messages: {
    you: 'Ty',
    agent: 'Asystent Northstar',
    typing: 'Agent pisze',
    jumpToLatest: 'Nowe wiadomości',
  },

  steps: {
    title: 'Kroki narzędzi',
    count: (n: number) => `${n} ${plural(n, 'krok', 'kroki', 'kroków')}`,
    issues: (n: number) => `${n} z problemem`,
    open: (tool: string) => `Pokaż ${tool} w panelu agenta`,
    status: {
      running: 'W toku',
      awaiting: 'Czeka na Ciebie',
      ok: 'Gotowe',
    },
    codes: {
      forbidden: 'Odmowa dostępu',
      not_found: 'Nie znaleziono',
      invalid_arguments: 'Błędne argumenty',
      unknown_tool: 'Nieznane narzędzie',
      tool_disabled: 'Narzędzie wyłączone',
      too_many_calls: 'Za dużo wywołań',
      index_not_ready: 'Indeks niegotowy',
      failed: 'Błąd systemu',
      not_executed: 'Nie uruchomiono',
      result_unknown: 'Wynik nieznany',
      rejected_by_user: 'Odrzucone przez Ciebie',
      duplicate_call: 'Powtórzone wywołanie',
    },
    systems: {
      orders: 'Zamówienia',
      products: 'Katalog produktów',
      warranty: 'Gwarancje',
      logistics: 'Logistyka',
      crm: 'CRM',
      knowledge: 'Baza wiedzy',
      tickets: 'Serwis',
    },
    unknownSystem: 'Nieznane narzędzie',
  },

  sources: {
    label: 'Źródła',
    more: (n: number) => `+${n} więcej`,
    less: 'Pokaż mniej',
    open: (id: string) => `Otwórz ${id}`,
  },

  escalation: {
    ticketTitle: 'Przekazano do zespołu serwisu',
    ticketBody: 'Utworzono zgłoszenie serwisowe. Zajmie się nim technik Northstar.',
    handoverTitle: 'Systemy firmy nie odpowiedziały',
    handoverBody: 'Agent nie dostał się do systemów Northstar przy tej sprawie. W prawdziwym wdrożeniu rozmowa trafiłaby teraz do konsultanta. To laboratorium jest symulacją, więc tutaj nikt jej nie przejmie.',
  },

  notices: {
    cancelled: 'Zatrzymano',
    limit: 'Zatrzymano na limicie laboratorium',
    error: 'Błąd',
    detail: 'Szczegóły',
    limitNote: 'Laboratorium ogranicza liczbę kroków, wywołań narzędzi i tokenów na jedną wiadomość.',
    rateLimitedTitle: 'Za dużo zapytań',
    rateLimited: 'Serwer laboratorium dostał w ostatniej minucie za dużo zapytań z tej sesji. Odczekaj chwilę i wyślij wiadomość ponownie.',
    quotaTitle: 'Budżet AI wyczerpany',
    quota: 'Budżet AI tego kodu dostępu się wyczerpał, więc agent nie może odpowiedzieć. Poproś prowadzącego o zwiększenie limitu albo o nowy kod.',
  },

  confirmation: {
    title: 'Agent prosi o Twoją zgodę',
    lead: 'Nic nie zostanie utworzone, dopóki nie zdecydujesz.',
    changesData: 'Zmienia dane firmy',
    action: 'Proponowane działanie',
    actionValue: 'Utworzenie zgłoszenia serwisowego',
    customer: 'Klient',
    product: 'Produkt',
    issue: 'Opis problemu',
    priority: 'Priorytet',
    expected: 'Oczekiwany rezultat',
    expectedValue: 'W systemie zgłoszeń pojawi się nowe zgłoszenie, a zespół serwisu skontaktuje się z Tobą.',
    priorities: { low: 'Niski', normal: 'Normalny', high: 'Wysoki', urgent: 'Pilny' },
    approve: 'Zatwierdź',
    reject: 'Odrzuć',
    state: {
      pending: 'Czeka na Twoją decyzję',
      approved: 'Zatwierdzono',
      rejected: 'Odrzucono: zgłoszenie nie powstało',
      cancelled: 'Anulowano: nie podjęto decyzji, zgłoszenie nie powstało',
    },
  },

  announce: {
    working: 'Agent pracuje nad Twoją wiadomością.',
    waiting: 'Agent prosi Cię o zgodę na działanie.',
    replied: (text: string) => `Asystent Northstar: ${text}`,
  },

  sendFailed: 'Wiadomość nie została wysłana.',
}
