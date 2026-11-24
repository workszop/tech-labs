import type { KbDocumentText } from '../types'

export const PL_SUPPORT: KbDocumentText[] = [
  {
    id: 'DOC-support-escalation',
    title: 'Procedura przekazywania spraw (eskalacji)',
    body: `## Cel
Obsługa klienta (także agent AI obsługi) odpowiada na pytania, prowadzi przez bezpieczne kroki diagnostyczne i zakłada zgłoszenia serwisowe. Niektóre decyzje należą jednak do wyspecjalizowanych zespołów. Procedura określa, kiedy sprawę trzeba przekazać dalej, komu, z jakim priorytetem zgłoszenia i w jakim czasie zespół odpowiada.

## Do kogo przekazujemy sprawy
- Kierownik zespołu serwisu: powtarzające się usterki (ta sama usterka po raz trzeci w jednym egzemplarzu), decyzje o wymianie lub zwrocie pieniędzy, naprawy w drodze wyjątku po wygaśnięciu gwarancji. Decyzja w ciągu 5 dni roboczych.
- Kierownik centrum serwisowego: reklamacje dotyczące napraw trwających w centrum serwisowym, opóźnione naprawy, nieoddzwonienie w obiecanym terminie. Pierwsza odpowiedź dla klienta w ciągu 2 dni roboczych.
- Zespół gwarancyjny: sporne decyzje gwarancyjne, unieważnione gwarancje, wyłączenia. Odpowiedź na piśmie w ciągu 10 dni roboczych.
- Zespół ds. bezpieczeństwa produktów: zapach spalenizny, dym, iskry, trzaski, stopione elementy, porażenie prądem, spuchnięte akumulatory. Tego samego dnia roboczego.
- Zespół produktowy: błędy oprogramowania i problemy z produktami wycofanymi, dla których nie ma ścieżki naprawy. Potwierdzenie przyjęcia w ciągu 3 dni roboczych.
- Dział logistyki: przesyłki opóźnione o ponad 5 dni roboczych względem pierwotnego terminu, zagubione paczki, błędne doręczenia. Odpowiedź w ciągu 1 dnia roboczego.

## Priorytety zgłoszeń
- urgent (pilny): sprawy dotyczące bezpieczeństwa. Klient dostaje polecenie, by przestał używać urządzenia i odłączył je od zasilania.
- high (wysoki): powtarzające się usterki, reklamacje opóźnionych napraw, klient bez niezbędnego urządzenia dłużej niż 2 tygodnie.
- normal (normalny): zwykłe naprawy gwarancyjne i pogwarancyjne, zamówienia części.
- low (niski): prośby o informację i opinie wymagające dalszego kontaktu.

## Jak przekazać sprawę
1. Najpierw sprawdź historię klienta (kontakty w CRM i sprawy serwisowe), aby przekazana sprawa zawierała pełny obraz, na przykład numery wcześniejszych napraw.
2. Załóż zgłoszenie serwisowe z identyfikatorem produktu, rzeczowym opisem i właściwym priorytetem. Klient musi wyrazić zgodę na założenie zgłoszenia.
3. Powiedz klientowi, kto zajmie się sprawą i jaki jest czas odpowiedzi według listy powyżej. Nie obiecuj rozstrzygnięcia (wymiany, zwrotu pieniędzy, terminu naprawy), o którym może zdecydować tylko zespół przyjmujący sprawę.

## Powtarzające się usterki
Gdy CRM pokazuje, że ta sama usterka była już dwa razy naprawiana, nie powtarzaj podstawowej diagnostyki. Odnieś się do historii, załóż zgłoszenie z priorytetem wysokim dla kierownika zespołu serwisu i podaj numery wcześniejszych spraw. Zasadę powtarzającej się usterki opisują warunki gwarancji (DOC-warranty-terms).

## Sprawy, których agent nie prowadzi sam
Groźby prawne, żądania odszkodowania wykraczające poza wymianę lub zwrot pieniędzy, pytania mediów i wnioski dotyczące ochrony danych przekazuje się przełożonemu. Prośby o informacje o zamówieniach lub urządzeniach innego klienta odrzuca się bez podawania jakichkolwiek szczegółów.`,
  },
  {
    id: 'DOC-complaint-handling',
    title: 'Procedura rozpatrywania reklamacji',
    body: `## Co uznajemy za reklamację
Reklamacja to każde wyrażenie niezadowolenia z produktu, naprawy, dostawy lub obsługi, niezależnie od kanału: telefon, e-mail, czat czy sklep. Typowe przykłady: naprawa się opóźnia, nikt nie oddzwonił w obiecanym terminie, ta sama usterka ciągle wraca, przesyłka znowu się spóźnia.

## Zasady
- Nazwij problem i odnieś się do doświadczenia klienta prostymi słowami. Przeproś za to, co poszło źle, na przykład za niedotrzymany termin albo brak telefonu.
- Zanim odpowiesz, sprawdź fakty w systemach: sprawę serwisową, jej historię i obiecany termin oraz wcześniejsze kontakty.
- Bądź uczciwy. Jeśli obiecany termin minął, powiedz to wprost. Nigdy nie wymyślaj nowego terminu, daty dostawy części ani wyniku, których nie ma w sprawie.
- Nie spieraj się o winę i nie obwiniaj przewoźnika ani współpracowników.

## Kroki
1. Zarejestruj reklamację w CRM z numerem powiązanej sprawy lub zamówienia.
2. Sprawdź, czy reklamacja nie jest już zarejestrowana; jeśli tak, nie zakładaj duplikatu, tylko dopisz do niej nowy kontakt.
3. Przekaż ją właściwemu zespołowi (DOC-support-escalation). Przy naprawach trwających w centrum serwisowym jest to kierownik centrum serwisowego.
4. Powiedz klientowi, kto rozpatruje reklamację i kiedy otrzyma odpowiedź.
5. Klient otrzymuje odpowiedź na piśmie najpóźniej w ciągu 14 dni. Cel wewnętrzny: pierwsza odpowiedź w ciągu 2 dni roboczych.

## Opóźnione naprawy
Naprawa jest opóźniona, gdy minął obiecany termin zapisany w sprawie serwisowej. Wtedy:
- Powiedz klientowi, że termin nie został dotrzymany, i co wynika z historii sprawy (na przykład oczekiwanie na część).
- Nie podawaj nowego terminu zakończenia, jeśli centrum serwisowe go nie zapisało.
- Przekaż sprawę kierownikowi centrum serwisowego z priorytetem wysokim.
- Jeśli naprawa gwarancyjna nie zostanie zakończona w ciągu 30 dni od odbioru urządzenia, klient może zamiast niej poprosić o wymianę na nowy egzemplarz albo zwrot pieniędzy. Decyduje kierownik centrum serwisowego; obsługa zapisuje prośbę, ale jej nie obiecuje.

## Nieoddzwonienie w obiecanym terminie
Obiecany klientowi telefon jest zapisywany z terminem. Jeśli nikt nie oddzwonił, przeproś i dopilnuj, by ta informacja znalazła się w przekazanej sprawie.

## Zamknięcie reklamacji
Reklamację zamyka się dopiero wtedy, gdy klient otrzymał odpowiedź. Wynik zapisuje się w CRM.`,
  },
  {
    id: 'DOC-electrical-safety-notice',
    title: 'Komunikat bezpieczeństwa: naprawy elektryczne i otwieranie urządzeń',
    body: `## Dlaczego wydano ten komunikat
Urządzenia Northstar są zasilane napięciem sieciowym 230 V, a w wielu z nich prąd styka się z wodą, parą lub wysoką temperaturą. Naprawy wewnątrz obudowy grożą porażeniem prądem, pożarem lub poparzeniem. Komunikat dotyczy wszystkich produktów i każdej odpowiedzi udzielanej przez obsługę klienta, także przez agenta AI obsługi.

## Zasady dla klientów
- Nigdy nie otwieraj obudowy urządzenia zasilanego z sieci. Za przykręcanymi osłonami nie ma części, które użytkownik może serwisować.
- Przed czyszczeniem, odkamienianiem, wyjmowaniem jednostki zaparzającej albo wymianą części przeznaczonej dla użytkownika zawsze wyłącz urządzenie i wyjmij wtyczkę z gniazdka.
- Nie używaj urządzenia z uszkodzonym przewodem zasilającym lub wtyczką. Uszkodzone przewody wymienia wyłącznie centrum serwisowe.
- Nie dotykaj mokrej wtyczki ani gniazdka. Jeśli pod urządzeniem pojawiła się woda, wyłącz bezpiecznik albo wyjmij wtyczkę wyłącznie suchymi rękami.
- Nigdy nie otwieraj, nie przebijaj i nie podgrzewaj akumulatora.

## Sygnały zagrożenia
Jeśli urządzenie pachnie spalenizną, dymi, iskrzy, trzeszczy, ma stopiony plastik albo kogoś poraziło:
1. Natychmiast przestań go używać i odłącz je od zasilania, gdy będzie to bezpieczne.
2. Nie próbuj go ponownie włączać ani sprawdzać.
3. Skontaktuj się z obsługą klienta. Zgłoszenie jest sprawą dotyczącą bezpieczeństwa z priorytetem pilnym i jeszcze tego samego dnia roboczego trafia do zespołu ds. bezpieczeństwa produktów (DOC-support-escalation).

## Jakie instrukcje obsługa może przekazywać
Obsługa może przekazywać kroki z instrukcji obsługi: czyszczenie, odkamienianie, filtry, wkładanie jednostki zaparzającej, montaż części oznaczonych jako „Użytkownik” w DOC-parts-compatibility. Obsługa nigdy nie może prowadzić klienta przez kroki oznaczone jako wyłącznie serwisowe, na przykład wymianę pomp, grzałek, płyt sterujących, termostatów, wewnętrznych węży czy przewodów zasilających. Gdy usterka wymaga takiego kroku, zakłada się sprawę serwisową.

## Wyłącznie autoryzowane naprawy
Naprawy wewnątrz obudowy wykonują centra serwisowe Northstar i autoryzowane serwisy partnerskie. Otwarcie urządzenia przez kogokolwiek innego unieważnia gwarancję (DOC-warranty-exclusions) i może sprawić, że urządzenie przestanie być bezpieczne.

## Ostygnięcie i ciśnienie
Ekspresy i piekarniki parowe mogą po wyłączeniu zawierać gorącą wodę i parę pod ciśnieniem. Przed wyjmowaniem elementów, przez które płynie woda, odczekaj co najmniej 10 minut.`,
  },
]
