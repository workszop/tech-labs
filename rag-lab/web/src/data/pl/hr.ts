import type { CompanyDocument } from '../documents'

export const HR: CompanyDocument[] = [
  {
    id: 'hr-remote-work',
    folder: 'hr',
    title: 'Zasady pracy zdalnej',
    owner: 'People Operations',
    version: '4.0',
    effectiveDate: '2026-03-01',
    status: 'current',
    summary: 'Aktualne zasady pracy hybrydowej i w pełni zdalnej, godziny wspólnej pracy, praca z zagranicy i dodatek na biuro domowe.',
    content: `Zasady pracy zdalnej

Wersja 4.0, obowiązuje od 1 marca 2026 r. Ten dokument w całości zastępuje Zasady pracy zdalnej w wersji 2.1 z czerwca 2022 r.

Northstar stawia przede wszystkim na pracę hybrydową. Uważamy, że większość zadań da się dobrze wykonać z dowolnego miejsca, a wspólny czas w biurze daje najwięcej wtedy, gdy jest zaplanowany. W tym dokumencie opisujemy, skąd pracownicy mogą pracować, jak złożyć wniosek o pracę w pełni zdalną i jak Northstar pomaga urządzić biuro domowe.

Kogo dotyczą te zasady

Wszystkich pracowników Northstar Technologies, Inc. i spółek zależnych w Kanadzie i Irlandii, zatrudnionych w pełnym i niepełnym wymiarze czasu. Współpracowników kontraktowych obowiązują warunki ich umów.

Praca hybrydowa (model domyślny)

Każdy pracownik może pracować zdalnie do 4 dni w tygodniu. Zespół ustala co najmniej jeden wspólny dzień w biurze w tygodniu i sam go wybiera, żeby można było spotkać się osobiście. Nie ma dni obowiązkowej obecności w biurze wspólnych dla całej firmy. W modelu hybrydowym można pracować od pierwszego dnia zatrudnienia, bez okresu oczekiwania.

Praca w pełni zdalna

O pracę w pełni zdalną może wystąpić pracownik, którego stanowisko jest oznaczone w strukturze stanowisk jako dopuszczające pracę zdalną (dotyczy to większości stanowisk w inżynierii, produkcie, obsłudze klienta, finansach i sprzedaży). Warunki:

- co najmniej 6 miesięcy zatrudnienia w Northstar
- ocena „spełnia oczekiwania” lub wyższa w ostatniej ocenie okresowej
- zgoda przełożonego i Vice President działu

Wnioski składa się w PeopleHub, a odpowiedź przychodzi w ciągu 10 dni roboczych. Od osób pracujących w pełni zdalnie oczekujemy udziału w spotkaniach zespołu na żywo, do czterech razy w roku. Koszty dojazdu na te spotkania pokrywa Northstar zgodnie z dokumentem „Budżet podróży służbowych”.

Skąd można pracować

Pracownik musi mieszkać i na co dzień pracować w kraju, w którym Northstar ma spółkę: w Stanach Zjednoczonych, Kanadzie albo Irlandii. Przeprowadzkę do innego stanu, prowincji lub kraju trzeba wcześniej uzgodnić z People Operations, bo wpływa ona na rozliczanie wynagrodzeń i podatki.

Praca z zagranicy

Z innego kraju można pracować tymczasowo, do 30 dni kalendarzowych w roku kalendarzowym, za zgodą przełożonego. Wniosek trzeba złożyć co najmniej dwa tygodnie wcześniej. Do danych klientów nie wolno sięgać z krajów, które są na liście ograniczeń publikowanej przez zespół Security.

Godziny wspólnej pracy

Między 10:00 a 15:00 w strefie czasowej swojego biura macierzystego każdy powinien być dostępny na spotkania i krótkie pytania. Poza tymi godzinami grafik jest elastyczny, o ile praca jest wykonana, a zespół się na to zgadza.

Dodatek na biuro domowe

Żeby pracownik mógł urządzić sobie bezpieczne i wygodne miejsce pracy, Northstar zapewnia:

- jednorazowy dodatek na urządzenie biura domowego w wysokości 750 USD, na biurko, krzesło, monitor lub podobny sprzęt, do wykorzystania w ciągu pierwszych 60 dni zatrudnienia (albo w ciągu 60 dni od przejścia na pracę w pełni zdalną)
- miesięczny dodatek za pracę zdalną w wysokości 50 USD na internet i media, wypłacany automatycznie z wynagrodzeniem wszystkim pracownikom hybrydowym i w pełni zdalnym

Dodatek na urządzenie biura rozlicza się w Ledgerly na podstawie paragonów lub faktur, zgodnie z dokumentem „Zwrot wydatków”. Sprzęt kupiony z dodatku należy do pracownika. Laptopy służbowe i akcesoria wydane przez IT pozostają własnością Northstar.

Bezpieczeństwo w domu

W sieciach publicznych pracownik musi korzystać z firmowego VPN-u. Odchodząc od komputera, blokuje ekran, a system na laptopie aktualizuje na bieżąco. Poufnych rozmów nie należy prowadzić w miejscach publicznych.

Zmiany i wyjątki

Przełożony może poprosić pracownika o przyjazd do biura na konkretne wydarzenia, na przykład wdrożenie nowych osób, sesje planowania czy wizyty klientów, i uprzedza o tym co najmniej tydzień wcześniej. Wyjątki od tych zasad zatwierdza Head of People. Pytania należy kierować do People Operations na adres people@northstar.example.`,
  },
  {
    id: 'hr-remote-work-2022',
    folder: 'hr',
    title: 'Zasady pracy zdalnej (2022, nieaktualne)',
    owner: 'People Operations',
    version: '2.1',
    effectiveDate: '2022-06-01',
    status: 'outdated',
    summary: 'NIEAKTUALNE: zasady pracy zdalnej z 2022 r., z dwoma dniami zdalnymi w tygodniu i dodatkiem 300 USD. Zastąpione wersją 4.0 w marcu 2026 r.',
    content: `NIEAKTUALNE – NIE STOSOWAĆ. Ten dokument został zastąpiony przez Zasady pracy zdalnej w wersji 4.0, obowiązujące od 1 marca 2026 r. Pozostaje w archiwum wyłącznie do wglądu.

Zasady pracy zdalnej

Wersja 2.1, obowiązuje od 1 czerwca 2022 r. Zatwierdzili: Head of People i Chief Operating Officer.

Northstar wraca do biura po okresie pandemii. Ten dokument określa ograniczone warunki, na jakich pracownicy mogą pracować zdalnie. Chcemy odbudować współpracę na miejscu i zostawić trochę swobody na pracę wymagającą skupienia.

Kogo dotyczą te zasady

Wszystkich pracowników Northstar Technologies, Inc. zatrudnionych w pełnym wymiarze czasu. Osoby zatrudnione w niepełnym wymiarze i stażyści pracują z biura, chyba że przełożony pisemnie zgodzi się na coś innego.

Obecność w biurze

Pracownicy pracują z przydzielonego biura co najmniej 3 dni w tygodniu. Wtorek i czwartek to dni stałe dla całej firmy, w które każdy pracownik musi być w biurze. Trzeci dzień w biurze ustala się z przełożonym.

Dni zdalne

Zdalnie można pracować najwyżej 2 dni w tygodniu. Dni zdalnych nie można kumulować ani przenosić na kolejny tydzień. Pracę zdalną w danym tygodniu trzeba uzgodnić z przełożonym co najmniej dwa tygodnie wcześniej i wpisać do kalendarza zespołu.

Nowi pracownicy

Przez 90-dniowy okres próbny nowi pracownicy pracują wyłącznie z biura. Dni zdalne przysługują dopiero po pomyślnym zakończeniu okresu próbnego.

Praca w pełni zdalna

Firma nie oferuje pracy w pełni zdalnej. Wyjątkiem jest tymczasowe ułatwienie z powodów zdrowotnych lub rodzinnych, które zatwierdza People Operations, najdłużej na trzy miesiące.

Miejsce pracy

Pracę zdalną wykonuje się pod adresem zamieszkania zapisanym w systemie kadrowym. Praca z innego kraju jest niedozwolona. Praca z innego miasta w tym samym kraju wymaga zgody przełożonego.

Godziny pracy

Osoby pracujące zdalnie muszą być dostępne w standardowych godzinach pracy, od 09:00 do 17:30 czasu lokalnego biura, i w tych godzinach odpowiadać na wiadomości w ciągu 30 minut.

Sprzęt i dodatek

Northstar wypłaca jednorazowy dodatek na biuro domowe w wysokości 300 USD na krzesło lub monitor, dostępny po okresie próbnym. Nie ma miesięcznego dodatku na internet ani media, te koszty ponosi pracownik. Paragony lub faktury trzeba przesłać w systemie rozliczania wydatków w ciągu 30 dni od zakupu.

Bezpieczeństwo

Podczas pracy zdalnej trzeba przez cały czas korzystać z firmowego VPN-u. Poufnych dokumentów nie wolno drukować w domu.

Cofnięcie pracy zdalnej

Przełożony może w każdej chwili zawiesić dni zdalne pracownika, jeśli jego wyniki albo szybkość odpowiadania spadną poniżej oczekiwań. Powtarzające się naruszenia tych zasad mogą skończyć się postępowaniem dyscyplinarnym.

Przegląd

Zasady zostaną poddane przeglądowi w czerwcu 2023 r.

Pytania należy kierować do People Operations.`,
  },
  {
    id: 'hr-employee-benefits',
    folder: 'hr',
    title: 'Świadczenia pracownicze',
    owner: 'Total Rewards',
    version: '2026.1',
    effectiveDate: '2026-01-01',
    status: 'current',
    summary: 'Ubezpieczenie zdrowotne, dopłaty do planów emerytalnych, budżety na naukę i zdrowie oraz pozostałe świadczenia na 2026 r.',
    content: `Świadczenia pracownicze

Ten przewodnik zbiera świadczenia, które Northstar oferuje pracownikom w 2026 r. Rok planu trwa od 1 stycznia do 31 grudnia 2026 r. Pełne dokumenty planów są w PeopleHub. Jeśli to zestawienie różni się od dokumentu planu, obowiązuje dokument planu.

Kto ma prawo do świadczeń

Świadczenia przysługują od pierwszego dnia zatrudnienia pracownikom pełnoetatowym oraz zatrudnionym w niepełnym wymiarze, którzy pracują co najmniej 30 godzin tygodniowo. Nowi pracownicy muszą zapisać się w ciągu 30 dni od daty rozpoczęcia pracy. Poza okresem otwartych zapisów (co roku w listopadzie) zmiany są możliwe tylko po ważnym zdarzeniu życiowym, takim jak ślub, narodziny dziecka lub adopcja.

Ubezpieczenie zdrowotne (Stany Zjednoczone)

- Opieka medyczna: trzy plany (PPO, HMO i plan z wysokim udziałem własnym połączony z kontem HSA). Northstar opłaca 90% składki pracownika i 75% składki za osoby na jego utrzymaniu.
- Wpłata na HSA: w planie z wysokim udziałem własnym Northstar wpłaca 1000 USD rocznie dla osoby indywidualnej i 2000 USD dla rodziny.
- Opieka dentystyczna i okulistyczna: Northstar opłaca 100% składki pracownika i 75% składki za osoby na jego utrzymaniu.

Pracownicy w Kanadzie i Irlandii mają równoważne prywatne ubezpieczenie zdrowotne u lokalnych ubezpieczycieli. Opisują je załączniki krajowe.

Emerytura

- Stany Zjednoczone: plan 401(k), w którym firma dopłaca 100% wpłat pracownika do wysokości 4% wynagrodzenia zasadniczego. Dopłaty firmy od razu należą do pracownika.
- Kanada: dopłata do RRSP do 4% wynagrodzenia zasadniczego.
- Irlandia: składka emerytalna pracodawcy w wysokości 5% wynagrodzenia zasadniczego.

Ubezpieczenia

Firma bezpłatnie zapewnia ubezpieczenie na życie na sumę równą 2-krotności rocznego wynagrodzenia zasadniczego oraz ubezpieczenie od długotrwałej niezdolności do pracy, które pokrywa 60% wynagrodzenia. Pracownik może dokupić dodatkowe ubezpieczenie na życie dla siebie i rodziny.

Nauka i rozwój

Każdy pracownik ma roczny budżet na naukę w wysokości 1500 USD na kursy, certyfikaty, konferencje i książki. Niewykorzystany budżet nie przechodzi na kolejny rok. Wydatki powyżej 500 USD wymagają wcześniejszej zgody przełożonego. Wyjazdy na konferencje opłacane z budżetu na naukę podlegają dokumentowi „Budżet podróży służbowych”.

Zdrowie i kondycja

Pracownicy dostają dodatek na zdrowie i kondycję w wysokości 50 USD miesięcznie (600 USD rocznie) na karnet na siłownię, zajęcia sportowe, sprzęt sportowy lub aplikacje wspierające zdrowie psychiczne. Rozlicza się go w Ledgerly na podstawie paragonu lub faktury.

Program wsparcia pracowników

Poufny program wsparcia pracowników (Employee Assistance Program) obejmuje bezpłatne krótkoterminowe konsultacje psychologiczne (do 8 sesji na jeden problem) oraz porady prawne i finansowe. Jest dostępny 24/7 dla pracowników i ich domowników.

Czas wolny i świadczenia rodzinne

Płatny urlop wypoczynkowy, zwolnienia chorobowe, urlop rodzicielski, urlop z powodu żałoby i urlop sabbatical opisują „Zasady urlopowe”. Oprócz tego Northstar zwraca do 10 000 USD na dziecko z kosztów adopcji lub surogacji i oferuje świadczenie na leczenie niepłodności z limitem 15 000 USD na cały okres zatrudnienia.

Wsparcie pracy zdalnej

Pracownicy hybrydowi i w pełni zdalni dostają miesięczny dodatek za pracę zdalną w wysokości 50 USD i jednorazowy dodatek na urządzenie biura domowego w wysokości 750 USD. Opisują to „Zasady pracy zdalnej”.

Inne korzyści

- Dojazdy do pracy: komunikacja publiczna i parking opłacane z kwoty przed opodatkowaniem, do miesięcznego limitu IRS.
- Premia za polecenie pracownika: 3000 USD za każdą zatrudnioną osobę z polecenia, po 90 dniach jej zatrudnienia.
- Lunch na koszt firmy w dni pracy w biurze w Denver, Austin, Toronto i Dublinie.
- Zniżkowe licencje Northstar Enterprise dla zarejestrowanych organizacji non profit, w których pracownicy są wolontariuszami.

Pytania

Napisz do zespołu Total Rewards na adres benefits@northstar.example albo utwórz zgłoszenie w PeopleHub w kategorii „Benefits”.`,
  },
  {
    id: 'hr-onboarding-guide',
    folder: 'hr',
    title: 'Przewodnik wdrożeniowy',
    owner: 'People Operations',
    version: '3.3',
    effectiveDate: '2026-02-15',
    status: 'current',
    summary: 'Czego nowy pracownik może się spodziewać przez pierwsze 90 dni: dostawa laptopa, terminy szkoleń i opiekun wdrożenia.',
    content: `Przewodnik wdrożeniowy

Witamy w Northstar Technologies. Ten przewodnik opisuje, co dzieje się przed Twoim pierwszym dniem i przez pierwsze 90 dni pracy. Miej go pod ręką, bo odpowiada na większość pytań, które zadają nowi pracownicy.

Przed pierwszym dniem

- Masz podpisaną ofertę, a weryfikacja Twojej historii zawodowej jest zakończona.
- IT wysyła laptop tak, żeby dotarł co najmniej 5 dni roboczych przed datą rozpoczęcia pracy. Osoby pracujące w biurze mogą zamiast tego odebrać go pierwszego dnia w recepcji.
- Dostajesz zaproszenie do PeopleHub, naszego systemu kadrowego. Wypełniasz tam formularze podatkowe, podajesz dane rachunku bankowego i zapisujesz się do świadczeń. Zapisy do świadczeń trzeba zakończyć w ciągu 30 dni od daty rozpoczęcia pracy.
- Przełożony przydziela Ci opiekuna wdrożenia, czyli osobę z innego zespołu, która pomoże Ci się odnaleźć.

Pierwszy dzień

Nowi pracownicy zaczynają w poniedziałek. Dzień rozpoczyna się o 09:30 czasu lokalnego spotkaniem powitalnym, które prowadzi People Operations (na miejscu w Denver, Austin, Toronto lub Dublinie albo przez wideo dla osób zdalnych). Po południu spotkasz się z przełożonym i omówicie Twój plan 30-60-90 dni.

Gdzie pracujesz

W modelu hybrydowym możesz pracować od pierwszego dnia: do 4 dni zdalnych w tygodniu, tak jak opisują to aktualne „Zasady pracy zdalnej”. Niektóre zespoły proszą nowe osoby, żeby pierwsze dwa tygodnie spędziły w biurze i poznały współpracowników. Przełożony powie Ci, czy to dotyczy Twojego zespołu. Jeśli planujesz wystąpić o pracę w pełni zdalną, będzie to możliwe po 6 miesiącach zatrudnienia.

Dodatek na urządzenie biura domowego w wysokości 750 USD trzeba rozliczyć w ciągu pierwszych 60 dni w Ledgerly, narzędziu do rozliczania wydatków.

Obowiązkowe szkolenia

Te kursy trzeba ukończyć na platformie szkoleniowej:

- Świadomość bezpieczeństwa i dopuszczalne użytkowanie: w ciągu 14 dni
- Kodeks postępowania i przeciwdziałanie nękaniu: w ciągu 14 dni
- Ochrona danych osobowych (podstawy GDPR i CCPA): w ciągu 30 dni
- Podstawy produktów (Beacon, Relay, Vault i Pulse): w ciągu 30 dni

Dostęp do danych klientów dostaniesz dopiero po ukończeniu kursów o bezpieczeństwie i ochronie danych.

Plan 30-60-90 dni

- Pierwsze 30 dni: poznajesz produkty, zespół i najważniejszych partnerów, kończysz szkolenia.
- Dni od 31 do 60: przejmujesz pierwsze projekty lub klientów, ze wsparciem zespołu.
- Dni od 61 do 90: pracujesz samodzielnie i uzgadniasz cele na resztę roku.

Na koniec każdego etapu przełożony umawia z Tobą rozmowę podsumowującą. Pierwsze 90 dni to także Twój okres wstępny. Po nim razem z przełożonym przeprowadzacie krótką ocenę.

Narzędzia, z których będziesz korzystać

Slack do rozmów, Google Workspace do poczty i dokumentów, PeopleHub do spraw kadrowych i urlopów, Ledgerly do wydatków, TravelDesk do podróży służbowych i Beacon do firmowych dashboardów.

Zgłaszanie zastrzeżeń

Jeśli podczas wdrożenia coś jest nie tak, na przykład oczekiwania są niejasne, masz konflikt ze współpracownikiem albo widzisz zachowanie sprzeczne z Kodeksem postępowania, chcemy o tym wiedzieć. Zacznij od przełożonego. Jeśli nie czujesz się z tym swobodnie albo sprawa nie zostanie rozwiązana w ciągu 5 dni roboczych, eskaluj ją do swojego HR Business Partnera. Poważne sprawy możesz w każdej chwili zgłosić do Head of People albo anonimowo przez Ethics Hotline. Northstar nie toleruje działań odwetowych wobec osób, które zgłaszają zastrzeżenia w dobrej wierze.

Gdzie szukać pomocy

- Sprawy kadrowe: People Operations, people@northstar.example
- Laptop i konta: IT Help Desk, kanał #it-help na Slacku
- Wynagrodzenia: payroll@northstar.example

Cieszymy się, że jesteś z nami.`,
  },
  {
    id: 'hr-leave-policy',
    folder: 'hr',
    title: 'Zasady urlopowe',
    owner: 'People Operations',
    version: '6.1',
    effectiveDate: '2026-01-01',
    status: 'current',
    summary: 'Płatny urlop wypoczynkowy, dni chorobowe, święta, urlop rodzicielski i inne urlopy oraz sposób składania i zatwierdzania wniosków.',
    content: `Zasady urlopowe

Ten dokument opisuje rodzaje płatnych i bezpłatnych urlopów dostępnych dla pracowników Northstar oraz sposób składania wniosków. Obowiązuje od 1 stycznia 2026 r. Prawo lokalne w Kanadzie i Irlandii może dawać dodatkowe uprawnienia. Jeśli jest korzystniejsze dla pracownika, stosuje się prawo lokalne.

Płatny urlop wypoczynkowy (PTO)

- Pracownicy ze stażem krótszym niż 3 lata: 20 dni urlopu w roku kalendarzowym.
- Pracownicy ze stażem 3 lat lub dłuższym: 25 dni urlopu w roku kalendarzowym.

Urlop nalicza się co miesiąc (około 1,67 dnia miesięcznie przy 20 dniach). Na kolejny rok można przenieść do 5 niewykorzystanych dni i trzeba je wykorzystać do 31 marca. Przeniesione dni, których pracownik nie wykorzysta, przepadają, chyba że prawo lokalne wymaga wypłaty ekwiwalentu.

Dni wolne od pracy

Pracownicy w Stanach Zjednoczonych mają 11 płatnych dni wolnych w roku. Ich listę firma publikuje w PeopleHub co roku w grudniu. W Kanadzie i Irlandii obowiązują lokalne kalendarze dni ustawowo wolnych od pracy. Jeśli święto wypada w czasie urlopu, nie liczy się jako dzień urlopu.

Zwolnienie chorobowe

Pracownikom przysługuje 10 płatnych dni chorobowych w roku, niezależnie od urlopu wypoczynkowego. Zaświadczenie lekarskie jest potrzebne tylko przy nieobecności dłuższej niż 3 kolejne dni robocze. Dni chorobowe nie przechodzą na kolejny rok.

Urlop rodzicielski

Rodzic, który urodził dziecko, i drugi rodzic, w tym rodzice adopcyjni i zastępczy, dostają 16 tygodni w pełni płatnego urlopu rodzicielskiego do wykorzystania w ciągu 12 miesięcy od narodzin dziecka lub przyjęcia go do rodziny. Rodzicowi, który urodził dziecko, może przysługiwać dodatkowe zwolnienie z tytułu krótkotrwałej niezdolności do pracy. Po urlopie rodzicielskim można wracać do pracy stopniowo: do 4 tygodni w wymiarze 60% czasu pracy przy pełnym wynagrodzeniu.

Inne płatne urlopy

- Żałoba: 5 dni w przypadku najbliższej rodziny, 3 dni w przypadku dalszej rodziny.
- Obowiązki ławnika przysięgłego: płatne przez cały czas pełnienia obowiązków.
- Wolontariat: 2 dni w roku na wolontariat w zarejestrowanych organizacjach charytatywnych.
- Sabbatical: 4 tygodnie płatnego urlopu po każdych 5 latach nieprzerwanego zatrudnienia, do wykorzystania w ciągu kolejnych 12 miesięcy.

Urlop bezpłatny

Z powodów osobistych można dostać urlop bezpłatny do 3 miesięcy, za zgodą przełożonego i HR Business Partnera. Świadczenia są utrzymane podczas urlopu bezpłatnego trwającego do 30 dni.

Jak złożyć wniosek

Wszystkie wnioski urlopowe składa się w PeopleHub.

- Urlop wypoczynkowy na 1 lub 2 dni: wniosek co najmniej 2 dni robocze wcześniej.
- Urlop na 3 lub więcej kolejnych dni: wniosek co najmniej 2 tygodnie wcześniej.
- Urlop rodzicielski i sabbatical: wniosek w miarę możliwości co najmniej 8 tygodni wcześniej.
- Zwolnienie chorobowe zgłasza się pierwszego dnia nieobecności albo tak szybko, jak to możliwe.

Zatwierdzanie

Przełożony zatwierdza lub odrzuca wniosek urlopowy w ciągu 3 dni roboczych. Wniosek bez odpowiedzi po 3 dniach roboczych jest automatycznie eskalowany do przełożonego wyższego szczebla. Urlop wypoczynkowy można odrzucić tylko z przyczyn biznesowych, na przykład gdy kilka osób z zespołu ma już wolne albo zbliża się ważny termin, a przełożony musi wtedy zaproponować inne daty. Zatwierdzony urlop Northstar może odwołać tylko w wyjątkowych okolicznościach i zwraca wtedy bezzwrotne koszty podróży.

Spory dotyczące urlopu

Jeśli uważasz, że wniosek urlopowy odrzucono niesłusznie, najpierw porozmawiaj z przełożonym. Jeśli to nie rozwiąże sprawy, możesz w ciągu 10 dni roboczych od decyzji eskalować ją pisemnie do swojego HR Business Partnera. HR Business Partner analizuje sprawę i odpowiada w ciągu 5 dni roboczych. W ostatnim kroku sprawę można eskalować do Head of People, którego decyzja jest ostateczna.

Ewidencja urlopów

Pracownik odpowiada za aktualność swojego kalendarza w PeopleHub i za ustawienie automatycznej odpowiedzi o nieobecności. Pytania należy kierować do People Operations na adres people@northstar.example.`,
  },
]
