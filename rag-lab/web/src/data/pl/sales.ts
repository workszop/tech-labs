import type { CompanyDocument } from '../documents'

export const SALES: CompanyDocument[] = [
  {
    id: 'sales-pricing-policy',
    folder: 'sales',
    title: 'Polityka cenowa',
    owner: 'Revenue Operations',
    version: '5.2',
    effectiveDate: '2026-01-15',
    status: 'current',
    summary: 'Ceny katalogowe planów Starter, Professional i Enterprise, warunki rozliczeń oraz to, kto może zmienić cenę.',
    content: `Polityka cenowa

Ten dokument ustala ceny katalogowe subskrypcji Northstar Technologies i zasady, których przy przygotowywaniu ofert przestrzega każdy sprzedawca, partner i specjalista ds. rozliczeń. Obowiązuje dla wszystkich nowych umów, odnowień i rozszerzeń podpisanych od 15 stycznia 2026 r. Ceny są podane w dolarach amerykańskich i nie zawierają podatku od sprzedaży ani VAT.

Plany i ceny katalogowe

Northstar sprzedaje trzy plany subskrypcji. Ceny podajemy za użytkownika miesięcznie przy rozliczeniu rocznym.

- Starter: 19 USD za użytkownika miesięcznie. Dla zespołów do 25 użytkowników. Obejmuje Northstar Beacon (analityka) i Northstar Vault (dokumenty) z funkcjami standardowymi. Bez dostępu do API.
- Professional: 49 USD za użytkownika miesięcznie. Bez limitu użytkowników. Obejmuje Beacon, Northstar Relay (automatyzacja procesów) i Vault oraz dostęp do REST API.
- Enterprise: 89 USD za użytkownika miesięcznie, minimum 50 użytkowników. Obejmuje wszystko z planu Professional, a do tego SSO i provisioning SCIM, logi audytowe, przechowywanie danych w USA lub UE oraz Premium Support.

Northstar Pulse, nasz produkt do ankiet wśród klientów, sprzedajemy jako dodatek do dowolnego planu w cenie 9 USD za użytkownika miesięcznie.

Rozliczenie miesięczne

Plany Starter i Professional można też rozliczać miesięcznie, z dopłatą 15% do ceny rocznej: 22 USD za użytkownika miesięcznie w planie Starter i 56 USD za użytkownika miesięcznie w planie Professional. Plan Enterprise sprzedajemy wyłącznie w umowach rocznych. Subskrypcje miesięczne odnawiają się automatycznie i można je anulować w dowolnym momencie, ze skutkiem na koniec bieżącego miesiąca rozliczeniowego.

Bezpłatny okres próbny i proof of concept

Każdy nowy potencjalny klient może zacząć 14-dniowy bezpłatny okres próbny planu Professional bez podawania karty kredytowej. Potencjalnym klientom Enterprise, którzy potrzebują dłuższej oceny, można zaproponować 30-dniowy proof of concept (PoC), zatwierdzany przez Regional Sales Director zgodnie z dokumentem „Podręcznik sprzedaży”.

Kto może zmienić cenę

Ceny katalogowe ustala zespół Revenue Operations, a zatwierdza Chief Revenue Officer. Sprzedawcy nie mogą tworzyć nowych planów, dołączać do pakietu produktów spoza cennika ani zmieniać ceny za użytkownika inaczej niż przez zatwierdzony rabat. Opiekun klienta (AE) może samodzielnie udzielić rabatu do łącznej wysokości 10%. Każdy rabat powyżej 10%, każdy rabat za umowę wieloletnią i każdy rabat ilościowy wymaga akceptacji zgodnie z macierzą z dokumentu „Rabaty dla klientów Enterprise”. Żadne połączenie rabatów nie może przekroczyć 35% ceny katalogowej.

Organizacje non-profit i edukacyjne mają stały rabat 20% na plany Starter i Professional, który nie wymaga dodatkowej akceptacji. Northstar Startup Program daje uprawnionym firmom (działającym krócej niż dwa lata i zatrudniającym mniej niż 20 pracowników) 50% zniżki na pierwszy rok planu Starter lub Professional.

Podwyżki cen przy odnowieniu

Dotychczasowych klientów podwyżki cen katalogowych nie obejmują do końca bieżącej umowy. Przy odnowieniu Northstar może podnieść cenę klientom Enterprise najwyżej o 7% rocznie, chyba że umowa klienta ustala własny limit podwyżek. O każdej podwyżce przy odnowieniu trzeba powiadomić klienta co najmniej 60 dni przed datą odnowienia.

Zwroty i anulowanie

Oferty muszą odwoływać się do aktualnego dokumentu „Zasady zwrotów”, za który odpowiada zespół Customer Support. W skrócie: za plan roczny zwracamy całą kwotę w ciągu 30 dni od pierwszego zakupu, a w planie miesięcznym nie zwracamy pieniędzy za niepełne miesiące. Sprzedawcy nie mogą obiecywać zwrotów, kredytów ani praw do anulowania, które wykraczają poza „Zasady zwrotów”. Każdy wyjątek wymaga pisemnej zgody Finance Controller.

Warunki płatności

Standardowy termin płatności dla klientów to 30 dni od daty faktury. Przyjmujemy płatności kartą kredytową, przelewem ACH i przelewem bankowym (wire). Szczegóły fakturowania i zasady dotyczące opóźnionych płatności opisuje dokument „Obsługa faktur”, za który odpowiada dział Finance.

Pytania dotyczące tej polityki kieruj do zespołu Revenue Operations na kanale #revops.`,
  },
  {
    id: 'sales-enterprise-discounts',
    folder: 'sales',
    title: 'Rabaty dla klientów Enterprise',
    owner: 'Deal Desk',
    version: '3.4',
    effectiveDate: '2026-01-15',
    status: 'current',
    summary: 'Progi rabatów ilościowych i wieloletnich w transakcjach Enterprise oraz macierz akceptacji dla każdego poziomu rabatu.',
    content: `Rabaty dla klientów Enterprise

Ten dokument wyjaśnia, jakie rabaty Northstar oferuje klientom Enterprise, jak rabaty się łączą i kto musi je zatwierdzić. Uzupełnia dokument „Polityka cenowa”, który ustala ceny katalogowe. Cena katalogowa planu Enterprise to 89 USD za użytkownika miesięcznie przy rozliczeniu rocznym, minimum 50 użytkowników.

Rabaty ilościowe

Klienci Enterprise dostają rabat ilościowy zależny od liczby licencji, do których zobowiązują się przy podpisaniu umowy:

- od 50 do 99 licencji: bez rabatu ilościowego (cena katalogowa)
- od 100 do 249 licencji: 10%
- od 250 do 499 licencji: 15%
- od 500 do 999 licencji: 20%
- 1000 licencji lub więcej: 25%

Licencje dokupione w trakcie umowy wyceniamy z tym samym rabatem co licencje pierwotne, proporcjonalnie do daty końca umowy. Klient, który w trakcie umowy urośnie do wyższego progu, dostaje nowy próg przy odnowieniu, a nie wstecznie.

Rabaty za umowę wieloletnią

Klienci, którzy podpisują umowę wieloletnią z płatnościami rocznymi, dostają dodatkowy rabat:

- umowa na 2 lata: 5%
- umowa na 3 lata: 10%

Opłacenie z góry całego okresu umowy wieloletniej nie daje dodatkowego rabatu, ale może być argumentem w negocjacjach, które ocenia Deal Desk.

Jak łączą się rabaty

Rabat ilościowy i rabat za umowę wieloletnią dodaje się do siebie, a nie mnoży. Przykład: klient z 600 licencjami i umową na 3 lata dostaje 20% plus 10%, czyli łącznie 30% rabatu od ceny katalogowej. Sztywny limit dla każdego połączenia rabatów to 35% ceny katalogowej. Limit obowiązuje w każdej transakcji Northstar, także przy rabatach na dodatek Pulse. Rabaty dla organizacji non-profit i z programu Startup Program, opisane w dokumencie „Polityka cenowa”, nie mają zastosowania do umów Enterprise.

Macierz akceptacji

Łączny rabat w transakcji decyduje o tym, kto musi go zatwierdzić w CRM przed wysłaniem oferty:

- do 10%: opiekun klienta (AE), bez dodatkowej akceptacji
- od 11 do 20%: Regional Sales Director
- od 21 do 30%: Vice President of Sales
- od 31 do 35%: Chief Financial Officer razem z Chief Revenue Officer, po weryfikacji przez Deal Desk
- powyżej 35%: niedozwolone

Standardowe rabaty ilościowe i wieloletnie też wymagają akceptacji osoby właściwej dla łącznego rabatu. Transakcja z rabatem 30% złożonym wyłącznie ze standardowych progów wymaga zgody VP of Sales tak samo jak transakcja z wynegocjowanym rabatem 30%.

Ustępstwa pozacenowe

Niektóre ustępstwa liczą się jako rabat, choć nie zmieniają ceny za użytkownika. Bezpłatne miesiące, dodatkowe bezpłatne licencje, rezygnację z opłat wdrożeniowych i bezpłatne przedłużenie pilotażu trzeba przeliczyć na równoważny procent i doliczyć do łącznego rabatu. Premium Support jest już wliczony w plan Enterprise i nie można go oferować jako ustępstwa.

Transakcje z etapowym wdrożeniem

Klientom, którzy wdrażają produkt etapami, Deal Desk może zatwierdzić harmonogram, w którym liczba licencji objętych zobowiązaniem rośnie przez pierwsze 12 miesięcy. Próg rabatu ilościowego wynika z docelowej liczby licencji, ale efektywny rabat w pierwszym roku nie może przekroczyć limitu 35%.

Ograniczenia rabatów przy odnowieniu

Rabaty nie przechodzą automatycznie na kolejny okres. Przy odnowieniu opiekun klienta musi ponownie uzasadnić każdy rabat wyższy niż standardowe progi ilościowe i wieloletnie. Deal Desk dąży do tego, żeby przy każdym odnowieniu obniżać rabaty niestandardowe o co najmniej 5 punktów procentowych.

Dokumentowanie rabatu

Każdy rabat powyżej 10% wymaga krótkiego uzasadnienia biznesowego w rekordzie szansy sprzedaży: sytuacja konkurencyjna, wartość strategiczna i spodziewana rozbudowa umowy. Transakcje zgłoszone bez uzasadnienia Deal Desk odsyła w ciągu jednego dnia roboczego. Standardowe wnioski Deal Desk rozpatruje w ciągu dwóch dni roboczych, a wnioski o rabat powyżej 30% w ciągu pięciu dni roboczych.

Pytania i prośby o weryfikację kieruj do Deal Desk na adres dealdesk@northstar.example.`,
  },
  {
    id: 'sales-playbook',
    folder: 'sales',
    title: 'Podręcznik sprzedaży',
    owner: 'Sales Enablement',
    version: '2026.2',
    effectiveDate: '2026-04-01',
    status: 'current',
    summary: 'Jak Northstar prowadzi transakcję od pierwszej rozmowy do podpisu: prezentacje, proof of concept i wizyty u klienta.',
    content: `Podręcznik sprzedaży

Ten podręcznik opisuje, jak sprzedawcy Northstar prowadzą szansę sprzedaży od pierwszego kontaktu do podpisanej umowy. Korzystają z niego nowi opiekunowie klienta (AE), Sales Development Representatives i Solutions Engineers. Zasad cenowych i rabatowych tu nie powtarzamy, są w dokumentach „Polityka cenowa” i „Rabaty dla klientów Enterprise”.

Etapy lejka sprzedaży

- Etap 1, rozpoznanie potrzeb: odbyło się pierwsze spotkanie, znamy problemy klienta i osoby zaangażowane w decyzję.
- Etap 2, kwalifikacja: szansa spełnia nasze kryteria MEDDICC (mierniki, decydent budżetowy, kryteria decyzji, proces decyzyjny, rozpoznany problem, sojusznik po stronie klienta, konkurencja).
- Etap 3, rozwiązanie: prezentacja przeprowadzona, uzgodniony okres próbny lub proof of concept.
- Etap 4, oferta: oferta wysłana z zatwierdzonymi cenami.
- Etap 5, negocjacje: weryfikacja prawna i zakupowa po stronie klienta.
- Etap 6, transakcja wygrana lub przegrana (Closed Won lub Closed Lost).

Szansa nie może wyjść poza etap 2, dopóki w CRM nie ma wpisanego decydenta budżetowego i procesu decyzyjnego.

Rozpoznanie potrzeb

Na tym etapie chodzi o zrozumienie problemu biznesowego, a nie o prezentowanie funkcji. Zapytaj, jak zespół raportuje dziś swoje dane, jakich narzędzi używa do przenoszenia danych między systemami oraz jak zbiera podpisy i akceptacje. Te pytania odpowiadają wprost produktom Beacon, Relay i Vault. Zawsze zapytaj też, czy firma prowadzi ankiety wśród klientów, bo to punkt wyjścia do rozmowy o dodatku Pulse.

Prezentacje

Solutions Engineers prowadzą prezentacje dopasowane do klienta: używają jego terminologii i, jeśli to możliwe, próbki jego danych. Po etapie 2 unikaj prezentacji ogólnych. Dobra prezentacja pokazuje jeden proces od początku do końca, na przykład automatyzację w Relay, która pobiera dane z CRM do dashboardu w Beacon i wysyła umowę do podpisu przez Vault.

Okresy próbne i proof of concept

Potencjalni klienci samoobsługowi dostają 14-dniowy okres próbny planu Professional. Potencjalni klienci Enterprise mogą dostać 30-dniowy proof of concept (PoC) z pisemnymi kryteriami sukcesu uzgodnionymi przed startem. Każdy PoC musi zatwierdzić Regional Sales Director. PoC bez kryteriów sukcesu traktujemy jak bezpłatny pilotaż i liczymy jako ustępstwo rabatowe.

Wizyty u klienta

Spotkania osobiste wyraźnie poprawiają skuteczność sprzedaży w dużych transakcjach. Opiekun klienta może zaplanować wizytę u klienta lub potencjalnego klienta, gdy szansa jest na etapie 3 lub dalszym, a spodziewana roczna wartość umowy przekracza 150 000 USD. Wizyty przy mniejszych szansach wymagają zgody Regional Sales Director.

Wizyty u klienta obciążają budżet podróży działu Sales. Rezerwuj loty i hotele przez TravelDesk i stosuj dokument „Budżet podróży służbowych”, łącznie z limitami na hotele i stawkami diet. Wizyty u klientów nie mają osobnego, wyższego limitu. Posiłki i spotkania towarzyskie z klientem podczas wizyty rozliczasz według dokumentu „Zwrot wydatków”, z limitem 100 USD na uczestnika. Na każdą wizytę z warsztatami technicznymi zabierz Solutions Engineer.

Przed wizytą wyślij klientowi agendę co najmniej trzy dni robocze wcześniej. Po wizycie w ciągu 24 godzin zapisz w CRM notatki i następne kroki.

Odpowiadanie na obiekcje

- Cena: opieraj rozmowę na wartości biznesowej i całkowitym koszcie posiadania. Nie proponuj rabatu podczas pierwszej rozmowy.
- Bezpieczeństwo: po podpisaniu NDA wyślij pakiet bezpieczeństwa (raport SOC 2 Type II i certyfikat ISO 27001).
- Integracja: udostępnij „Przewodnik integracji API” i listę konektorów Relay.
- Klient korzysta już z konkurencji: zaproponuj ograniczony proof of concept w jednym zespole.

Przekazanie klienta do Customer Success

Po zamknięciu transakcji opiekun klienta wypełnia formularz przekazania w ciągu dwóch dni roboczych. Formularz zawiera osoby zaangażowane po stronie klienta, kryteria sukcesu, kupiony plan i liczbę licencji oraz wszystkie niestandardowe warunki. Customer Success umawia spotkanie startowe w ciągu pięciu dni roboczych od podpisu.

Prognozowanie

Sprzedawcy aktualizują kategorię prognozy każdej otwartej szansy co tydzień, do czwartku do południa. Kategoria „Commit” oznacza, że sprzedawca spodziewa się zamknąć transakcję w tym kwartale z pewnością co najmniej 90%.`,
  },
  {
    id: 'sales-customer-segmentation',
    folder: 'sales',
    title: 'Segmentacja klientów',
    owner: 'Revenue Operations',
    version: '2.0',
    effectiveDate: '2026-02-01',
    status: 'current',
    summary: 'Jak Northstar dzieli klientów na segmenty SMB, Mid-Market, Enterprise i Strategic i który zespół odpowiada za każdy z nich.',
    content: `Segmentacja klientów

Northstar obsługuje około 2300 klientów w Ameryce Północnej i Europie. Żeby każdy klient dostał odpowiedni poziom uwagi, zespół Revenue Operations przypisuje każde konto do jednego segmentu. Od segmentu zależy, który zespół sprzedaży odpowiada za konto, jaki plan zwykle rekomendujemy i jaki model opieki Customer Success stosujemy.

Segmenty

- Small Business (SMB): firmy zatrudniające od 1 do 99 pracowników.
- Mid-Market: firmy zatrudniające od 100 do 999 pracowników.
- Enterprise: firmy zatrudniające 1000 lub więcej pracowników.
- Strategic: ręcznie dobrana lista do 50 kont z rocznym przychodem cyklicznym (ARR) powyżej 500 000 USD lub z wyjątkowo dużymi szansami na rozbudowę umowy, przeglądana co roku w styczniu przez Chief Revenue Officer.

O segmencie decyduje łączna liczba pracowników klienta, a nie liczba użytkowników Northstar. Firma zatrudniająca 5000 osób, która kupuje 40 licencji Starter, nadal jest kontem Enterprise.

Kto odpowiada za konto

Za konta SMB odpowiada zespół Inside Sales, który pracuje głównie przez telefon i wideo i opiera się na samoobsługowym okresie próbnym. Za konta Mid-Market odpowiadają terytorialni opiekunowie klienta (AE) z biur w Denver, Austin, Toronto i Dublinie. Konta Enterprise mają imiennie przypisanych opiekunów klientów Enterprise i własnego Solutions Engineer. Konta Strategic mają zespół, w którego skład wchodzi sponsor z kierownictwa firmy.

Typowe dopasowanie planu

- SMB: Starter lub Professional, na początku zwykle w rozliczeniu miesięcznym.
- Mid-Market: Professional w umowie rocznej, często z dodatkiem Pulse.
- Enterprise i Strategic: plan Enterprise z SSO, logami audytowymi i wyborem miejsca przechowywania danych.

To wskazówki, a nie sztywne zasady. Firma Mid-Market z branży regulowanej może potrzebować planu Enterprise ze względu na logi audytowe i miejsce przechowywania danych.

Model opieki Customer Success

- SMB: opieka wspólna (cyfrowa), czyli webinary wdrożeniowe, przewodniki w aplikacji i kwartalny e-mail kontrolny.
- Mid-Market: imiennie przypisany Customer Success Manager dla kont z rocznym przychodem cyklicznym powyżej 40 000 USD, w pozostałych przypadkach opieka wspólna.
- Enterprise: imiennie przypisany Customer Success Manager i kwartalne przeglądy biznesowe.
- Strategic: imiennie przypisany Customer Success Manager, Technical Account Manager i coroczny przegląd biznesowy z udziałem kierownictwa.

Poziom wsparcia zależy od planu, a nie od segmentu. Plany Starter i Professional obejmują Standard Support, a plan Enterprise obejmuje Premium Support. Czasy reakcji podaje dokument „Umowa o poziomie usług (SLA)”.

Branże

Nasze największe branże to usługi finansowe (22% przychodów), ochrona zdrowia (18%), usługi profesjonalne (15%) i logistyka (11%). Konta z ochrony zdrowia i usług finansowych często potrzebują planu Enterprise ze względu na wymogi zgodności z przepisami.

Zmiana segmentu

Revenue Operations weryfikuje segmenty kont dwa razy w roku, w styczniu i w lipcu, na podstawie danych o firmach i aktualizacji w CRM. Konto przechodzi do nowego segmentu tylko podczas tych przeglądów, nawet jeśli liczba pracowników zmieni się wcześniej. Gdy konto zmienia segment, dotychczasowy i nowy opiekun odbywają rozmowę przekazującą w ciągu 30 dni, a konto zachowuje dotychczasowe ceny do odnowienia.

Spory o terytorium

Jeśli dwóch sprzedawców zgłasza prawo do tego samego konta, o przypisaniu decydują segment i lokalizacja siedziby zapisane w CRM. Spory rozstrzygają zaangażowani Regional Sales Directors w ciągu pięciu dni roboczych. Jeśli nie dojdą do porozumienia, decyduje Vice President of Sales.

Raportowanie

W każdy poniedziałek publikujemy w Beacon dashboardy z podziałem na segmenty. Pokazują lejek sprzedaży, skuteczność sprzedaży, utrzymanie przychodów netto i odejścia klientów. Cele utrzymania przychodów netto na 2026 r. to 105% dla SMB, 112% dla Mid-Market i 120% dla Enterprise.`,
  },
]
