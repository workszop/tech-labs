import type { KbDocumentText } from '../types'

export const PL_VACUUM: KbDocumentText[] = [
  {
    id: 'DOC-aeroclean-manual',
    title: 'AeroClean V8 i V10: instrukcja obsługi',
    body: `## O tej instrukcji
Instrukcja dotyczy bezprzewodowych odkurzaczy pionowych Northstar AeroClean V8 (numery seryjne zaczynające się od AC8) i AeroClean V10 (numery seryjne zaczynające się od AC10). Oba modele mają wyjmowany akumulator na zatrzask. V10 ma dodatkowo laserowe podświetlenie kurzu w ssawce i dłuższy czas pracy. Okres gwarancji obu modeli wynosi 24 miesiące od zakupu.

## Czas pracy i tryby mocy
- Tryb Eco: V8 do 40 minut, V10 do 60 minut.
- Tryb Auto: V8 około 25 minut, V10 około 40 minut.
- Tryb Boost: około 8 minut w obu modelach.
Podane czasy dotyczą nowego, w pełni naładowanego akumulatora i końcówki bez napędu. Ssawka z napędzaną szczotką skraca je mniej więcej o jedną trzecią.

## Ładowanie
1. Używaj wyłącznie oryginalnej ładowarki dołączonej do odkurzacza.
2. Ładuj w temperaturze pokojowej, od 5 °C do 35 °C. Poza tym zakresem akumulator się nie ładuje.
3. Pełne ładowanie trwa 4 godziny (V8) albo 4,5 godziny (V10). Kontrolka na akumulatorze świeci na niebiesko podczas ładowania i gaśnie po jego zakończeniu.
4. Kontrolka ładowania migająca na czerwono oznacza usterkę akumulatora lub ładowania; zob. DOC-vacuum-battery-faults.

## Wymiana akumulatora
Naciśnij przycisk zwalniający pod uchwytem i wysuń akumulator w dół. Wsuń nowy lub zapasowy akumulator, aż zatrzaśnie się na miejscu. Zapasowy akumulator AeroClean (PRD-VAC-6) pasuje zarówno do V8, jak i do V10. Nigdy nie otwieraj obudowy akumulatora.

## Opróżnianie pojemnika i czyszczenie filtrów
- Po każdym odkurzaniu opróżnij pojemnik na kurz: trzymając go nad koszem, pociągnij czerwoną dźwignię.
- Raz w miesiącu wypłucz filtr wstępny w zimnej wodzie i przed założeniem zostaw go na 24 godziny do wyschnięcia.
- Co miesiąc wytrzep filtr HEPA za silnikiem; wymieniaj go raz w roku.
Zatkany filtr powoduje, że silnik pulsuje, na przemian włączając się i wyłączając. To nie jest usterka akumulatora.

## Szczotka
Wyłącz odkurzacz, wyjmij akumulator i otwórz monetą zaślepkę ssawki. Wysuń szczotkę i przetnij nożyczkami nawinięte włosy wzdłuż rowka. Włóż szczotkę z powrotem i zamknij zaślepkę.

## Przechowywanie
Przechowuj odkurzacz w pomieszczeniu, na uchwycie ściennym. Jeśli nie będzie używany dłużej niż miesiąc, zostaw akumulator naładowany mniej więcej do połowy.

## Dane techniczne
V8: 350 W, pojemnik 0,5 l, 2,4 kg. V10: 450 W, pojemnik 0,76 l, 2,7 kg. Akumulator: litowo-jonowy, 25,2 V.`,
  },
  {
    id: 'DOC-vacuum-battery-faults',
    title: 'Usterki akumulatora w odkurzaczach AeroClean',
    body: `## Zakres
Poradnik dotyczy problemów z akumulatorem i ładowaniem bezprzewodowych odkurzaczy Northstar AeroClean V6, V8 i V10 oraz zapasowego akumulatora AeroClean (PRD-VAC-6). Typowe zgłoszenia klientów brzmią: „akumulator wystarcza tylko na kilka minut”, „nie ładuje się”, „kontrolka ładowania miga na czerwono”, „odkurzacz się wyłącza i włącza”.

## Objaw: bardzo krótki czas pracy
1. Sprawdź tryb. W trybie Boost pełny akumulator rozładowuje się w każdym modelu w około 8 minut.
2. Wyczyść filtr wstępny i filtr za silnikiem (DOC-aeroclean-manual). Zatkane filtry zwiększają pobór mocy.
3. Naładuj akumulator do pełna oryginalną ładowarką (od 4 do 5 godzin) i sprawdź czas pracy w trybie Eco z końcówką bez napędu.
4. Jeśli w trybie Eco czas pracy jest krótszy niż połowa czasu znamionowego (V8 poniżej 20 minut, V10 poniżej 30 minut, V6 poniżej 12 minut), akumulator stracił pojemność i trzeba go wymienić.

## Objaw: brak ładowania albo czerwona migająca kontrolka
- Sprawdź gniazdko innym urządzeniem i obejrzyj przewód ładowarki, czy nie jest uszkodzony.
- Pozwól zimnemu lub gorącemu akumulatorowi osiągnąć temperaturę pokojową; poniżej 5 °C i powyżej 35 °C ładowanie jest zablokowane.
- Przetrzyj styki akumulatora suchą ściereczką.
Jeśli kontrolka nadal miga na czerwono, wyłączył się układ zabezpieczający akumulatora. Akumulatora nie da się naprawić, trzeba go wymienić.

## Objaw: silnik pulsuje
Pulsowanie niemal zawsze oznacza zablokowany przepływ powietrza, a nie usterkę akumulatora. Sprawdź, czy pojemnik, filtry, rura i szczotka nie są zatkane.

## Wymiana akumulatora a gwarancja
Akumulator jest objęty gwarancją przez cały okres gwarancji odkurzacza (24 miesiące dla V8 i V10, 12 miesięcy dla V6), jeśli przy normalnym użytkowaniu czas pracy w trybie Eco spadnie poniżej połowy czasu znamionowego. W ramach gwarancji klient otrzymuje nowy akumulator bezpłatnie: do V10 część AC10-BAT-4, do V8 część AC8-BAT-3. Oba akumulatory zakłada się na zatrzask, bez narzędzi. Usterka zgłoszona przed końcem okresu gwarancji jest obsługiwana w ramach gwarancji, nawet jeśli nowy akumulator dotrze już po tej dacie (DOC-warranty-terms).
Po upływie gwarancji klient może kupić zapasowy akumulator AeroClean (PRD-VAC-6, 69 EUR), pasujący do V8 i V10. W V6 akumulator jest wbudowany i jego wymiana w centrum serwisowym to naprawa odpłatna (DOC-paid-repairs).

## Bezpieczeństwo
Nigdy nie otwieraj, nie przebijaj i nie podgrzewaj akumulatora. Spuchniętego, gorącego albo wydzielającego zapach akumulatora nie wolno ładować: odłóż go na zewnątrz na niepalne podłoże i skontaktuj się z obsługą klienta. To sprawa dotycząca bezpieczeństwa (DOC-support-escalation).`,
  },
  {
    id: 'DOC-roboclean-r5-guide',
    title: 'RoboClean R5: rozwiązywanie problemów',
    body: `## O robocie RoboClean R5
Northstar RoboClean R5 (numery seryjne zaczynające się od RC5) to robot sprzątający z nawigacją lidar, stacją samoopróżniającą i sterowaniem z aplikacji Northstar. Gwarancja: 24 miesiące od zakupu. Problemy z Wi-Fi i parowaniem z aplikacją opisuje DOC-smart-wifi-connectivity.

## Błąd silnika szczotki
Objaw: szczotka główna staje po kilku minutach, a aplikacja pokazuje „Błąd silnika szczotki”.
1. Najpierw wyłącz robota. Potem odwróć go na miękkim podłożu i wyjmij szczotkę główną (dwa zatrzaski).
2. Przetnij włosy i nitki nawinięte na szczotkę i jej końcówki.
3. Sprawdź, czy szczotka obraca się swobodnie w ręku, włóż ją z powrotem i uruchom sprzątanie testowe.
Jeśli błąd wraca w ciągu kilku minut od czyszczenia, uszkodzony jest moduł silnika szczotki. Moduł silnika szczotki (część RC5-BM-11) użytkownik może wymienić sam: trzymają go dwie śruby od spodu, a podłącza się go wtyczką, bez napięcia sieciowego. W ramach gwarancji moduł jest wysyłany do klienta pocztą (DOC-shipping-delivery), a klient montuje go dołączonym śrubokrętem.

## Robot nie znajduje stacji
- Ustaw stację przy ścianie, z 0,5 m wolnego miejsca po obu stronach i 1,5 m przed nią.
- Trzymaj stację z dala od luster, szaf z lustrami i szklanych drzwi: zakłócają działanie lidaru.
- Przetrzyj suchą ściereczką osłonę lidaru na górze robota.
- Jeśli meble zostały przestawione, uruchom w aplikacji „Odbuduj mapę”.

## Robot krąży albo pomija pomieszczenia
Wyczyść czujniki krawędzi pod przednim zderzakiem i nie wpuszczaj robota na dywany z długimi frędzlami. Zaktualizuj oprogramowanie robota w aplikacji.

## Stacja samoopróżniająca nie opróżnia robota
Wymień worek w stacji, gdy aplikacja pokaże „Worek pełny”, i sprawdź, czy kanał ssący między robotem a stacją jest drożny.

## Błąd koła
Usuń włosy z osi kół i sprawdź, czy koła po wciśnięciu odbijają z powrotem. Koło, które pozostaje wciśnięte, wymienia centrum serwisowe.

## Części
Moduł silnika szczotki RC5-BM-11 (wymienia użytkownik), szczotki boczne RC5-SB-02 (para), worki do stacji RC5-DB-03 (opakowanie trzech sztuk). Zob. DOC-parts-compatibility.`,
  },
]
