// Polskie teksty powłoki aplikacji. Kształt musi być identyczny z en/shell.ts (typ Dict).
// Polska odmiana po liczebniku (1 plik, 2 pliki, 5 plików). Lokalna kopia reguły z plural() w '@/i18n':
// ten plik jest zawsze po polsku, a import z '@/i18n' tworzyłby cykl (i18n/index -> pl -> i18n/index).
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (n === 1) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

const fragmenty = (n: number) => plural(n, 'fragment', 'fragmenty', 'fragmentów')
const tokeny = (n: number) => plural(n, 'token', 'tokeny', 'tokenów')

function longDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)} r.`
}

export const shell = {
  langSwitch: {
    label: 'Język',
    confirmTitle: 'Zmienić język?',
    confirmBody: 'Dokumenty mają dwie wersje językowe. Zmiana języka wyczyści bazę wiedzy i rozmowę, bo indeks powstał z drugiej wersji.',
    confirm: 'Zmień i wyczyść',
    cancel: 'Anuluj',
  },

  app: {
    opening: 'Otwieram lokalną bazę wiedzy…',
    storageError: (message: string) => `Błąd lokalnego magazynu danych: ${message}`,
    notPersistent: 'IndexedDB nie działa w tym oknie przeglądarki. Indeks jest trzymany w pamięci i zniknie po odświeżeniu strony.',
    narrowNotice: 'RAG Lab jest zaprojektowany na ekran komputera. W wąskim oknie też działa, ale mapa wektorów, tabele i schematy potrzebują miejsca: poszerz okno do co najmniej 1024 px.',
    dismiss: 'Zamknij',
  },

  partsAria: 'Części aplikacji',
  parts: {
    case: 'Przypadek',
    data: 'Dane',
    vectors: 'Baza wektorowa',
    generator: 'Generator',
    benchmark: 'Benchmark',
  },

  view: {
    students: 'Uczestnicy',
    tech: 'Technika',
    aria: 'Widok',
  },

  header: {
    product: 'RAG Lab',
    tagline: 'Zbuduj własną bazę wiedzy',
    mockTooltip: 'Serwer działa w trybie demonstracyjnym offline: wektory powstają z deterministycznych skrótów słów, a odpowiedzi to zdania wycięte z dokumentów. Prawdziwy model AI nie bierze w tym udziału.',
    mockBadge: 'Tryb demo offline',
    usageTooltip: (u: { requestsUsed: string; requestLimit: string; tokensUsed: string; tokenLimit: string; cost: string }) =>
      `Zapytania ${u.requestsUsed}/${u.requestLimit} · Tokeny ${u.tokensUsed}/${u.tokenLimit} · szac. ${u.cost}`,
    tokensLeft: (formatted: string, n: number) => `${plural(n, 'został', 'zostały', 'zostało')} ${formatted} ${tokeny(n)}`,
    activate: 'Aktywuj',
    guideTooltip: 'Przewodnik po laboratorium',
    guideAria: 'Otwórz przewodnik po laboratorium',
    accountTooltip: 'Konto i zużycie',
    accountAria: 'Otwórz panel konta',
  },

  activation: {
    title: 'Witaj w RAG Lab',
    subtitle: 'Zbuduj własną bazę wiedzy dla AI.',
    formTitle: 'Wpisz kod dostępu',
    codeLabel: 'Kod dostępu',
    codePlaceholder: 'RAG-XXXX-XXXX-XXXX-XXXX-XXXX',
    checking: 'Sprawdzam kod…',
    submit: 'Aktywuj',
    help: 'Osobisty kod dostajesz od osoby prowadzącej warsztaty. Kod odblokowuje modele AI, które tworzą wektory i odpowiedzi. Serwer pilnuje limitu użycia przypisanego do kodu.',
    privacyLocal: 'Dokumenty, wektory i wyszukiwanie działają lokalnie w tej przeglądarce. Tekst zamieniany na wektory i kontekst każdego pytania trafiają do dostawcy AI przez serwer RAG Lab.',
    sessionNote: (hasIndex: boolean) => `Sesja jest trzymana tylko w pamięci. Po odświeżeniu strony wpisujesz kod ponownie${hasIndex ? ', a twoja baza wiedzy zostaje zapisana w tej przeglądarce' : ''}.`,
    explore: 'Najpierw przejrzyj dokumenty',
    exploreNote: 'Bez kodu możesz przeglądać dokumenty i podejrzeć podział na fragmenty. Funkcje AI pozostają zablokowane.',
    apiLabel: (url: string) => `API: ${url}`,
    rateLimited: (minutes: number | null) =>
      minutes
        ? `Za dużo prób. Odczekaj ${minutes} ${plural(minutes, 'minutę', 'minuty', 'minut')} i spróbuj ponownie.`
        : 'Za dużo prób. Odczekaj kilka minut i spróbuj ponownie.',
    errors: {
      invalid_code: 'Nie rozpoznaję tego kodu dostępu. Sprawdź, czy nie ma w nim literówek. Kod wygląda tak: RAG-XXXX-XXXX-XXXX-XXXX-XXXX.',
      expired_code: 'Ten kod dostępu wygasł. Poproś osobę prowadzącą warsztaty o nowy.',
      revoked_code: 'Ten kod dostępu został unieważniony. Poproś osobę prowadzącą warsztaty o nowy.',
      too_many_sessions: 'Ten kod działa już na maksymalnej liczbie urządzeń. Wyloguj się na innym urządzeniu albo zgłoś się do osoby prowadzącej.',
      quota_exceeded: 'Ten kod wykorzystał swój limit użycia AI. Poproś osobę prowadzącą warsztaty o podniesienie limitu.',
    } as Record<string, string>,
  },

  explorer: {
    company: 'Rybex',
    subtitle: (n: number) => `Dokumenty firmy · ${n} ${plural(n, 'plik', 'pliki', 'plików')}`,
    selected: (n: number) => `zaznaczone: ${n}`,
    indexed: (n: number) => `w indeksie: ${n}`,
    treeLabel: 'Dokumenty firmy',
    expand: (folder: string) => `Rozwiń ${folder}`,
    collapse: (folder: string) => `Zwiń ${folder}`,
    selectAllIn: (folder: string) => `Zaznacz wszystko w folderze ${folder}`,
    select: (title: string) => `Zaznacz ${title}`,
    outdatedTooltip: 'Zastąpiona wersja. Zostawiliśmy ją celowo, żeby pokazać, że wyszukiwanie potrafi wyciągnąć nieaktualne informacje.',
    draftTooltip: 'Projekt nowszej wersji, niezatwierdzony. Zostawiony celowo: nowszy nie znaczy obowiązujący.',
    inIndexTooltip: (chunks: number) => `W indeksie wektorowym: ${chunks} ${fragmenty(chunks)}`,
    preview: 'Podgląd',
    previewAria: (title: string) => `Podgląd: ${title}`,
    clearSelection: 'Wyczyść zaznaczenie',
    reset: 'Wyczyść bazę wiedzy',
    resetTitle: 'Wyczyścić lokalną bazę wiedzy?',
    resetBody: (n: number) => `Usuniesz z tej przeglądarki wszystkie dokumenty z indeksu (${n}), ich fragmenty, wektory i pamięć podręczną wektorów. Przy ponownej budowie indeksu model znów policzy wektory.`,
    cancel: 'Anuluj',
    deleteAll: 'Usuń wszystko',
  },

  documentDialog: {
    version: (v: string) => `v${v}`,
    effective: (isoDate: string) => `obowiązuje od ${longDate(isoDate)}`,
    outdated: 'Nieaktualny',
    draft: 'Projekt, niezatwierdzony',
    chunksIndexed: (n: number) => `w indeksie: ${n} ${fragmenty(n)}`,
    removeFromBase: 'Usuń z bazy wiedzy',
    addToBase: 'Dodaj do bazy wiedzy',
    showBoundaries: 'Pokaż granice fragmentów',
    highlighted: (chunkId: string) => `Podświetlony fragment: ${chunkId}`,
  },

  account: {
    title: 'Konto i zużycie',
    description: 'Limitów twojego kodu dostępu pilnuje serwer.',
    access: 'Dostęp',
    accessActive: (label: string | null | undefined) => `Aktywny${label ? ` · ${label}` : ''}`,
    accessNone: 'Brak aktywacji',
    requests: 'Zapytania',
    tokens: 'Tokeny',
    remaining: (formatted: string) => `pozostało: ${formatted}`,
    cost: 'Szacowany koszt API',
    costHint: 'Szacunek serwera',
    codeExpires: 'Kod wygasa',
    sessionExpires: 'Sesja wygasa',
    session: 'Sesja',
    logout: 'Wyloguj',
    logoutHint: 'Lokalna baza wiedzy zostaje',
    restoreDefaults: 'Przywróć ustawienia domyślne',
    restoreDefaultsHint: 'Wszystkie decyzje i opcje wyświetlania wracają do wartości domyślnych. Język i widok zostają.',
  },

  learn: {
    tokenSample: 'Na każdą reklamację Rybex odpowiada w ciągu 14 dni.',
    tokenInputAria: 'Tekst do podziału na tokeny',
    tokenId: (id: number) => `identyfikator tokenu: ${id}`,
    tokenStats: (tokens: number, chars: number) => `${tokens} ${tokeny(tokens)} · ${chars} ${plural(chars, 'znak', 'znaki', 'znaków')}`,
    angleAria: 'Kąt między wektorami',
    // Układ: {angleBefore(angle)}<b>{cosinus}</b>
    angleBefore: (angle: number) => `kąt ${angle}° → cosinus `,
    cosineNote: 'Ten sam kierunek = 1. Kąt prosty = 0. Prawdziwe wektory mają 1536 kierunków zamiast 2.',
  },

  techTabs: {
    retrieval: 'Wyszukiwanie',
    pipeline: 'Przebieg',
    guide: 'Przewodnik',
  },

  guide: {
    title: 'Asystent reklamacji Rybex: od dokumentów do decyzji o pilotażu',
    // Układ: {introBefore}<b>{introCompany}</b>{introAfter}
    introBefore: 'Projektujecie asystenta, który pomaga obsłudze reklamacji firmy ',
    introCompany: 'Rybex',
    introAfter: ' (fikcyjny producent konserw rybnych). Do sklepu dotarła dostawa ze zgniecionymi kartonami i wybrzuszoną puszką. Kroki poniżej idą w kolejności warsztatu: najpierw źródła, potem podział dokumentów, testy i dowody. Każdy krok sam się odhacza, gdy naprawdę go zrobicie.',
    introQuestion: 'Pytanie przewodnie:',
    guiding: 'Klient zgłasza wybrzuszoną puszkę i zgnieciony karton w dostawie. Co robimy i w jakim terminie?',
    quote: (s: string) => `„${s}”`,
    ask: 'Zapytaj',
    needCode: 'Pytania wymagają kodu dostępu.',
    progress: (done: number, total: number) => `ukończono ${done}/${total}`,
    concepts: 'Pojęcia',
    extrasTitle: 'Dla chętnych',
    steps: {
      sources: {
        module: 'Moduł 3 · Źródła',
        title: 'Który dokument rozstrzyga reklamację?',
        body: 'Zaznaczcie cały folder „Reklamacje i klient”: obowiązującą procedurę PROCES-04, jej niezatwierdzony projekt wersji 6, eksport rejestru reklamacji i rekord przesyłki. Zbudujcie indeks wektorowy i zadajcie pytanie przewodnie. Zapiszcie terminy, które podał asystent, i dokumenty, z których je wziął.',
        action: 'Zaznacz folder „Reklamacje i klient”',
      },
      outdated: {
        module: 'Moduł 3 · Jedna zmiana',
        title: 'Usuńcie projekt wersji 6 i zapytajcie jeszcze raz',
        body: 'Zmieńcie tylko jedną rzecz: odznaczcie projekt wersji 6 w części Dane, zbudujcie indeks jeszcze raz i zadajcie to samo pytanie. Co się zmieniło w odpowiedzi i w źródłach? Potem zdecydujcie, czy rejestr z danymi osobowymi i rekord przesyłki w ogóle powinny być w bazie.',
        action: 'Odznacz projekt wersji 6 i zbuduj jeszcze raz',
      },
      split: {
        module: 'Moduł 4 · Przygotowanie dokumentów',
        title: 'Gdzie aplikacja tnie procedurę?',
        body: 'Obejrzyjcie sam podział PROCES-04 przy domyślnym ustawieniu 400 tokenów (działa bez kodu). Znajdźcie regułę „traktuje się jako potencjalne zagrożenie” i akapit „W takim przypadku… w ciągu 24 godzin”. Czy są w tym samym fragmencie? Co wie fragment, który zaczyna się od „W takim przypadku”?',
        action: 'Pokaż podział PROCES-04',
      },
      size: {
        module: 'Moduł 5 · Podział i diagnoza',
        title: 'Jedna zmiana w podziale',
        body: 'Wybierzcie jedną zmianę: rozmiar fragmentu 200, nakładanie 120 albo etykietę fragmentu. Zbudujcie indeks jeszcze raz i zadajcie pytanie przewodnie. Pod odpowiedzią w czacie lista „Fragmenty, które dotarły do modelu” pokazuje, które fragmenty weszły do kontekstu i jak bardzo były podobne do pytania.\nZły fragment czy zła odpowiedź? Jeśli w kontekście nie ma słów z odpowiedzią, zawiodło wyszukiwanie. Jeśli są, a odpowiedź ich nie podaje, zawiodło generowanie.',
        action: 'Pokaż fragmenty pod ostatnią odpowiedzią',
      },
      label: {
        module: 'Moduł 5 · Poprawka',
        title: 'Dołóżcie etykietę fragmentu',
        body: 'Włączcie etykietę fragmentu (nagłówek sekcji oraz wersja, data i status), zbudujcie indeks jeszcze raz i zadajcie pytanie przewodnie. Fragment „W takim przypadku…” dostaje teraz nagłówek „Zagrożenie bezpieczeństwa żywności”, a projekt wersji 6, jeśli został w bazie, ma w każdym fragmencie „PROJEKT, NIEZATWIERDZONY”.',
        action: 'Włącz etykietę fragmentu',
      },
      tests: {
        module: 'Moduł 6 · Ocena',
        title: 'Uruchomcie cały benchmark',
        body: 'W części Benchmark uruchomcie wszystkie włączone pytania testowe przy wybranym ustawieniu. Przeczytajcie, które rodzaje pytań nie przechodzą, i sprawdźcie odpowiedzi, które czekają na Waszą ocenę. Potem zmieńcie jedną decyzję, uruchomcie benchmark jeszcze raz i porównajcie dwa wiersze w tabeli przebiegów.',
        action: 'Przejdź do benchmarku',
      },
      log: {
        module: 'Moduł 6–7 · Dowody',
        title: 'Pobierzcie przebiegi',
        body: 'Plik CSV ma każdy przebieg benchmarku: ustawienia bazy, każde pytanie z wynikiem, Wasze ręczne oceny i odpowiedź. To dowód zespołu do karty i decyzji o pilotażu.',
        action: 'Przejdź do benchmarku',
      },
      map: {
        title: 'Obejrzyj mapę wektorów',
        body: 'Każda kropka to jeden fragment. Fragmenty o podobnej tematyce leżą blisko siebie, nawet jeśli używają innych słów. Mapa jest w widoku Technika części Baza wektorowa: przełączcie widok na Technika w nagłówku.',
        action: 'Przejdź do bazy wektorowej',
      },
      compare: {
        title: 'Porównaj odpowiedzi z RAG i bez RAG',
        body: 'W części Generator wybierzcie „Oba obok siebie” i zadajcie pytanie jeszcze raz. Ten sam model odpowie raz z dokumentami Rybex, a raz bez nich.',
        action: 'Ustaw „Oba obok siebie” i wróć do czatu',
      },
    },
  },

  common: {
    close: 'Zamknij',
    explainMore: 'Kliknij, żeby przeczytać więcej.',
    explainAria: (title: string) => `Wyjaśnij: ${title}`,
    learnMore: 'Czytaj więcej',
    status: {
      waiting: 'Oczekuje',
      processing: 'W toku',
      completed: 'Gotowe',
      error: 'Błąd',
      skipped: 'Pominięto',
    },
    vector: 'Wektor',
    vectorHead: (label: string, shown: number, dims: string) => `${label}: pierwsze ${shown} z ${dims} liczb`,
    vectorAllZero: 'Te pierwsze liczby akurat są zerami. Model demonstracyjny offline tworzy rzadkie wektory, w których większość liczb to 0. Prawdziwe modele wypełniają każdy wymiar.',
    overlapPrev: 'Wspólne z poprzednim fragmentem (nakładanie)',
    overlapNext: 'Wspólne z następnym fragmentem (nakładanie)',
  },

  /** Krótkie wyjaśnienia pojęć, z dłuższą wersją po kliknięciu. */
  explainers: {
    rag: {
      title: 'Co to jest RAG?',
      short: 'Retrieval-Augmented Generation, czyli generowanie wspomagane wyszukiwaniem: najpierw znajdź pasujące fragmenty we własnych dokumentach, potem pozwól modelowi AI napisać z nich odpowiedź.',
      body: [
        'Model językowy wie tylko to, co było w jego danych treningowych. Wewnętrznych procedur Rybex nigdy nie widział.',
        'RAG rozwiązuje to w dwóch fazach. Indeksowanie (raz): podziel dokumenty na fragmenty, zamień każdy fragment na wektor i zapisz go. Odpowiadanie (przy każdym pytaniu): zamień pytanie na wektor, znajdź fragmenty o najbardziej podobnych wektorach i wklej je do promptu jako kontekst.',
        'Model pozostaje ten sam, dostaje tylko otwartą książkę. Dlatego o jakości odpowiedzi decyduje jakość wyszukiwania.',
      ],
    },
    chunk: {
      title: 'Co to jest fragment?',
      short: 'Krótki kawałek dokumentu, zrozumiały bez reszty tekstu. Tutaj ma około 400 tokenów (po angielsku to mniej więcej 300 słów, po polsku wyraźnie mniej).',
      body: [
        'Fragment (ang. chunk) to jednostka, która dostaje wektor, jest wyszukiwana i pokazywana modelowi. Każdy fragment pamięta, skąd pochodzi (dokument i pozycja), więc odpowiedź może go zacytować.',
        'RAG Lab tnie tekst na granicach zdań i w miarę możliwości na granicach akapitów, więc fragment rzadko urywa się w pół myśli.',
      ],
    },
    chunking: {
      title: 'Po co dzielić dokumenty?',
      short: 'Jeden wektor dla całego dokumentu zlewa wiele tematów w jeden. Mniejsze fragmenty dają wyraźniejsze wektory i mieszczą się w oknie kontekstu modelu.',
      body: [
        'Wektor streszcza swój tekst do jednego punktu. Procedura na 600 słów, która opisuje terminy, bezpieczeństwo żywności i zwroty, staje się „średnią” wszystkich trzech tematów i do żadnego nie pasuje mocno.',
        'Za małe fragmenty też szkodzą: fragment na 20 tokenów gubi kontekst („limit wynosi 50%”, ale limit czego?). Wypróbuj różne rozmiary i obserwuj, jak zmieniają się wyniki wyszukiwania.',
        'Nakładanie (ang. overlap) powtarza ostatnie zdanie lub zdania fragmentu na początku następnego. Dzięki temu fakt leżący na granicy jest w całości przynajmniej w jednym fragmencie.',
      ],
    },
    token: {
      title: 'Co to jest token?',
      short: 'Modele czytają tekst jako tokeny, czyli kawałki słów. W tekście angielskim 1 token to około ¾ słowa, a polskie słowa dzielą się zwykle na więcej tokenów.',
      body: [
        'RAG Lab liczy tokeny prawdziwym tokenizerem cl100k_base, tym samym, którego używają modele text-embedding-3 firmy OpenAI. Rozmiary fragmentów i koszty są więc dokładne.',
        'Dostawcy rozliczają i ograniczają użycie w tokenach, dlatego licznik zużycia też pokazuje tokeny.',
      ],
    },
    embedding: {
      title: 'Co to jest embedding?',
      short: 'Lista liczb (wektor), która oddaje znaczenie tekstu. Teksty o podobnym znaczeniu dostają podobne wektory.',
      body: [
        'Model tworzący wektory zamienia dowolny tekst na wektor o stałej długości. Dla text-embedding-3-small jest to 1536 liczb. Pojedyncza liczba nic nie znaczy, znaczenie niesie kierunek całego wektora.',
        '„Puszka spuchła i syczy” i „wybrzuszona puszka” nie mają prawie żadnych wspólnych słów, a ich wektory wskazują podobne kierunki. Na tym polega wyszukiwanie semantyczne: dopasowuje teksty po znaczeniu, nawet gdy słowa są inne.',
        'Pytanie i dokumenty musi zamienić na wektory ten sam model. Wektory z różnych modeli leżą w różnych przestrzeniach i nie da się ich porównać.',
      ],
    },
    vectorDb: {
      title: 'Co to jest baza wektorowa?',
      short: 'Magazyn fragmentów zapisanych razem z wektorami, który można przeszukiwać według podobieństwa.',
      body: [
        'Twoja baza mieści się w całości w tej przeglądarce (IndexedDB). Każdy rekord zawiera tekst fragmentu, jego źródło, wektor i nazwę modelu, który ten wektor utworzył.',
        'Systemy produkcyjne używają wyspecjalizowanych baz wektorowych z wyszukiwaniem przybliżonym, bo obsługują miliony wektorów. Przy kilkuset fragmentach dokładne sprawdzenie każdego wektora trwa mniej niż milisekundę.',
        'Dane zapisane w przeglądarce należą do tego profilu przeglądarki. Po wyczyszczeniu danych witryny, w oknie prywatnym albo na innym urządzeniu indeksu nie będzie.',
      ],
    },
    similarity: {
      title: 'Co znaczy podobieństwo semantyczne?',
      short: 'Miara tego, jak bliskie znaczeniem są dwa teksty. Liczy się ją po tym, na ile ich wektory wskazują ten sam kierunek.',
      body: [
        'Wyszukiwanie szereguje wszystkie fragmenty według podobieństwa do pytania i zostawia kilka najlepszych.',
        'Wysokie podobieństwo znaczy „mówi o tym samym”, a nie „zawiera poprawną odpowiedź”. Nieaktualne zasady mogą być bardzo podobne do pytania o zasady obowiązujące dziś.',
      ],
    },
    cosine: {
      title: 'Co to jest podobieństwo cosinusowe?',
      short: 'Cosinus kąta między dwoma wektorami: 1 = ten sam kierunek, 0 = brak związku, wartość ujemna = kierunki przeciwne.',
      body: [
        'cos(θ) = (a · b) / (‖a‖ ‖b‖). Pomnóż wektory element po elemencie, zsumuj wyniki i podziel przez długości obu wektorów.',
        'Ten wynik służy do ustalania kolejności i nie jest prawdopodobieństwem. Wynik 0.62 nie znaczy „62% szans, że odpowiedź jest poprawna”. Typowe zakresy wyników różnią się też między modelami, więc porównuj wyniki w obrębie jednego pytania, a nie między modelami.',
        'RAG Lab liczy je lokalnie, w pełnej przestrzeni 1536 wymiarów, nigdy z mapy 2D.',
      ],
    },
    topk: {
      title: 'Co to jest wyszukiwanie top-k?',
      short: 'Zostaw k fragmentów z najwyższym wynikiem i tylko je przekaż modelowi.',
      body: [
        'Małe k daje skupiony kontekst, ale potrzebny fragment może być dopiero na 4. miejscu. Duże k zwiększa szansę, że ten fragment się zmieści, ale dokłada szumu i kosztów, a modelowi łatwiej się pomylić.',
        'Opcjonalny próg podobieństwa odrzuca fragmenty ze zbyt niskim wynikiem, żeby słabe dopasowania nie trafiały do modelu jako dowody.',
      ],
    },
    context: {
      title: 'Co to jest okno kontekstu?',
      short: 'Największa ilość tekstu (w tokenach), jaką model może przeczytać w jednym zapytaniu: instrukcje, wyszukane fragmenty i pytanie razem.',
      body: [
        'Wyszukane fragmenty są wklejane do promptu. Im więcej ich dodasz, tym więcej tokenów kosztuje każde pytanie, a serwer pilnuje limitu.',
        'Otwórz „Zobacz prompt wysłany do LLM” przy dowolnej odpowiedzi, żeby zobaczyć dokładny tekst, który dostał model.',
      ],
    },
    pca: {
      title: 'Jak powstaje mapa 2D?',
      short: 'PCA ściska 1536 wymiarów do 2, żeby dało się je zobaczyć. Odległości na mapie są tylko przybliżeniem.',
      body: [
        'Analiza głównych składowych (PCA) znajduje dwa kierunki, wzdłuż których wektory twoich fragmentów różnią się najbardziej, i rzutuje na nie każdy wektor. Obliczenia wykonuje twoja przeglądarka.',
        'Opis osi pokazuje, jaką część całej zmienności zachowuje dany kierunek. Często jest to tylko 5–15%. Dwa punkty mogą leżeć blisko na mapie i mieć przeciętny wynik cosinusowy, albo odwrotnie.',
        'Pytanie jest rzutowane na te same, wcześniej wyznaczone kierunki, więc zadanie pytania nie przesuwa punktów dokumentów. Linie łączą pytanie z fragmentami, które faktycznie zostały wyszukane według dokładnego podobieństwa cosinusowego.',
      ],
    },
    failures: {
      title: 'Dlaczego RAG nadal może się mylić?',
      short: 'Wyszukiwanie może pominąć właściwy fragment albo zwrócić nieaktualny, a model może źle odczytać dobry kontekst.',
      body: [
        'Brak wiedzy: jeśli dokumentu nie ma w indeksie, żadne wyszukiwanie go nie znajdzie.',
        'Wygrywa zły fragment: podobne sformułowania (np. „partia” w procedurze reklamacji i „partia” w procedurze etykietowania) albo nieaktualne zasady mogą wyprzedzić obowiązujące.',
        'Podział na fragmenty: fakt rozcięty między fragmenty albo ukryty w długim fragmencie o czymś innym dostaje słaby wynik.',
        'Generowanie: model nadal może za bardzo uogólnić albo pominąć zastrzeżenie. Cytaty pozwalają sprawdzić każde twierdzenie.',
        'Niezaufany tekst: dokumenty mogą zawierać tekst, który wygląda jak polecenia (zajrzyj do dokumentu „Rozwiązywanie problemów”). RAG Lab każe modelowi traktować fragmenty jako dane, nie jako polecenia.',
      ],
    },
    privacy: {
      title: 'Co opuszcza twoją przeglądarkę?',
      short: 'Teksty fragmentów (do utworzenia wektorów) oraz twoje pytania i wyszukane fragmenty (do odpowiedzi) trafiają do dostawcy AI przez Worker RAG Lab.',
      body: [
        'Wektory, indeks i wszystkie obliczenia podobieństwa zostają w tej przeglądarce.',
        'Worker sprawdza kod dostępu, pilnuje limitów i przekazuje zapytania dalej. Zapisuje liczbę tokenów na potrzeby limitów, ale nie zapisuje tekstu dokumentów ani pytań.',
        'Dostawca modelu przetwarza otrzymany tekst według własnych zasad dotyczących danych. Nie wklejaj prawdziwych poufnych danych do narzędzia warsztatowego.',
      ],
    },
    compare: {
      title: 'RAG włączony i wyłączony',
      short: 'Ten sam model odpowiada dwa razy: raz z wyszukanymi fragmentami dokumentów Rybex, raz bez żadnych dokumentów.',
      body: [
        'Bez wyszukiwania model może tylko zgadywać, jak postępuje typowa firma, bo procedur Rybex nigdy nie widział.',
        'Z wyszukiwaniem może podać prawdziwe liczby i wskazać ich źródło. Po to właśnie jest RAG.',
      ],
    },
  },
}
