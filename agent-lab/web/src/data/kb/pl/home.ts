import type { KbDocumentText } from '../types'

export const PL_HOME: KbDocumentText[] = [
  {
    id: 'DOC-kitchen-overheating',
    title: 'Przegrzewanie się urządzeń kuchennych: AirCrisp 5, InductaCook 2, ToastLine 4',
    body: `## Zakres
Poradnik pomaga pracownikom obsługi i klientom, gdy urządzenie kuchenne samo się wyłącza, mocno się nagrzewa albo pokazuje kod przegrzania. Dotyczy frytkownicy beztłuszczowej Northstar AirCrisp 5, płyty indukcyjnej InductaCook 2 i tostera ToastLine 4. Każde z tych urządzeń ma wyłącznik termiczny, który odcina zasilanie, zanim zrobi się niebezpiecznie. Zadziałanie wyłącznika to zabezpieczenie, a nie sama usterka; trzeba ustalić, dlaczego urządzenie się przegrzewa.

## Najpierw bezpieczeństwo
Jeśli pojawia się dym, zapach spalenizny, iskry albo stopiony plastik, wyłącz zasilanie w gniazdku, wyjmij wtyczkę, gdy jest to bezpieczne, nie używaj więcej urządzenia i traktuj zgłoszenie jako sprawę dotyczącą bezpieczeństwa (DOC-support-escalation, DOC-electrical-safety-notice).

## AirCrisp 5 wyłącza się podczas pracy
Objaw: frytkownica wyłącza się po około 10 minutach, wyświetlacz gaśnie, a obudowa jest bardzo gorąca.
1. Sprawdź odstępy: wylot powietrza z tyłu wymaga co najmniej 10 cm od ściany i 30 cm wolnej przestrzeni nad urządzeniem. Nie używaj frytkownicy pod szafkami wiszącymi.
2. Nie napełniaj kosza 5 l powyżej znacznika MAX. Przepełniony kosz blokuje przepływ powietrza.
3. Po ostygnięciu wyczyść okolice grzałki i osłonę przeciwtłuszczową; nagromadzony tłuszcz powoduje zadziałanie wyłącznika.
4. Odczekaj 30 minut, aż frytkownica ostygnie, i uruchom ją na pusto na 15 minut w 180 °C.
Jeśli mimo prawidłowych odstępów nadal się wyłącza albo wentylator grzechocze lub jest głośniejszy niż wcześniej, zużyty jest silnik wentylatora (część AF5-FM-03). To naprawa serwisowa; klient nie może otwierać obudowy. W okresie 24-miesięcznej gwarancji naprawa jest bezpłatna, po upływie gwarancji jest odpłatna (DOC-paid-repairs).

## InductaCook 2 pokazuje E3
E3 oznacza, że elektronika płyty jest za gorąca i pole grzejne się wyłączyło.
1. Upewnij się, że wlot powietrza pod płytą i wylot z tyłu są drożne. Nie stawiaj płyty na obrusie ani obok piekarnika.
2. Używaj garnków z płaskim dnem zakrywającym pole grzejne; wypaczone dno przegrzewa cewkę.
3. Przed ponownym włączeniem odczekaj 20 minut, aż płyta ostygnie.
Jeśli E3 wraca po kilku minutach pracy na prawidłowym podłożu, uszkodzony jest wentylator chłodzący (część IC2-FAN-02). Wymienia go wyłącznie centrum serwisowe.

## ToastLine 4 wyłącza się albo pachnie spalenizną
Opróżniaj tackę na okruchy co kilka użyć: okruchy na dnie mogą się tlić. Nigdy nie wkładaj posmarowanego masłem pieczywa, folii ani noża. Jeśli po ostygnięciu dźwignia nie zostaje na dole, przepalił się bezpiecznik termiczny i toster musi trafić do centrum serwisowego.

## Co zapisać w sprawie serwisowej
Model i numer seryjny, wyświetlany kod (na przykład E3), po jakim czasie od włączenia urządzenie się wyłącza, sposób ustawienia oraz to, czy klient zauważył hałas lub zapach.`,
  },
  {
    id: 'DOC-steamchef-oven-30-guide',
    title: 'SteamChef Oven 30: instrukcja i kody błędów',
    body: `## O piekarniku SteamChef Oven 30
Northstar SteamChef Oven 30 (numery seryjne zaczynające się od SC30) to wolnostojący piekarnik parowy 30 l z wyjmowanym zbiornikiem na wodę 1 l po lewej stronie. Gwarancja: 24 miesiące od zakupu.

## Zbiornik na wodę i wytwornica pary
- Przed każdym programem parowym napełnij zbiornik świeżą, zimną wodą. Jeśli to możliwe, używaj wody miękkiej lub filtrowanej.
- Po użyciu opróżnij i osusz zbiornik.
- Gdy wyświetlacz pokaże „Odkamień”, mniej więcej co 30 programów parowych, odkamień wytwornicę pary jedną butelką odkamieniacza Northstar (zestaw do odkamieniania PRD-COFFEE-7), uruchamiając program „Odkamienianie” w menu konserwacji.

## Komunikat „Napełnij zbiornik”, choć zbiornik jest pełny
1. Wyjmij zbiornik i sprawdź, czy pływak w środku porusza się swobodnie.
2. Przetrzyj suchą ściereczką dwa metalowe styki z tyłu zbiornika i w gnieździe zbiornika.
3. Wsuń zbiornik zdecydowanie, aż się zatrzaśnie.
4. Jeśli komunikat nie znika, odkamień wytwornicę pary; kamień na czujniku poziomu daje fałszywy odczyt „pusty”.
Jeśli komunikat nadal się pojawia, wyślij do obsługi klienta zdjęcia zbiornika i wyświetlacza; uszkodzony czujnik poziomu naprawia serwis.

## Kody błędów
- H1: usterka grzania. Piekarnik przestaje grzać w trakcie programu. Wyłącz go i odłącz od zasilania na 10 minut. Jeśli H1 wraca, przestań używać piekarnika i załóż sprawę serwisową. H1 wskazuje na grzałkę (część SC30-HE-01) albo płytę sterującą (część SC30-CB-02). Obie części wymienia wyłącznie centrum serwisowe.
- H2: za wysoka temperatura komory. Wentylator automatycznie schładza piekarnik; poczekaj, aż H2 zniknie, i nie zasłaniaj otworów wentylacyjnych na górze.
- W1: brak zbiornika na wodę.
- D1: niedomknięte drzwiczki.

## Naprawy w centrum serwisowym
Piekarniki odbiera kurier, a naprawa odbywa się w centrum serwisowym Northstar. Standardowy czas naprawy to 10 dni roboczych od odbioru. Jeśli trzeba zamówić część, centrum serwisowe podaje klientowi przewidywany termin, a sprawa ma status „w naprawie”. Przekroczenie obiecanego terminu obsługuje się zgodnie z procedurą reklamacyjną (DOC-complaint-handling).

## Czyszczenie
Po ostygnięciu przetrzyj komorę wilgotną ściereczką. Raz w tygodniu uruchom program „Czyszczenie parą”. Nie używaj sprayów do piekarników na wlocie pary.`,
  },
  {
    id: 'DOC-smart-wifi-connectivity',
    title: 'Łączność Wi-Fi urządzeń inteligentnych Northstar',
    body: `## Których urządzeń dotyczy
Poradnik dotyczy problemów z Wi-Fi i połączeniem z aplikacją w urządzeniach Northstar Home Hub, Home Hub Classic, SmartPlug Duo, termostacie ClimaSense, czujniku LeakGuard, oczyszczaczu PureAir 500 Smart i robocie sprzątającym RoboClean R5. LeakGuard łączy się przez Home Hub (Zigbee), a nie bezpośrednio z Wi-Fi.

## Wymagania sieci
- Wszystkie urządzenia inteligentne Northstar działają wyłącznie w sieci Wi-Fi 2,4 GHz. Jeśli router nadaje jedną nazwę dla 2,4 i 5 GHz, na czas konfiguracji włącz osobną sieć 2,4 GHz albo wyłącz funkcję band steering.
- Zabezpieczenie WPA2 lub WPA3. Sieci ukryte i sieci z portalem logowania (hotele, akademiki) nie są obsługiwane.
- Podczas parowania telefon musi być w tej samej sieci, a aplikacja Northstar musi mieć dostęp do Bluetooth i lokalizacji.

## Po wymianie routera albo zmianie hasła Wi-Fi
Urządzenia pamiętają stare ustawienia sieci i pozostają offline. Zresetuj ustawienia sieci i sparuj urządzenie ponownie:
- Home Hub: przytrzymaj tylny przycisk przez 10 sekund, aż kontrolka zacznie migać na żółto.
- SmartPlug Duo: przytrzymaj przycisk na każdym gniazdku przez 6 sekund.
- PureAir 500 Smart: przytrzymaj przycisk Wi-Fi przez 5 sekund.
- RoboClean R5: przytrzymaj jednocześnie przyciski Home i Spot przez 5 sekund.
Następnie dodaj urządzenie ponownie w aplikacji opcją „Dodaj urządzenie”.

## Centrala offline po przerwie w dostawie prądu
Jeśli Home Hub pozostaje offline po przerwie w dostawie prądu, odłącz go od zasilania na 30 sekund. Jeśli nadal jest offline, uruchom tryb odzyskiwania: przytrzymaj tylny przycisk podczas podłączania zasilania. W ciągu 10 minut centrala przywróci ustawienia i podłączone urządzenia z kopii w chmurze.

## Urządzenie nie łączy się po aktualizacji aplikacji
1. Zaktualizuj aplikację do najnowszej wersji, wyloguj się i zaloguj ponownie.
2. Usuń urządzenie w aplikacji i dodaj je jeszcze raz.
3. Jeśli to nie pomaga, wyślij logi aplikacji (Ustawienia > Pomoc > Wyślij logi) i podaj numer sprawy serwisowej.

## Znany problem: Home Hub Classic i oprogramowanie 4.2
Część central Home Hub Classic po aktualizacji do wersji 4.2 kilka razy dziennie traci połączenie z Wi-Fi. Zespół produktowy bada problem. Home Hub Classic jest wycofany z produkcji; sprawy klientów, których to dotyczy, przekazuje się do zespołu produktowego z prośbą o poprawkę oprogramowania lub ofertę wymiany (DOC-support-escalation). Nie obiecuj terminu poprawki.

## Aktualizacje oprogramowania
Pozostaw włączone automatyczne aktualizacje. Oprogramowanie LeakGuard aktualizuje się przez Home Hub.`,
  },
]
