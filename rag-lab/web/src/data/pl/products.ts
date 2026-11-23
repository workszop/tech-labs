import type { CompanyDocument } from '../documents'

export const PRODUCTS: CompanyDocument[] = [
  {
    id: 'products-overview',
    folder: 'products',
    title: 'Przegląd produktów',
    owner: 'Product Marketing',
    version: '2026.3',
    effectiveDate: '2026-09-01',
    status: 'current',
    summary: 'Wprowadzenie do czterech produktów Northstar: Beacon, Relay, Vault i Pulse, oraz zestawienie, co zawiera każdy plan.',
    content: `Przegląd produktów

Northstar Technologies tworzy oprogramowanie w chmurze, dzięki któremu zespoły operacyjne, finansowe i zespoły pracujące z klientami zamieniają rozproszone dane w decyzje i gotowe dokumenty. Platforma Northstar składa się z czterech produktów, które mają wspólne logowanie, jedną konsolę administracyjną i jeden model uprawnień.

Northstar Beacon

Beacon to nasz produkt do analityki i dashboardów. Zespoły podłączają źródła danych, budują dashboardy z wykresów metodą „przeciągnij i upuść” i planują wysyłkę raportów na e-mail lub Slacka. Beacon ma warstwę semantyczną, więc metryki takie jak „przychód” czy „aktywny klient” definiuje się raz i używa wszędzie. W listopadzie 2026 r. udostępniliśmy Beacon AI Insights, funkcję, która prostym językiem wyjaśnia zmiany metryki.

Typowi użytkownicy: analitycy finansowi, kierownicy operacyjni, kadra zarządzająca.

Northstar Relay

Relay to nasze centrum automatyzacji przepływów pracy i integracji. Przenosi dane między aplikacjami biznesowymi za pomocą ponad 180 gotowych konektorów (m.in. Salesforce, HubSpot, NetSuite, Zendesk, Slack, Google Workspace i Microsoft 365) i pozwala budować automatyzacje w edytorze wizualnym. Relay reaguje na zdarzenia, przekształca rekordy i może wywołać dowolny endpoint REST. To także zalecany sposób łączenia produktów, które nie mają własnego publicznego API.

Typowi użytkownicy: zespoły operacyjne, IT i revenue operations.

Northstar Vault

Vault to bezpieczny magazyn dokumentów z wbudowanym podpisem elektronicznym. Zespoły przechowują w nim umowy i dokumentację z historią wersji, ustawiają reguły retencji i wysyłają dokumenty do prawnie wiążącego podpisu. Vault obsługuje pliki do 2 GB i prowadzi pełną ścieżkę audytu: zapisuje każde wyświetlenie, edycję i podpis.

Typowi użytkownicy: działy prawne, HR, zakupy i sprzedaż.

Northstar Pulse

Pulse to nasz produkt do zbierania opinii klientów. Wysyła ankiety NPS, CSAT i ankiety własne e-mailem, przez widżet w aplikacji lub SMS-em i analizuje odpowiedzi na pytania otwarte. Pulse jest sprzedawany jako dodatek do dowolnego planu w cenie 9 USD za użytkownika miesięcznie. Pulse nie ma jeszcze własnego publicznego API; wyniki ankiet można wyeksportować do CSV albo synchronizować z innymi systemami przez konektor Pulse w Relay. Publiczne API Pulse jest planowane na Q2 2027 (zob. Plan rozwoju produktów).

Typowi użytkownicy: zespoły customer success, produktowe i marketingowe.

Co zawiera każdy plan

- Starter (19 USD za użytkownika miesięcznie): Beacon i Vault z funkcjami standardowymi, do 25 użytkowników, bez dostępu do API.
- Professional (49 USD za użytkownika miesięcznie): Beacon, Relay i Vault, dostęp do REST API i webhooki.
- Enterprise (89 USD za użytkownika miesięcznie, minimum 50 użytkowników): wszystko z planu Professional, a do tego SSO, SCIM, logi audytowe, rezydencja danych w USA lub UE, wyższe limity zapytań do API i Premium Support.
- Pulse: dodatek do dowolnego planu.

Integracje w skrócie

Beacon, Relay i Vault udostępniają REST API Northstar (wersja 3) i wysyłają webhooki w planach Professional i Enterprise. Relay ma dodatkowo gotowe konektory. Pulse integruje się wyłącznie przez Relay lub eksport do CSV, dopóki nie ukaże się jego API. Szczegóły uwierzytelniania, endpointy i limity zapytań opisuje Przewodnik integracji API.

Cechy platformy

- Jedna konsola administracyjna do zarządzania użytkownikami, rolami i rozliczeniami we wszystkich produktach.
- Hosting w AWS w Stanach Zjednoczonych i w Unii Europejskiej.
- Certyfikaty SOC 2 Type II i ISO 27001.
- Gwarantowana dostępność 99,9% (Professional) i 99,95% (Enterprise), zdefiniowana w dokumencie Umowa o poziomie usług (SLA).
- Aplikacja webowa dla aktualnych wersji przeglądarek Chrome, Edge, Firefox i Safari; aplikacje mobilne na iOS i Androida (Beacon i Vault).

Gdzie szukać dalszych informacji

Hosting, zabezpieczenia i limity opisuje dokument Specyfikacja techniczna. Zasady ustalania cen zawiera Polityka cenowa. Pytania o produkty można kierować do zespołu Product Marketing na kanale #product-marketing.`,
  },
  {
    id: 'products-roadmap',
    folder: 'products',
    title: 'Plan rozwoju produktów',
    owner: 'Product Management',
    version: 'H2-2026',
    effectiveDate: '2026-07-15',
    status: 'current',
    summary: 'Planowane wydania produktów od Q4 2026 do Q3 2027 oraz zasady udostępniania planu rozwoju klientom.',
    content: `Plan rozwoju produktów

Ten plan rozwoju wymienia główne inwestycje produktowe zaplanowane na najbliższe cztery kwartały, od Q4 2026 do Q3 2027. Kierownictwo działu produktu przegląda go na początku każdego kwartału. Daty są celami, a nie zobowiązaniami.

Ważne: jak rozmawiać z klientami o planie rozwoju

Plan rozwoju jest poufny. Handlowcy i Customer Success Managerowie mogą przekazywać klientom objętym NDA pozycje oznaczone jako „do udostępnienia”. Używają przy tym sformułowania „obecnie planowane” i nigdy nie obiecują terminu dostarczenia. Umowy nie mogą zawierać pozycji z planu rozwoju jako przedmiotu dostawy, a rabatów nie wolno oferować w zamian za przyszłe funkcje. Klient powinien kupować produkt ze względu na to, co produkt potrafi dziś.

Q4 2026 (październik–grudzień)

- Beacon AI Insights, wersja ogólnodostępna (wydana w listopadzie 2026 r., do udostępnienia). Wyjaśnienia zmian metryk prostym językiem, dostępne w planach Professional i Enterprise.
- Rozbudowa biblioteki konektorów Relay do 200 konektorów (do udostępnienia). Wśród nowych konektorów są Workday, Shopify Plus i ServiceNow.
- Podpisywanie zbiorcze w Vault: wysyłka jednego dokumentu do maksymalnie 500 podpisujących w jednym kroku (do udostępnienia).
- Nowy projekt konsoli administracyjnej, beta dla wybranych klientów Enterprise.

Q1 2027 (styczeń–marzec)

- Rezydencja danych w Kanadzie dla Beacon i Vault, w regionie AWS Canada (Central) (do udostępnienia). To odpowiedź na potrzeby klientów z sektora publicznego i ochrony zdrowia w Kanadzie.
- Ponawianie po błędzie w Relay: nieudane kroki przepływu pracy można uruchomić ponownie z historii uruchomień, bez budowania przepływu od nowa.
- API w wersji 3.2 z paginacją opartą na kursorze we wszystkich endpointach zwracających listy. Paginacja z parametrem offset będzie obsługiwana co najmniej do stycznia 2028 r.

Q2 2027 (kwiecień–czerwiec)

- Publiczne API Pulse (do udostępnienia). Endpointy REST dla ankiet, odpowiedzi i kontaktów oraz webhooki dla nowych odpowiedzi. Do tego czasu integracje z Pulse działają przez konektor Pulse w Relay albo eksport do CSV.
- Analityka osadzona Beacon: klienci będą mogli osadzać dashboardy Beacon we własnych aplikacjach. Funkcja będzie dostępna tylko w planie Enterprise.
- Klucze szyfrujące zarządzane przez klienta w Vault (Enterprise).

Q3 2027 (lipiec–wrzesień)

- Tryb offline w aplikacjach mobilnych Beacon i Vault.
- Asystent AI w Relay, który przygotowuje szkic przepływu pracy na podstawie opisu w prostym języku.
- Wielojęzyczne ankiety Pulse z automatycznym tłumaczeniem na 12 języków.

Rozważane (bez terminu)

- Integracja Pulse bezpośrednio w dashboardach Beacon, bez Relay.
- Wdrożenie on-premises. Obecnie nie planujemy wersji on-premises żadnego produktu Northstar.
- Kolejne regiony rezydencji danych: Australia i Wielka Brytania.

Ostatnio wycofane

- API w wersji 2 zostało wyłączone 30 czerwca 2026 r. Wszyscy klienci muszą używać API w wersji 3.
- Stary silnik eksportu do PDF w Beacon został zastąpiony w sierpniu 2026 r.

Jak ustalamy priorytety

Pozycje planu rozwoju szeregujemy według wpływu na klientów (opinie z ankiet Pulse, zgłoszenia i przyczyny przegranych transakcji), potencjału przychodowego, zgodności ze strategią i nakładu pracy inżynierów. Prośbę klienta może zgłosić każdy pracownik przez formularz Product Feedback; Product Management przegląda zgłoszone prośby co tydzień.

Pytania kieruj do zespołu Product Management na kanale #product. Nie przesyłaj tego dokumentu poza Northstar.`,
  },
  {
    id: 'products-technical-specs',
    folder: 'products',
    title: 'Specyfikacja techniczna',
    owner: 'Platform Engineering',
    version: '7.0',
    effectiveDate: '2026-06-01',
    status: 'current',
    summary: 'Regiony hostingu, zabezpieczenia, kopie zapasowe, odtwarzanie po awarii, obsługiwane przeglądarki i limity produktów.',
    content: `Specyfikacja techniczna

Ten dokument opisuje architekturę techniczną, zabezpieczenia i limity platformy Northstar. Jest przeznaczony dla zespołów IT, bezpieczeństwa i zakupów, które oceniają Northstar, oraz dla zespołów wewnętrznych odpowiadających na kwestionariusze bezpieczeństwa.

Hosting i architektura

Platforma Northstar to aplikacja SaaS typu multi-tenant hostowana w Amazon Web Services. Dane klientów są przechowywane w jednym z dwóch regionów:

- Stany Zjednoczone: AWS us-east-2 (Ohio), z kopią do odtwarzania po awarii w us-west-2 (Oregon)
- Unia Europejska: AWS eu-west-1 (Irlandia), z kopią do odtwarzania po awarii w eu-central-1 (Frankfurt)

Klienci planów Starter i Professional są domyślnie hostowani w regionie USA. Klienci Enterprise wybierają rezydencję danych w USA lub UE przy podpisaniu umowy. Rezydencja danych w Kanadzie jest planowana na Q1 2027.

Bezpieczeństwo

- Szyfrowanie danych w spoczynku algorytmem AES-256; szyfrowanie transmisji protokołem TLS 1.2 lub nowszym.
- Certyfikaty: SOC 2 Type II (audyt co roku) i ISO 27001.
- Zgodność z RODO (GDPR) i CCPA; umowa powierzenia przetwarzania danych (DPA) jest dostępna dla wszystkich klientów.
- Logowanie jednokrotne (SSO) przez SAML 2.0 i OpenID Connect oraz provisioning użytkowników przez SCIM 2.0 (plan Enterprise).
- Kontrola dostępu oparta na rolach, z rolami niestandardowymi w planach Professional i Enterprise.
- Logi audytowe przechowywane przez 1 rok (plan Enterprise), z eksportem do narzędzi SIEM.
- Coroczne testy penetracyjne wykonywane przez firmę zewnętrzną; pismo z podsumowaniem jest dostępne po podpisaniu NDA.

Dostępność, kopie zapasowe i odtwarzanie

- Gwarantowana dostępność: 99,9% w planie Professional i 99,95% w planie Enterprise, mierzona miesięcznie zgodnie z definicją w dokumencie Umowa o poziomie usług (SLA). Plan Starter ma cel 99,5%, który nie jest zobowiązaniem umownym.
- Planowe prace serwisowe: niedziele między 02:00 a 06:00 UTC, zapowiadane z co najmniej 72-godzinnym wyprzedzeniem.
- Kopie zapasowe: pełne kopie codzienne z odtwarzaniem do wskazanego punktu w czasie (point-in-time recovery), przechowywane przez 35 dni.
- Docelowy punkt odtworzenia (RPO): 1 godzina. Docelowy czas odtworzenia (RTO): 4 godziny.

Limity produktów

Beacon:
- Rozmiar zbioru danych: do 50 milionów wierszy na zbiór w planie Professional, 500 milionów w planie Enterprise, 5 milionów w planie Starter.
- Odświeżanie dashboardu: najczęściej co 15 minut (co 5 minut w planie Enterprise).

Relay:
- Uruchomienia przepływów pracy: 50 000 miesięcznie w planie Professional, 500 000 miesięcznie w planie Enterprise; dodatkowe uruchomienia można dokupić.
- Maksymalny czas działania przepływu pracy: 15 minut na uruchomienie.

Vault:
- Maksymalny rozmiar pliku: 2 GB na plik.
- Przestrzeń dyskowa: 100 GB na klienta w planie Starter, 1 TB w planie Professional, bez limitu w planie Enterprise (zasada fair use).

Pulse:
- Do 100 000 odpowiedzi na ankiety miesięcznie na klienta.

API:
- REST API w wersji 3 w planach Professional i Enterprise. Limit zapytań wynosi 300 zapytań na minutę w planie Professional i 1000 zapytań na minutę w planie Enterprise. Szczegóły zawiera Przewodnik integracji API.

Obsługiwane klienty

- Przeglądarki: dwie najnowsze główne wersje Chrome, Edge, Firefox i Safari.
- Aplikacje mobilne: iOS 17 lub nowszy i Android 13 lub nowszy (Beacon i Vault).
- Internet Explorer i starsza wersja Edge (legacy) nie są obsługiwane.

Przechowywanie i usuwanie danych

Dane klienta przechowujemy przez cały okres subskrypcji. Po jej zakończeniu dane można eksportować przez 30 dni, a potem w ciągu kolejnych 60 dni są trwale usuwane, także z kopii zapasowych.

Strona statusu

Bieżący status usług i historię incydentów publikujemy na stronie status.northstar.example. Klienci mogą zasubskrybować powiadomienia e-mail lub SMS.

Pytania o bezpieczeństwo należy wysyłać na adres security@northstar.example.`,
  },
  {
    id: 'products-api-guide',
    folder: 'products',
    title: 'Przewodnik integracji API',
    owner: 'Developer Relations',
    version: '3.1',
    effectiveDate: '2026-07-01',
    status: 'current',
    summary: 'Jak uwierzytelnić się w REST API Northstar v3, które produkty ono obejmuje, limity zapytań, paginacja i webhooki.',
    content: `Przewodnik integracji API

REST API Northstar pozwala programistom odczytywać i zapisywać dane w produktach Northstar oraz łączyć je z własnymi systemami. Ten przewodnik dotyczy API w wersji 3, jedynej obsługiwanej wersji od czasu wyłączenia API w wersji 2, co nastąpiło 30 czerwca 2026 r.

Które produkty obsługują API

- Northstar Beacon: zbiory danych, dashboardy, zaplanowane raporty i definicje metryk.
- Northstar Relay: przepływy pracy, uruchomienia przepływów i konfiguracje konektorów. Relay może też wywoływać zewnętrzne API z wnętrza przepływu pracy.
- Northstar Vault: foldery, dokumenty, wersje i prośby o podpis.
- Northstar Pulse: nie ma jeszcze publicznego API. Użyj konektora Pulse w Relay albo eksportu do CSV. Publiczne API Pulse jest planowane na Q2 2027.

Dostęp do API jest częścią planów Professional i Enterprise. Plan Starter nie obejmuje dostępu do API; klienci planu Starter, którzy potrzebują integracji, muszą przejść na plan Professional.

Bazowy adres URL i format

Wszystkie zapytania trafiają pod adres https://api.northstar.example/v3 przez HTTPS. Zapytania i odpowiedzi mają format JSON w kodowaniu UTF-8. Znaczniki czasu są zapisywane w formacie ISO 8601 w strefie UTC.

Uwierzytelnianie

Obsługiwane są dwie metody:

- OAuth 2.0 client credentials, zalecane w integracjach serwer–serwer. Tokeny dostępu są ważne 60 minut.
- Osobiste klucze API, przeznaczone do skryptów i testów. Klucze API tworzy się w konsoli administracyjnej, można je ograniczyć do wybranych produktów, a wygasają po 12 miesiącach.

Token wysyłaj w nagłówku Authorization jako token Bearer. Nigdy nie umieszczaj kluczy API w kodzie działającym po stronie klienta ani w publicznych repozytoriach. Klucz, który wyciekł, trzeba natychmiast unieważnić w konsoli administracyjnej.

Limity zapytań

Limit zapytań chroni platformę i jest naliczany na konto klienta, a nie na klucz API:

- Plan Professional: 300 zapytań na minutę.
- Plan Enterprise: 1000 zapytań na minutę.
- Krótkie skoki do 2-krotności limitu są dozwolone przez 10 sekund.

Każda odpowiedź zawiera nagłówki X-RateLimit-Limit, X-RateLimit-Remaining i X-RateLimit-Reset. Po przekroczeniu limitu API zwraca HTTP 429 Too Many Requests z nagłówkiem Retry-After. Klient powinien odczekać wskazany czas i ponawiać zapytania z wykładniczo rosnącym odstępem (exponential backoff). Klienci Enterprise, którzy potrzebują wyższych limitów, mogą o nie poprosić przez swojego Customer Success Managera.

Paginacja

Endpointy zwracające listy podają domyślnie 100 pozycji na stronę, a z parametrem limit do 500 pozycji. Między stronami przechodzi się za pomocą parametru offset. Paginacja oparta na kursorze pojawi się w API w wersji 3.2 (Q1 2027).

Webhooki

Beacon, Relay i Vault mogą wysyłać webhooki dla zdarzeń takich jak report.completed, workflow.failed i signature.completed. Webhooki są podpisywane sygnaturą HMAC-SHA256 w nagłówku X-Northstar-Signature; zawsze ją weryfikuj. Jeśli Twój endpoint nie odpowie statusem 2xx w ciągu 10 sekund, Northstar ponawia wysyłkę do 5 razy w ciągu 24 godzin, w coraz dłuższych odstępach. Potem zdarzenie zostaje oznaczone jako nieudane i można je wysłać ponownie z konsoli administracyjnej.

Błędy

- 400: nieprawidłowe zapytanie; treść odpowiedzi wyjaśnia, które pole jest błędne.
- 401: brak tokenu albo token wygasł.
- 403: token nie ma wymaganego zakresu (scope) albo plan nie obejmuje dostępu do API.
- 404: zasób nie istnieje albo token go nie widzi.
- 429: przekroczono limit zapytań.
- 5xx: błąd serwera; ponów zapytanie z rosnącym odstępem i skontaktuj się z działem Support, jeśli błąd się powtarza.

Sandbox

Klienci planów Professional i Enterprise mogą poprosić o bezpłatne konto sandbox do prac programistycznych. Dane w sandboksie są resetowane co 30 dni, a limity zapytań są takie same jak w planie klienta.

SDK i wsparcie

Oficjalne SDK są dostępne dla Pythona, JavaScriptu/TypeScriptu i Javy. Pytania o API obsługuje Customer Support zgodnie z planem wsparcia klienta; przy incydentach P1, które dotyczą API, stosuj dokument Procedura eskalacji. Dokumentację dla programistów i listy zmian publikujemy na stronie developers.northstar.example.`,
  },
]
