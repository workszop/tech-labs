// Polskie teksty warstwy edukacyjnej: wyjaśnienia, podpowiedzi, panel narzędzi, powtórka i porównanie.
// Kształt musi być identyczny z en/learn.ts. Teksty pisane dla menedżera bez przygotowania technicznego.
import type { ToolName } from '@shared/tools'
import type { learn as en } from '../en/learn'

// Lokalna kopia reguły odmiany (import z '@/i18n' tworzyłby cykl).
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (n === 1) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
const wywolania = (n: number) => `${n} ${plural(n, 'wywołanie', 'wywołania', 'wywołań')}`
const razy = (n: number) => (n === 1 ? 'raz' : `${n} razy`)

export const learn: typeof en = {
  byDefault: 'domyślnie ',
  button: 'Jak to działa',
  buttonHint: 'Krótkie wyjaśnienia tego, co widzisz w laboratorium',

  dialog: {
    title: 'Jak działa agent obsługi klienta',
    description: 'Dwanaście krótkich wyjaśnień, każde powiązane z czymś, co zobaczysz w tym laboratorium.',
    topicsLabel: 'Tematy',
    allTopics: 'Wszystkie tematy',
    groups: { basics: 'Agent', systems: 'Systemy firmy', safety: 'Kontrola i granice', compare: 'Dla porównania' },
    inLab: 'W tym laboratorium',
    more: 'Więcej szczegółów',
    prev: 'Poprzedni',
    next: 'Następny',
    position: (i: number, n: number) => `${i} z ${n}`,
  },

  topics: {
    agent: {
      title: 'Czym jest agent AI?',
      lead: 'Agent AI to model językowy, który nie tylko pisze, ale też działa. Pracuje krok po kroku, aż będzie mógł odpowiedzieć.',
      points: ['Ustala, czego musi się dowiedzieć.', 'Prosi o narzędzie i czyta jego wynik.', 'Potem decyduje znowu: kolejne narzędzie albo odpowiedź.'],
      example: 'W scenariuszu 1 agent sprawdza zamówienie, gwarancję i instrukcje serwisowe, zanim odpowie. Każdy krok widać w środkowym panelu agenta.',
      more: 'Gdy w nagłówku widać plakietkę Demo offline, agenta zastępuje program działający według stałych reguł: te same narzędzia, ale decyzji nie podejmuje model językowy.',
      showMe: 'Pokaż panel agenta',
    },
    toolCalling: {
      title: 'Czym jest wywoływanie narzędzi?',
      lead: 'Narzędzie to mała, nazwana funkcja, z której agent może skorzystać, na przykład check_warranty. Model sam nie zajrzy do bazy danych. Może tylko napisać prośbę: nazwę narzędzia i jego argumenty.',
      points: ['Aplikacja sprawdza prośbę i uruchamia narzędzie na symulowanych systemach firmy.', 'Wynik wraca do modelu jako tekst.'],
      example: 'Kliknij wiersz narzędzia na osi czasu: panel szczegółów, który się pod nim otworzy, pokaże argumenty wysłane przez model i dokładny wynik, który dostał.',
      showMe: 'Pokaż narzędzia',
    },
    choosingTools: {
      title: 'Jak agent wybiera narzędzia?',
      lead: 'Przy każdym zapytaniu model dostaje krótki opis każdego włączonego narzędzia. Wybiera te, których opis pasuje do pytania.',
      points: ['Wybór wynika ze wzorców, których model się nauczył, a nie ze sztywnych reguł.', 'Wyłączonego narzędzia model w ogóle nie zna, więc nie może go wybrać.'],
      example: 'Wyłącz check_warranty i powtórz scenariusz 3: agent musi odpowiedzieć bez sprawdzenia gwarancji.',
      more: 'Dopóki widać plakietkę Demo offline, o wyborze decydują stałe reguły napisane pod te scenariusze, a nie model językowy.',
      showMe: 'Pokaż przełączniki narzędzi',
    },
    loop: {
      title: 'Czym jest pętla działania agenta?',
      lead: 'Agent pracuje w rundach. W każdej rundzie model albo prosi o narzędzia, albo pisze odpowiedź. Wyniki narzędzi trafiają do rozmowy i zaczyna się kolejna runda.',
      points: ['Każda runda to krok: jego numer widać na węźle Agent AI.', 'Limit kroków na wiadomość to {byDefault}{steps}, a tokenów (drobnych kawałków słów, które model czyta i pisze) około {tokens}. Po {calls} wywołaniach narzędzi agent musi odpowiedzieć już bez narzędzi. Czat mówi, gdy zadziałał limit.'],
      example: 'W scenariuszu 1 są trzy rundy: najpierw zamówienie, potem jednocześnie gwarancja i instrukcje, na końcu odpowiedź.',
      showMe: 'Pokaż oś czasu',
    },
    api: {
      title: 'Czym jest API?',
      lead: 'API to umówiony sposób, w jaki jeden program prosi inny o dane albo o wykonanie czynności: ze stałym formatem pytania i odpowiedzi. Ludzie korzystają z ekranów, programy z API.',
      points: ['Każde narzędzie odpowiada tu jednemu wywołaniu API systemu Northstar.', 'Z systemem rozmawia narzędzie, nigdy model.'],
      example: 'Tutaj systemy są symulowane w Twojej przeglądarce, więc rekordy czytane przez narzędzia to te same, które otworzysz w panelu systemów firmy po lewej.',
      showMe: 'Pokaż systemy firmy',
    },
    crm: {
      title: 'Czym jest CRM?',
      lead: 'CRM (system do zarządzania relacjami z klientami) przechowuje historię każdego klienta: dane kontaktowe, rozmowy i maile, reklamacje oraz złożone obietnice.',
      points: ['Pracownicy zaglądają do niego, zanim odpowiedzą.', 'Bez niego każda rozmowa zaczyna się od zera.'],
      example: 'W scenariuszu 4 CRM pokazuje dwie wcześniejsze naprawy tego samego wycieku, więc agent może dostrzec wzorzec i przekazać sprawę dalej. Włącz zestaw Bez CRM i zobacz różnicę.',
      showMe: 'Otwórz CRM',
    },
    rag: {
      title: 'Czym jest RAG?',
      lead: 'RAG (generowanie wspomagane wyszukiwaniem) oznacza: najpierw znajdź właściwe fragmenty we własnych dokumentach, potem pozwól modelowi odpowiedzieć na ich podstawie.',
      points: ['Dokumenty są dzielone na fragmenty, a każdy fragment zamienia się w listę liczb oddającą jego znaczenie (tzw. embedding).', 'Pytanie porównuje się z każdym fragmentem, a najbliższe trafiają do modelu.'],
      example: 'Status bazy wiedzy w nagłówku pokazuje budowanie takiego indeksu w Twojej przeglądarce. Szczegóły wiersza wyszukiwania na osi czasu pokazują każdy znaleziony fragment z jego wynikiem podobieństwa.',
      more: 'Dopóki widać plakietkę Demo offline, liczby powstają z samych słów, a nie z modelu: wyszukiwanie dopasowuje wspólne słowa, a nie znaczenie.',
      showMe: 'Otwórz bazę wiedzy',
    },
    kbUse: {
      title: 'Jak agent korzysta z bazy wiedzy?',
      lead: 'Dla agenta baza wiedzy to po prostu kolejne narzędzie, search_service_knowledge. Agent sam decyduje, kiedy i czego szukać, a potem czyta zwrócone fragmenty.',
      points: ['Każdy fragment mówi, czy jego dokument jest aktualny, czy zastąpiony.', 'Dobry agent wybiera aktualny dokument dla konkretnego modelu.'],
      example: 'W scenariuszu 5 wyszukiwanie znajduje starszą instrukcję i nowszy biuletyn serwisowy dla błędu S2. Otwórz wiersz wyszukiwania na osi czasu i sprawdź, na którym z nich oparto odpowiedź.',
      showMe: 'Otwórz scenariusz 5',
    },
    hitl: {
      title: 'Czym jest człowiek w pętli (human-in-the-loop)?',
      lead: 'Człowiek w pętli oznacza, że zanim agent zmieni dane albo zrobi coś trudnego do cofnięcia, musi to zatwierdzić osoba.',
      points: ['Odczyt danych odbywa się automatycznie.', 'Utworzenie zgłoszenia czeka na zgodę. Po odmowie nic nie zostaje zapisane, a agent dostaje tę informację.'],
      example: 'W scenariuszu 8 agent proponuje odpłatną naprawę. Karta zatwierdzenia w czacie pokazuje dokładnie, co powstanie; zgłoszenie zapisuje się dopiero po kliknięciu Zatwierdź. Zatwierdza tu klient, czyli Ty.',
      more: 'O zgodę prosi aplikacja, a nie model, więc model nie może tego kroku pominąć.',
      showMe: 'Otwórz scenariusz 8',
    },
    permissions: {
      title: 'Dlaczego uprawnienia muszą sprawdzać narzędzia?',
      lead: 'Model można namówić do różnych rzeczy i może się pomylić. Dlatego zasada „klient widzi tylko swoje dane” musi działać w narzędziach, a nie tylko w instrukcjach dla modelu.',
      points: ['Każde narzędzie sprawdza, czy rekord należy do zalogowanego klienta.', 'Jeśli nie, odmawia i nie zwraca nic o tym rekordzie.'],
      example: 'W scenariuszu 9 klient pyta o cudze zamówienie. Narzędzie logistyki odmawia dostępu, więc agent nie ma czego ujawnić.',
      showMe: 'Otwórz scenariusz 9',
    },
    mistakes: {
      title: 'Dlaczego agenci czasem się mylą?',
      lead: 'Model językowy przewiduje prawdopodobny tekst. Może wybrać złe narzędzie, pominąć sprawdzenie, źle odczytać wynik albo brzmieć pewnie w sprawie, której nie sprawdził.',
      points: ['Brak narzędzi lub danych osłabia odpowiedź.', 'Niejasne pytanie prowadzi do zgadywania.', 'Limity mogą przerwać przebieg, zanim agent skończy.'],
      example: 'Scenariusz 7 jest niejasny: klientka ma dwa ekspresy. Wyłącz narzędzia gotowym zestawem, powtórz pytanie i porównaj oba przebiegi. Oceniaj przebieg, a nie tylko odpowiedź.',
      showMe: 'Pokaż gotowe zestawy narzędzi',
    },
    compare: {
      title: 'Chatbot, RAG czy agent?',
      lead: 'Trzy sposoby postawienia AI przed klientem. Każdy kolejny daje więcej dostępu, a więc wymaga więcej kontroli.',
      points: [],
      example: 'To laboratorium pokazuje agenta. Z gotowym zestawem Tylko baza wiedzy w przełącznikach narzędzi działa jak RAG.',
    },
  },

  compareTable: {
    columns: { chatbot: 'Chatbot', rag: 'RAG', agent: 'Agent' },
    rows: [
      { label: 'Skąd odpowiedzi', chatbot: 'Z tego, czego model się nauczył', rag: 'Z Twoich dokumentów, przez wyszukiwanie', agent: 'Z dokumentów i bieżących systemów' },
      { label: 'Zna tego klienta', chatbot: 'Nie', rag: 'Nie', agent: 'Tak, przez sprawdzone narzędzia' },
      { label: 'Może działać', chatbot: 'Nie', rag: 'Nie', agent: 'Tak, po zatwierdzeniu' },
      { label: 'Główne ryzyko', chatbot: 'Zmyślone fakty', rag: 'Nieaktualne dokumenty', agent: 'Błędne działanie lub wyciek danych' },
    ],
  },

  tips: {
    learnMore: 'Dowiedz się więcej',
    toolCall: { label: 'O wywołaniach narzędzi', text: 'Model pisze tylko prośbę: nazwę narzędzia i argumenty. Aplikacja ją sprawdza i uruchamia narzędzie na symulowanych systemach.' },
    markers: { label: 'O narzędziach do odczytu i zmieniających dane', text: 'Narzędzia do odczytu tylko sprawdzają dane. Narzędzie, które zmienia dane, na przykład tworzy zgłoszenie, najpierw czeka na zgodę klienta: w tym laboratorium Twoją, bo grasz klienta.' },
    score: { label: 'O wyniku podobieństwa', text: 'Jak bliski znaczeniem jest fragment wyszukiwanemu tekstowi, od 0 do 1. Wyższy znaczy bardziej podobny, niekoniecznie bardziej trafny.' },
    steps: { label: 'O krokach', text: 'Krok to jedna runda pętli: model prosi o narzędzia albo pisze odpowiedź. Laboratorium {byDefault}zatrzymuje przebieg po {steps} krokach.' },
    identity: { label: 'O zalogowanym kliencie', text: 'Narzędzia zwracają tylko rekordy tego klienta. Pytanie o cudze zamówienie odrzuca samo narzędzie.' },
    tools: { label: 'O przełącznikach narzędzi', text: 'Wyłącz narzędzie i zobacz, jak agent radzi sobie bez niego. Zmiana działa od następnej wiadomości.' },
  },

  tools: {
    title: 'Narzędzia agenta',
    summaryAll: (n: number) => `Wszystkie włączone (${n})`,
    summary: (on: number, total: number) => `Włączone: ${on} z ${total}`,
    off: 'Wyłączone',
    toggleShow: 'Pokaż przełączniki narzędzi',
    toggleHide: 'Ukryj przełączniki narzędzi',
    note: 'Wyłączone narzędzie w ogóle nie trafia do modelu: serwer pomija je w zapytaniu. Zmiany działają od następnej wiadomości.',
    locked: 'Zablokowane, gdy agent pracuje: przebieg korzysta z narzędzi, z którymi wystartował.',
    presets: 'Gotowe zestawy',
    presetNames: {
      all: 'Wszystkie narzędzia',
      noCrm: 'Bez CRM',
      noLogistics: 'Bez logistyki',
      noWarranty: 'Bez sprawdzania gwarancji',
      noKnowledge: 'Bez bazy wiedzy',
      readOnly: 'Tylko odczyt (bez zgłoszeń)',
      kbOnly: 'Tylko baza wiedzy',
    },
    changesData: 'Zmienia dane',
    readOnlyNote: 'Pozostałe narzędzia tylko odczytują dane.',
    switchLabel: (tool: string, system: string) => `${tool} (${system})`,
    nodeSomeOff: (n: number) => `Wyłączone: ${n} ${plural(n, 'narzędzie', 'narzędzia', 'narzędzi')}`,
  },

  repeat: {
    button: 'Powtórz to pytanie',
    hint: 'Wysyła tę samą wiadomość jeszcze raz, jako ten sam klient, z obecnymi przełącznikami narzędzi, w nowej rozmowie.',
    failed: 'Nie udało się wysłać pytania ponownie.',
  },

  compare: {
    open: 'Porównaj przebiegi',
    openPrevious: 'Porównaj z poprzednim przebiegiem',
    openHint: 'Dwa przebiegi obok siebie: narzędzia, wywołania, odpowiedzi.',
    title: 'Porównanie dwóch przebiegów',
    description: 'To, co zapisano w każdym przebiegu, obok siebie. Nic tu nie jest oceniane.',
    runA: 'Przebieg A',
    runB: 'Przebieg B',
    pickLabel: (side: 'A' | 'B') => `Przebieg ${side}`,
    option: (n: number, time: string, message: string) => `#${n} · ${time} · ${message}`,
    repeatTag: (n: number) => `powtórka #${n}`,
    sameRun: 'Wybierz dwa różne przebiegi.',
    needTwo: 'Wyślij co najmniej dwie wiadomości (albo powtórz jedną), aby porównać przebiegi.',
    customer: 'Klient',
    question: 'Pytanie',
    toolsOn: (n: number, total: number) => `Włączone narzędzia: ${n} z ${total}`,
    toolsOff: 'Wyłączone',
    noneOff: 'brak',
    calls: 'Wywołania narzędzi',
    noCalls: 'Brak wywołań narzędzi.',
    only: (side: 'A' | 'B') => `Tylko w ${side}`,
    onlyHint: 'Drugi przebieg nie wywołał tego samego narzędzia z tymi samymi argumentami.',
    answer: 'Odpowiedź końcowa',
    noAnswer: 'Nie powstała żadna odpowiedź.',
    endedWith: 'Przebieg zakończony',
    totals: { steps: 'Kroki', toolCalls: 'Wywołania', duration: 'Czas', tokens: 'Tokeny' },
    differences: 'Różnice',
    onlyCount: (a: number, b: number) => {
      if (a === 0 && b === 0) return 'Oba przebiegi wykonały te same wywołania (te same narzędzia, te same argumenty).'
      // "którego" agrees with "1 wywołanie", "których" with 2, 5, ... wywołania / wywołań.
      const part = (n: number, other: 'A' | 'B') => `${wywolania(n)}, ${n === 1 ? 'którego' : 'których'} nie było w ${other}`
      const parts = [a > 0 ? `Przebieg A wykonał ${part(a, 'B')}` : '', b > 0 ? `${a > 0 ? 'przebieg' : 'Przebieg'} B wykonał ${part(b, 'A')}` : ''].filter(Boolean)
      return `${parts.join('; ')}.`
    },
    noAccess: (side: 'A' | 'B', other: 'A' | 'B', tool: ToolName, system: string, n: number) =>
      n > 0
        ? `Przebieg ${side} nie miał dostępu do ${tool} (${system}), więc nie wykonał takiego wywołania; przebieg ${other} wywołał je ${razy(n)}.`
        : `${tool} (${system}) było wyłączone w przebiegu ${side}; przebieg ${other} też go nie wywołał.`,
    otherCustomer: 'Te dwa przebiegi dotyczą różnych klientów.',
    otherLang: 'Te dwa przebiegi były w różnych językach.',
    language: 'Język',
    langNames: { pl: 'polski', en: 'angielski' },
    swap: 'Zamień przebiegi A i B',
    runs: (n: number) => `${n} ${plural(n, 'przebieg', 'przebiegi', 'przebiegów')}`,
  },
}
