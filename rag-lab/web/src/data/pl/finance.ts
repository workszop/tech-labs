import type { CompanyDocument } from '../documents'

export const FINANCE: CompanyDocument[] = [
  {
    id: 'finance-expense-reimbursement',
    folder: 'finance',
    title: 'Zwrot wydatków',
    owner: 'Finance Operations',
    version: '5.0',
    effectiveDate: '2026-01-01',
    status: 'current',
    summary: 'Jak pracownicy rozliczają wydatki służbowe w Ledgerly: zasady dotyczące paragonów, limity diet i hoteli, akceptacje i terminy wypłat.',
    content: `Zwrot wydatków

Ten dokument wyjaśnia, które wydatki służbowe Northstar zwraca, jak złożyć rozliczenie i kiedy pracownik dostaje pieniądze. Obowiązuje wszystkich pracowników od 1 stycznia 2026 r. Planowanie podróży i wcześniejszą zgodę na wyjazd opisuje dokument „Budżet podróży służbowych”, a ten dokument dotyczy tego, co dzieje się po wydaniu pieniędzy.

Zasady ogólne

Northstar zwraca rozsądne i konieczne wydatki poniesione na potrzeby firmy. Wydawaj pieniądze firmy tak, jakby były twoje. Wydatków prywatnych nie zwracamy, nawet jeśli zostały poniesione podczas podróży służbowej.

Jak złożyć rozliczenie

- Każde rozliczenie złóż w Ledgerly, naszym narzędziu do wydatków, w ciągu 30 dni od daty wydatku. Wydatków starszych niż 90 dni nie zwracamy.
- Do każdego wydatku na kwotę 25 USD lub wyższą dołącz paragon z wyszczególnionymi pozycjami. Jeśli zgubisz paragon, wypełnij oświadczenie o braku paragonu. Możesz to zrobić najwyżej trzy razy w roku.
- Opisz cel służbowy, a przy posiłkach z innymi osobami podaj uczestników i ich firmy.
- Jeśli masz kartę służbową, płać nią. Transakcje kartą też wymagają paragonów w Ledgerly.

Akceptacja

Rozliczenia zatwierdza się w Ledgerly zgodnie z firmowymi limitami akceptacji:

- do 2500 USD na rozliczenie: przełożony pracownika.
- od 2500 do 10 000 USD: kierownik działu.
- od 10 000 do 50 000 USD: Vice President of Finance.
- powyżej 50 000 USD: Chief Financial Officer.

Osoba zatwierdzająca ma 5 dni roboczych na sprawdzenie rozliczenia. Nikt nie może zatwierdzać własnych wydatków ani wydatków swojego przełożonego.

Wypłata

Zatwierdzone rozliczenia wypłacamy przelewem na konto razem z najbliższą regularną wypłatą wynagrodzeń. Northstar wypłaca wynagrodzenia co dwa tygodnie, więc pracownik zwykle dostaje zwrot w ciągu 10 dni roboczych od akceptacji. Wydatki w innych walutach przeliczamy po kursie z dnia transakcji, podanym na wyciągu z karty lub na paragonie.

Wydatki na podróże

Wydatki na podróż zwracamy tylko wtedy, gdy wyjazd został zarezerwowany i zatwierdzony zgodnie z dokumentem „Budżet podróży służbowych”. Obowiązują następujące limity:

- Loty: klasa ekonomiczna przy lotach krótszych niż 6 godzin, klasa premium economy przy lotach trwających 6 godzin lub dłużej, klasa biznes tylko przy lotach dłuższych niż 10 godzin i za zgodą VP. Rezerwacja przez TravelDesk.
- Hotele: do 250 USD za noc albo do 350 USD za noc w miastach o wysokich kosztach (Nowy Jork, San Francisco, Boston, Seattle, Londyn, Zurych i Tokio), z rezerwacją przez TravelDesk.
- Posiłki: dieta 75 USD dziennie w podróży krajowej i 90 USD dziennie w podróży zagranicznej, która pokrywa śniadanie, obiad, kolację i napiwki. W pierwszym i ostatnim dniu podróży przysługuje 75% diety. Posiłki zapewnione przez kogoś innego (na przykład przez organizatora konferencji lub hotel) odliczamy od diety.
- Transport naziemny: taksówki, przejazdy zamawiane przez aplikację i komunikacja publiczna na lotnisko, z lotniska i na spotkania. Wynajem samochodu tylko wtedy, gdy jest tańszy od innych możliwości, w klasie kompaktowej.
- Samochód prywatny: 0,70 USD za milę oraz opłaty drogowe i parking. Paliwa nie zwracamy osobno.

Posiłki i spotkania towarzyskie z klientami

Posiłki i spotkania towarzyskie z klientami lub potencjalnymi klientami zwracamy do 100 USD na uczestnika (pracownicy Northstar też się liczą), pod warunkiem że w rozliczeniu podano cel i uczestników. Powyżej tego limitu potrzebna jest wcześniejsza zgoda Sales Director. Prezenty dla klientów są ograniczone do 75 USD na osobę rocznie.

Inne wydatki podlegające zwrotowi

- Dodatek na biuro domowe (750 USD, jednorazowo) i dodatek na zdrowie i kondycję (50 USD miesięcznie), opisane w dokumentach kadrowych.
- Wydatki z budżetu na naukę do 1500 USD rocznie.
- Telefon komórkowy: do 60 USD miesięcznie dla pracowników, których stanowisko wymaga telefonu.

Wydatki niepodlegające zwrotowi

- Alkohol, z wyjątkiem zatwierdzonych spotkań towarzyskich z klientami
- Mandaty drogowe i parkingowe
- Podwyższenie klasy lotu lub hotelu, minibar, filmy w pokoju
- Prywatne przedłużenie podróży, podróż małżonka lub rodziny
- Zagubiony bagaż lub rzeczy osobiste

Nadużycia

Składanie fałszywych lub zawyżonych rozliczeń to poważne naruszenie Kodeksu postępowania i może skończyć się zwolnieniem. Dział Finance co miesiąc kontroluje losową próbę rozliczeń. Pytania kieruj na adres expenses@northstar.example.`,
  },
  {
    id: 'finance-travel-budget',
    folder: 'finance',
    title: 'Budżet podróży służbowych',
    owner: 'Financial Planning and Analysis',
    version: '2026.1',
    effectiveDate: '2026-01-01',
    status: 'current',
    summary: 'Roczne budżety podróży poszczególnych działów, zasady wcześniejszej zgody, rezerwacje przez TravelDesk oraz limity na hotele i diety na 2026 r.',
    content: `Budżet podróży służbowych

Ten dokument ustala budżety podróży służbowych poszczególnych działów na 2026 r. i wyjaśnia, jak pracownicy planują wyjazdy i uzyskują na nie zgodę. Uzupełnia go dokument „Zwrot wydatków”, który opisuje, jak rozlicza się koszty podróży i jak są one zwracane.

Roczne budżety podróży działów (rok obrotowy 2026)

- Sales: 1 200 000 USD (w tym wizyty u klientów i coroczne spotkanie otwierające rok sprzedaży)
- Customer Success i Support: 350 000 USD
- Engineering i Product: 280 000 USD
- Marketing: 240 000 USD (w tym targi i wydarzenia)
- People Operations, Finance i Legal: 110 000 USD
- Zespół zarządzający: 180 000 USD

Łączny budżet podróży firmy na 2026 r.: 2 360 000 USD. Kierownicy działów dostają co miesiąc raport budżetowy z Beacon. Gdy dział wykorzysta 80% rocznego budżetu, każdy nowy wyjazd wymaga, oprócz zwykłych akceptacji, zgody Vice President of Finance.

Kiedy wyjazd wymaga wcześniejszej zgody

- Wszystkie wyjazdy zagraniczne: zgoda Vice President działu.
- Wyjazdy krajowe o szacowanym łącznym koszcie powyżej 3000 USD: zgoda kierownika działu.
- Pozostałe wyjazdy krajowe: zgoda przełożonego.

O zgodę wystąp w TravelDesk przed rezerwacją. Wniosek zawiera cel, daty, miejsce docelowe i szacowany koszt. Koszty wyjazdów, na które nie było wcześniejszej zgody, mogą nie zostać zwrócone.

Rezerwacje

- Wszystkie loty, hotele i wynajęte samochody trzeba rezerwować przez TravelDesk, naszą platformę do rezerwacji podróży, żeby w sytuacji awaryjnej Northstar mógł ustalić, gdzie są podróżujący.
- Rezerwuj loty co najmniej 14 dni wcześniej, kiedy tylko się da. Rezerwacje na ostatnią chwilę wymagają krótkiego uzasadnienia.
- Wybieraj najtańszą rozsądną taryfę: klasę ekonomiczną przy lotach krótszych niż 6 godzin, premium economy przy lotach trwających 6 godzin lub dłużej, klasę biznes tylko przy lotach dłuższych niż 10 godzin i za zgodą VP.
- Northstar ma wynegocjowane stawki w preferowanych sieciach hoteli. TravelDesk pokazuje je na początku listy.

Limity na hotele i diety

Te limity są takie same jak w dokumencie „Zwrot wydatków”:

- Hotel: do 250 USD za noc, a w miastach o wysokich kosztach (Nowy Jork, San Francisco, Boston, Seattle, Londyn, Zurych i Tokio) do 350 USD za noc.
- Dieta na posiłki: 75 USD dziennie w podróży krajowej, 90 USD dziennie w podróży zagranicznej, a w pierwszym i ostatnim dniu podróży 75% tej kwoty.

Jeśli w pobliżu miejsca spotkania nie ma hotelu mieszczącego się w limicie, TravelDesk oznaczy wyjątek, a przełożony może zatwierdzić stawkę do 20% powyżej limitu.

Wizyty u klientów

Wyjazdy działów Sales i Customer Success do klientów obciążają budżet danego działu i podlegają tym samym limitom. Podróże do klientów nie mają osobnego limitu. Sprzedawcy powinni w miarę możliwości łączyć kilka spotkań z klientami w jeden wyjazd.

Spotkania zespołów i pracownicy zdalni

Każdy pracownik pracujący w pełni zdalnie może pojechać na najwyżej cztery spotkania zespołu na żywo w roku, na koszt budżetu swojego działu. Wyjazdowe spotkania zespołów musi zatwierdzić Vice President działu co najmniej 6 tygodni wcześniej i w miarę możliwości powinny się one odbywać w biurze Northstar (Denver, Austin, Toronto lub Dublin).

Bezpieczeństwo w podróży

Przed rezerwacją wyjazdu zagranicznego podróżujący musi sprawdzić listę ostrzeżeń dla podróżujących, którą prowadzi zespół Security. Wyjazd do kraju oznaczonego jako „wysokie ryzyko” wymaga zgody Chief Operating Officer. Ubezpieczenie podróży służbowych obejmuje wszystkich pracowników podczas zatwierdzonych wyjazdów.

Zrównoważony rozwój

Wybieraj kolej zamiast samolotu, jeśli przejazd pociągiem trwa mniej niż 4 godziny, a zanim zaplanujesz wyjazd, rozważ rozmowę wideo. Northstar śledzi emisje z podróży w podziale na działy i podaje je w rocznym raporcie zrównoważonego rozwoju.

Pytania o budżety kieruj do zespołu FP and A na adres fpa@northstar.example, a pytania o rezerwacje do wsparcia TravelDesk.`,
  },
  {
    id: 'finance-invoice-processing',
    folder: 'finance',
    title: 'Obsługa faktur',
    owner: 'Accounts Payable and Billing',
    version: '3.2',
    effectiveDate: '2026-03-01',
    status: 'current',
    summary: 'Jak przyjmujemy, uzgadniamy i opłacamy faktury od dostawców oraz jak Northstar fakturuje klientów, w tym terminy płatności i opłaty za opóźnienie.',
    content: `Obsługa faktur

Ten dokument opisuje, jak Northstar obsługuje faktury otrzymywane od dostawców (zobowiązania) i faktury wystawiane klientom (rozliczenia z klientami). Dzięki tym zasadom nasze księgi są rzetelne, dostawcy dostają zapłatę na czas, a wpływy od klientów da się przewidzieć.

Część 1: Faktury od dostawców (zobowiązania)

Przyjmowanie faktur

Dostawcy muszą wysyłać faktury w formacie PDF na adres ap@northstar.example. Fakturę wysłaną do konkretnego pracownika trzeba przekazać na ten adres tego samego dnia. Każda faktura musi zawierać pełną nazwę prawną dostawcy, numer faktury, datę faktury, numer zamówienia zakupu (PO) Northstar, jeśli takie zamówienie istnieje, opis towarów lub usług, kwoty i podatek.

Uzgadnianie

- Faktury z PO przechodzą trójstronne uzgodnienie: zamówienie zakupu, potwierdzenie przyjęcia towaru lub wykonania usługi w systemie zakupowym i faktura muszą się zgadzać. Różnicę do 5% lub 500 USD, zależnie od tego, która z tych wartości jest niższa, akceptujemy automatycznie.
- Faktury bez PO są dopuszczalne tylko w kategoriach zwolnionych z obowiązku zamówienia zakupu w dokumencie „Zasady zakupów” (na przykład media, czynsz lub zakupy poniżej 5000 USD). Takie faktury trafiają do akceptacji dysponenta budżetu.

Akceptacja faktur bez PO

Faktury bez PO zatwierdza się zgodnie z firmowymi limitami akceptacji:

- do 2500 USD: przełożony.
- od 2500 do 10 000 USD: kierownik działu.
- od 10 000 do 50 000 USD: Vice President of Finance.
- powyżej 50 000 USD: Chief Financial Officer.

Każdą fakturę powyżej 25 000 USD przed zapłatą dodatkowo sprawdza po raz drugi specjalista Accounts Payable.

Płatność

Standardowy termin płatności Northstar wobec dostawców to 45 dni od daty otrzymania faktury. Płacimy przelewem ACH lub przelewem bankowym (wire) w dwóch cyklach płatności w tygodniu, we wtorek i w piątek. Z rabatów za wcześniejszą płatność, które proponują dostawcy, korzystamy, gdy rabat wynosi co najmniej 1%. Dane bankowe dostawcy można zmienić dopiero po ustnym potwierdzeniu u znanej nam osoby kontaktowej po stronie dostawcy. Chroni to przed oszustwami.

Zamknięcie miesiąca

Faktury otrzymane do 3. dnia roboczego miesiąca księgujemy w poprzednim miesiącu, jeśli towary lub usługi zostały wtedy dostarczone. Księgi każdego miesiąca zamykamy do 5. dnia roboczego następnego miesiąca. Rok obrotowy pokrywa się z rokiem kalendarzowym.

Część 2: Faktury dla klientów (rozliczenia z klientami)

Wystawianie faktur

- Subskrypcje roczne fakturujemy przy podpisaniu umowy, a potem w każdą datę odnowienia.
- Opłatę za subskrypcje miesięczne pobieramy z karty klienta tego samego dnia każdego miesiąca.
- Dokupione licencje fakturujemy 1. dnia następnego miesiąca, proporcjonalnie do końca okresu umowy.

Standardowy termin płatności dla klientów to 30 dni od daty faktury, zgodnie z dokumentem „Polityka cenowa”.

Opóźnione płatności

- Dzień 1 po terminie płatności: automatyczne przypomnienie e-mailem.
- Po 15-dniowym okresie karencji możemy naliczyć opłatę za opóźnienie w wysokości 1,5% zaległej kwoty miesięcznie.
- Dzień 30 po terminie: informację dostają opiekun klienta (AE) i Customer Success Manager, a zespół Collections dzwoni do klienta.
- Dzień 60 po terminie: konto można zawiesić (dostęp tylko do odczytu) po 10 dniach od pisemnego powiadomienia.
- Dzień 90 po terminie: konto można zamknąć, a dług przekazać zewnętrznej firmie windykacyjnej, za zgodą Finance Controller.

Faktury korygujące i poprawki

Błędy w rozliczeniach poprawiamy fakturą korygującą. Zwroty pieniędzy dla klientów podlegają dokumentowi „Zasady zwrotów”. Do 10 000 USD zatwierdza je Billing Support Specialist, a powyżej 10 000 USD Finance Controller. Rekompensaty w formie kredytu na usługi wynikające z SLA pokazujemy jako pozycję kredytową na następnej fakturze.

Podatki

Northstar nalicza amerykański podatek od sprzedaży tam, gdzie ma on zastosowanie, kanadyjski GST/HST i irlandzki VAT. Klienci zwolnieni z podatku muszą dostarczyć zaświadczenie o zwolnieniu przed pierwszą fakturą.

Pytania o płatności dla dostawców kieruj na adres ap@northstar.example, a pytania o faktury dla klientów na adres billing@northstar.example.`,
  },
  {
    id: 'finance-procurement',
    folder: 'finance',
    title: 'Zasady zakupów',
    owner: 'Procurement',
    version: '4.1',
    effectiveDate: '2026-02-01',
    status: 'current',
    summary: 'Zasady kupowania towarów, oprogramowania i usług: kiedy potrzebne jest zamówienie zakupu, oferty konkurencyjne, akceptacje i ocena bezpieczeństwa dostawcy.',
    content: `Zasady zakupów

Ten dokument ustala zasady kupowania towarów, oprogramowania i usług w Northstar. Chodzi o to, żeby kupować korzystnie, ograniczać ryzyko po stronie dostawców i mieć pewność, że każde zobowiązanie jest zatwierdzone i ujęte w budżecie, zanim wydamy pieniądze. Obowiązuje wszystkich pracowników i wszystkie zakupy opłacane przez Northstar, niezależnie od metody płatności.

Kiedy potrzebne jest zamówienie zakupu

- Zakupy poniżej 5000 USD można opłacić kartą służbową albo rozliczyć przez Ledgerly bez zamówienia zakupu (PO), o ile zgodzi się dysponent budżetu.
- Zakupy na kwotę 5000 USD lub wyższą wymagają PO wystawionego w systemie zakupowym przed złożeniem zamówienia lub podpisaniem umowy.
- Usługi cykliczne (na przykład subskrypcje oprogramowania) oceniamy według łącznej wartości rocznej, a nie ceny miesięcznej. Subskrypcja za 500 USD miesięcznie to zakup za 6000 USD i wymaga PO.
- Nie wolno dzielić zakupu na mniejsze zamówienia, żeby ominąć te progi.

Oferty konkurencyjne

- poniżej 10 000 USD: wystarczy jedna oferta.
- od 10 000 do 50 000 USD: co najmniej dwie pisemne oferty.
- powyżej 50 000 USD: co najmniej trzy pisemne oferty albo formalne zapytanie ofertowe (RFP) prowadzone przez dział Procurement.

Jeśli to, czego potrzebujemy, może dostarczyć tylko jeden dostawca, uzasadnienie zakupu z jednego źródła musi zatwierdzić Head of Procurement.

Limity akceptacji

Zamówienia zakupu zatwierdza się zgodnie z firmowymi limitami akceptacji, tymi samymi, które obowiązują przy wydatkach i fakturach:

- do 2500 USD: przełożony.
- od 2500 do 10 000 USD: kierownik działu.
- od 10 000 do 50 000 USD: Vice President of Finance.
- powyżej 50 000 USD: Chief Financial Officer.
- powyżej 250 000 USD: Chief Financial Officer i Chief Executive Officer.

Akceptacja musi obejmować pełną wartość umowy za cały okres jej trwania. Umowa trzyletnia na 30 000 USD rocznie to zobowiązanie na 90 000 USD i wymaga zgody CFO.

Ocena bezpieczeństwa i prywatności dostawcy

Każde oprogramowanie lub usługa, które będą przechowywać lub przetwarzać dane klientów, dane osobowe pracowników albo poufne informacje firmy, musi przed podpisaniem umowy przejść ocenę zespołu Security and Privacy. Ocena trwa około 10 dni roboczych i obejmuje raport SOC 2 lub ISO 27001 dostawcy oraz umowę powierzenia przetwarzania danych (Data Processing Agreement). Narzędzia, które łączą się z systemami Northstar przez API lub logowanie jednokrotne (SSO), oceniamy zawsze.

Umowy i uprawnienia do podpisu

Umowy w imieniu Northstar mogą podpisywać tylko pracownicy z uprawnieniami do podpisu. Dział Legal sprawdza umowy, które przekraczają 25 000 USD, trwają dłużej niż rok albo zawierają niestandardowe warunki. Podpisane umowy przechowujemy w Northstar Vault w folderze Contracts, z zapisaną datą odnowienia.

Preferowani dostawcy

Dział Procurement prowadzi listę preferowanych dostawców z wynegocjowanymi cenami na laptopy, artykuły biurowe, podróże, agencje rekrutacyjne i usługi chmurowe. Jeśli w danej kategorii jest preferowany dostawca, skorzystaj z niego. Laptopy i inny sprzęt IT zamawia wyłącznie dział IT.

Odbiór towarów i usług

Osoba zamawiająca potwierdza w systemie zakupowym odbiór towarów lub wykonanie usług w ciągu 5 dni roboczych. To potwierdzenie jest potrzebne do trójstronnego uzgodnienia opisanego w dokumencie „Obsługa faktur”. Bez niego nie można zapłacić faktury dostawcy.

Konflikt interesów

Pracownik musi ujawnić każdy osobisty lub finansowy związek z dostawcą i nie może brać udziału w decyzjach, które tego dostawcy dotyczą. Prezentów od dostawców o wartości powyżej 75 USD trzeba odmówić albo zgłosić je do działu Procurement.

Odnowienia

Dysponent budżetu dostaje przypomnienie 90 dni przed odnowieniem umowy. Musi potwierdzić, czy narzędzie jest nadal potrzebne i czy liczba licencji jest odpowiednia. Niewykorzystane licencje na oprogramowanie należy usunąć przy odnowieniu.

Pytania kieruj na adres procurement@northstar.example lub na kanał #procurement.`,
  },
]
