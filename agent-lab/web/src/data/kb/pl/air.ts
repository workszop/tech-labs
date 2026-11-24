import type { KbDocumentText } from '../types'

export const PL_AIR: KbDocumentText[] = [
  {
    id: 'DOC-pureair-300-manual',
    title: 'PureAir 300: instrukcja obsługi',
    body: `## O tej instrukcji
Instrukcja dotyczy oczyszczacza powietrza Northstar PureAir 300 (numery seryjne zaczynające się od PA300) do pomieszczeń o powierzchni do 50 m². Urządzenie ma filtr HEPA H13 z warstwą węgla aktywnego, laserowy czujnik pyłu i wyświetlacz jakości powietrza. Gwarancja: 24 miesiące od zakupu. PureAir 300 nie ma Wi-Fi; obsługuje się go przyciskami na górze obudowy.

## Przyciski
- Zasilanie: włączanie i wyłączanie.
- Wentylator: trzy prędkości i tryb Auto. W trybie Auto wentylator dostosowuje się do odczytu czujnika pyłu.
- Tryb: tryb nocny przyciemnia wyświetlacz i włącza najniższą prędkość.
- Filtr: przytrzymanie przez 3 sekundy zeruje wskaźnik filtra po jego wymianie.

## Wyświetlacz jakości powietrza
Liczba na wyświetlaczu to stężenie pyłu PM2.5 zmierzone przez czujnik, w µg/m³. Kolor pierścienia wskazuje przedział: niebieski dobry (0 do 12), zielony umiarkowany (13 do 35), żółty zły (36 do 55), czerwony bardzo zły (powyżej 55). Po włączeniu czujnik potrzebuje około 30 sekund, zanim odczyt będzie wiarygodny.

## Ustawienie
Postaw oczyszczacz na płaskiej podłodze, z co najmniej 30 cm wolnego miejsca z każdej strony i 1 m nad nim. Nie stawiaj go obok nawilżacza ani w łazience: mgiełka wodna jest odczytywana jako pył.

## Filtr
Wymień filtr (filtr HEPA H13 do PureAir 300/500, PRD-AIR-5), gdy kontrolka filtra świeci na czerwono, zwykle co 6 do 12 miesięcy. Zob. DOC-pureair-filter-care.

## Czyszczenie czujnika pyłu
Kurz na soczewce czujnika sprawia, że odczyt skacze albo stoi w miejscu. Czujnik czyść co dwa miesiące:
1. Wyłącz oczyszczacz i wyjmij wtyczkę z gniazdka.
2. Otwórz małą osłonę czujnika na prawym boku (oznaczoną symbolem kurzu).
3. Wyczyść otwór czujnika suchym patyczkiem higienicznym. Nie używaj wody ani alkoholu.
4. Odkurz miękką szczoteczką kratkę wlotu powietrza do czujnika.
5. Zamknij osłonę, podłącz zasilanie i włącz urządzenie.

## Kody błędów
- F1: brak filtra lub filtr źle osadzony. Załóż filtr ponownie i zamknij tylną pokrywę.
- F2: koniec żywotności filtra. Wymień filtr i wyzeruj wskaźnik.
- S2: błąd odczytu czujnika pyłu. Odczyt stoi na jednej wartości albo wyświetlają się kreski. Wyczyść czujnik pyłu w sposób opisany powyżej. Jeśli S2 nie znika, postępuj zgodnie z aktualnym biuletynem serwisowym SB-2026-07 (DOC-sb-2026-07).
- E1: usterka silnika wentylatora. Odłącz zasilanie i załóż sprawę serwisową.

## Dane techniczne
Moc 45 W. Wydajność oczyszczania (CADR) 300 m³/h. Głośność od 24 do 52 dB. Masa 6,1 kg.`,
  },
  {
    id: 'DOC-pureair-sensor-calibration-2025',
    title: 'PureAir 300: procedura kalibracji czujnika pyłu (2025)',
    body: `## Status dokumentu
Procedurę wydano w marcu 2025 roku dla pracowników obsługi, którzy zajmowali się błędem S2 i zablokowanym odczytem jakości powietrza w Northstar PureAir 300. Zastąpił ją biuletyn serwisowy SB-2026-07 (DOC-sb-2026-07). Dokument zachowano wyłącznie do wglądu. Nie przekazuj tych kroków klientom.

## Cel
Od początku 2025 roku w części egzemplarzy PureAir 300 odczyt jakości powietrza stał w miejscu albo pojawiał się błąd S2, choć otwór czujnika był czysty. Za przyczynę uznano dryf poziomu odniesienia czujnika. Procedura służyła do ponownej kalibracji czujnika przyciskami.

## Warunki wstępne
- Czujnik pyłu został wyczyszczony zgodnie z instrukcją obsługi PureAir 300 (DOC-pureair-300-manual).
- Oczyszczacz pracuje od co najmniej 10 minut.

## Kroki kalibracji (2025)
1. Otwórz okna i wietrz pomieszczenie przez 10 minut, aby powietrze było możliwie czyste.
2. Przy włączonym oczyszczaczu przytrzymaj jednocześnie przyciski Tryb i Wentylator przez 5 sekund, aż wyświetlacz pokaże „CAL”.
3. Zostaw oczyszczacz na najwyższej prędkości na 10 minut. Nie przesuwaj go w tym czasie.
4. Gdy napis „CAL” zniknie, nowy poziom odniesienia jest zapisany. Wyświetlacz wraca do odczytu jakości powietrza.
5. Jeśli nadal widać S2, powtórz kalibrację jeszcze raz.

## Zapis wyniku
Pracownik zapisywał w kontakcie w CRM, że kalibracja została wykonana, ile razy ją powtórzono oraz jaki był odczyt jakości powietrza przed nią i po niej. Jeśli po kalibracji odczyt zaczynał się zmieniać, sprawę uznawano za rozwiązaną.

## Dalsze postępowanie
Jeśli S2 nie znikał po dwóch kalibracjach, zakładano sprawę serwisową i czujnik sprawdzało centrum serwisowe.

## Znane ograniczenie
Kalibracja zakłada, że przez te 10 minut powietrze w pomieszczeniu jest czyste. Jeśli tak nie jest, oczyszczacz zapisuje błędny poziom odniesienia i odczyt może stanąć na jednej wartości. To ograniczenie było powodem zastąpienia procedury biuletynem SB-2026-07.`,
  },
  {
    id: 'DOC-sb-2026-07',
    title: 'Biuletyn serwisowy SB-2026-07: błąd S2 i zablokowany odczyt jakości powietrza w PureAir 300',
    body: `## Dane biuletynu
Numer biuletynu: SB-2026-07. Data wejścia w życie: 3 sierpnia 2026. Produkt: Northstar PureAir 300 (numery seryjne PA300-24 i PA300-25). Biuletyn zastępuje procedurę kalibracji czujnika pyłu z 2025 roku (DOC-pureair-sensor-calibration-2025). Pracownicy obsługi muszą stosować ten biuletyn przy każdym błędzie S2 i każdym zablokowanym odczycie jakości powietrza w PureAir 300.

## Objaw
Wyświetlacz pokazuje S2 albo wskaźnik jakości powietrza godzinami stoi na tej samej wartości i nie reaguje na gotowanie, otwarcie okna ani odkurzanie.

## Przyczyna
Badanie zwróconych egzemplarzy w lipcu 2026 roku wykazało dwie przyczyny. Po pierwsze, kurz zbiera się w pułapce pyłu za otworem czujnika, do której nie sięga czyszczenie patyczkiem opisane w instrukcji. Po drugie, kalibracja przyciskami z 2025 roku zapisuje błędny poziom odniesienia, jeśli powietrze w pomieszczeniu nie jest czyste, a wtedy odczyt staje w miejscu. Problem często dotyczy egzemplarzy kalibrowanych według starej procedury.

## Nie stosuj kalibracji przyciskami
Nie proś klientów o kalibrację czujnika przez przytrzymanie przycisków Tryb i Wentylator. Kalibracja czujnika z 2025 roku została wycofana dla wszystkich egzemplarzy PureAir 300, podobnie jak każda inna kalibracja przyciskami.

## Nowa procedura dla klientów
1. Wyczyść otwór czujnika suchym patyczkiem higienicznym, jak opisano w instrukcji obsługi PureAir 300.
2. Wyczyść pułapkę pyłu: wyłącz oczyszczacz i wyjmij wtyczkę, otwórz osłonę czujnika na prawym boku, wyciągnij za uchwyt małą szarą pułapkę pyłu, wytrzep ją i oczyść miękką szczoteczką. Wsuń ją z powrotem do zatrzaśnięcia.
3. Przywróć fabryczny poziom odniesienia czujnika: zostaw oczyszczacz odłączony na 60 sekund, a następnie przytrzymaj przycisk zasilania podczas podłączania wtyczki i trzymaj go przez 10 sekund, aż na wyświetlaczu pojawi się „rS”.
4. Pozwól oczyszczaczowi pracować w trybie Auto przez 30 minut. Po tym czasie odczyt normalnie reaguje na zmiany w pomieszczeniu.

## Gdy S2 nie znika
Jeśli S2 albo zablokowany odczyt utrzymuje się po resecie fabrycznym, uszkodzony jest moduł czujnika pyłu (część PA3-PS-04). Wymienia go wyłącznie centrum serwisowe, po odbiorze urządzenia przez kuriera. W okresie 24-miesięcznej gwarancji wymiana jest bezpłatna. Załóż sprawę serwisową z adnotacją „wykonano kroki z SB-2026-07”.

## Uwaga dla pracowników
Sprawy rozwiązane przed wydaniem biuletynu samym czyszczeniem według instrukcji pozostają ważne. Przy nowych zgłoszeniach zawsze stosuj ten biuletyn.`,
  },
  {
    id: 'DOC-pureair-filter-care',
    title: 'Filtry PureAir: wymiana i pielęgnacja',
    body: `## Który filtr pasuje do którego oczyszczacza
- PureAir 300 i PureAir 500 Smart: filtr HEPA H13 do PureAir 300/500, produkt PRD-AIR-5, 49 EUR. Łączy warstwę HEPA H13 z węglem aktywnym.
- PureAir 200: filtr do PureAir 200, część PA2-FLT-01.
- BreezePure Mini i wycofany PureAir 100 mają własne filtry, wymienione w DOC-parts-compatibility.
Filtry są materiałami eksploatacyjnymi. Gwarancja obejmuje je tylko w zakresie wad istniejących w chwili dostawy (DOC-warranty-exclusions).

## Kiedy wymienić filtr
Kontrolka filtra zmienia kolor na żółty, gdy zostaje około 10 procent żywotności filtra, a na czerwony, gdy filtr jest zużyty. W zwykłych domach następuje to co 6 do 12 miesięcy. Wymień filtr wcześniej, jeśli oczyszczacz pachnie dymem albo gotowaniem nawet po godzinie pracy na wysokiej prędkości: warstwa węglowa jest wtedy nasycona.

## Jak wymienić filtr
1. Wyłącz oczyszczacz i wyjmij wtyczkę z gniazdka.
2. Otwórz tylną pokrywę, naciskając dwa zatrzaski u góry.
3. Wyciągnij stary filtr za uchwyt i zdejmij folię z nowego filtra.
4. Włóż nowy filtr uchwytem na zewnątrz i zamknij pokrywę. Przy niedomkniętej pokrywie oczyszczacz pokazuje F1.
5. Podłącz zasilanie, włącz urządzenie i przytrzymaj przycisk Filtr przez 3 sekundy, aby wyzerować wskaźnik (w PureAir 500 Smart można to też zrobić w aplikacji).

## Pielęgnacja filtra wstępnego
Szara siatka filtra wstępnego z przodu filtra zatrzymuje włosy i większy kurz. Odkurzaj ją co dwa tygodnie miękką szczoteczką. Filtr wstępny można prać: wypłucz go w letniej wodzie i przed założeniem pozostaw do całkowitego wyschnięcia. Samego filtra HEPA nigdy nie myj.

## Zużyte filtry
Przed wyrzuceniem włóż zużyty filtr do worka, żeby kurz się nie rozsypał. Filtry wyrzuca się do odpadów zmieszanych.

## Wpływ na czujnik
Zużyty filtr nie powoduje błędu S2. S2 to usterka czujnika pyłu; zob. instrukcję obsługi PureAir 300 i biuletyn serwisowy SB-2026-07.`,
  },
]
