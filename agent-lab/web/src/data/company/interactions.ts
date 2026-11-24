import type { Interaction } from './types'

type Pair = [en: string, pl: string]

type Row = Omit<Interaction, 'id'>

function i(
  date: string,
  customerId: string,
  channel: Interaction['channel'],
  type: Interaction['type'],
  ref: { caseId?: string; orderId?: string },
  handledBy: string,
  subject: Pair,
  summary: Pair,
  outcome: Pair,
): Row {
  return {
    customerId, date, channel, type, caseId: ref.caseId ?? null, orderId: ref.orderId ?? null, handledBy,
    subject: { en: subject[0], pl: subject[1] },
    summary: { en: summary[0], pl: summary[1] },
    outcome: { en: outcome[0], pl: outcome[1] },
  }
}

const ROWS: Row[] = [
  // CUST-1001 Anna Kowalska
  i('2025-05-10', 'CUST-1001', 'phone', 'follow_up', { orderId: 'ORD-2024-0434' }, 'Ola Wrona',
    ['Warranty transfer: ChefMix 900', 'Przeniesienie gwarancji: ChefMix 900'],
    ['Customer gave her ChefMix 900 (CX900-24-03117) to her daughter Zofia Kowalska and asked to transfer the warranty.', 'Klientka podarowała robota ChefMix 900 (CX900-24-03117) córce, Zofii Kowalskiej, i poprosiła o przeniesienie gwarancji.'],
    ['Warranty WAR-0010 transferred to CUST-1048 from 10 May 2025.', 'Gwarancja WAR-0010 przeniesiona na CUST-1048 od 10.05.2025.']),
  i('2025-08-13', 'CUST-1001', 'phone', 'service_request', { caseId: 'CASE-2025-025' }, 'Ola Wrona',
    ['PureAir 200 rattles', 'PureAir 200 grzechocze'],
    ['Fan rattles at the highest speed.', 'Wentylator grzechocze na najwyższym biegu.'],
    ['Case CASE-2025-025 opened; drop-off at the Kraków service partner arranged.', 'Założono sprawę CASE-2025-025; ustalono oddanie urządzenia do serwisu partnerskiego w Krakowie.']),
  i('2026-11-06', 'CUST-1001', 'phone', 'service_request', { caseId: 'CASE-2026-035' }, 'Maja Lis',
    ['Burning smell from PureAir 200', 'Zapach spalenizny z PureAir 200'],
    ['Customer noticed a burning smell and crackling from the purifier.', 'Klientka poczuła zapach spalenizny i usłyszała trzaski z oczyszczacza.'],
    ['Told to unplug the unit and stop using it. Case CASE-2026-035 escalated to the product safety team.', 'Zalecono odłączenie urządzenia i niekorzystanie z niego. Sprawę CASE-2026-035 przekazano do zespołu ds. bezpieczeństwa produktów.']),

  // CUST-1005 Pierre Laurent
  i('2025-06-02', 'CUST-1005', 'email', 'service_request', { caseId: 'CASE-2025-017' }, 'Chris Dunn',
    ['Basket coating peeling', 'Odchodząca powłoka kosza'],
    ['Customer sent photos of the AirCrisp 5 basket with the non-stick coating peeling off.', 'Klient przesłał zdjęcia kosza AirCrisp 5 z odchodzącą powłoką nieprzywierającą.'],
    ['Case CASE-2025-017 opened; replacement basket approved under warranty.', 'Założono sprawę CASE-2025-017; zatwierdzono wymianę kosza w ramach gwarancji.']),
  i('2025-06-09', 'CUST-1005', 'email', 'follow_up', { caseId: 'CASE-2025-017' }, 'Chris Dunn',
    ['Replacement basket received', 'Zamienny kosz dotarł'],
    ['Customer confirmed the replacement basket arrived and fits.', 'Klient potwierdził, że zamienny kosz dotarł i pasuje.'],
    ['Case closed.', 'Sprawa zamknięta.']),

  // CUST-1008 Sofia Rossi
  i('2026-11-20', 'CUST-1008', 'phone', 'inquiry', { orderId: 'ORD-2024-0876' }, 'Tom Reilly',
    ['AeroClean V10 battery runtime', 'Czas pracy akumulatora AeroClean V10'],
    ['The battery lasts only about five minutes instead of the usual 45 to 60. Advised a full charge and cleaning the filters.', 'Akumulator wystarcza tylko na około pięć minut zamiast zwykłych 45-60. Zalecono pełne naładowanie i wyczyszczenie filtrów.'],
    ['Customer will test after a full charge and get back to us. Warranty status not discussed.', 'Klientka sprawdzi po pełnym naładowaniu i odezwie się. Nie rozmawiano o gwarancji.']),

  // CUST-1012 Jan Novák
  i('2024-09-14', 'CUST-1012', 'phone', 'service_request', { caseId: 'CASE-2024-029' }, 'Tom Reilly',
    ['Espresso One: no pressure', 'Espresso One: brak ciśnienia'],
    ['Water runs through the coffee without crema.', 'Woda przelatuje przez kawę bez cremy.'],
    ['Case CASE-2024-029 opened; courier pickup arranged.', 'Założono sprawę CASE-2024-029; zamówiono kuriera po odbiór.']),
  i('2026-05-19', 'CUST-1012', 'phone', 'service_request', { caseId: 'CASE-2026-015' }, 'Lena Sauer',
    ['QuickBlend 600 smells of burning', 'QuickBlend 600 pachnie spalenizną'],
    ['Motor smells of burning under load. The blender has been out of warranty since 19 Aug 2025.', 'Silnik pod obciążeniem pachnie spalenizną. Gwarancja na blender wygasła 19.08.2025.'],
    ['Paid repair quote of EUR 45 accepted; case CASE-2026-015 opened.', 'Klient zaakceptował wycenę odpłatnej naprawy (45 EUR); założono sprawę CASE-2026-015.']),

  // CUST-1017 Lukas Becker
  i('2025-12-01', 'CUST-1017', 'chat', 'service_request', { caseId: 'CASE-2025-037' }, 'Lena Sauer',
    ['RoboClean R5 does not find its dock', 'RoboClean R5 nie znajduje stacji'],
    ['Robot wanders around and does not return to the dock.', 'Robot krąży po mieszkaniu i nie wraca do stacji.'],
    ['Solved by moving the dock away from a mirror; case closed on 3 Dec.', 'Rozwiązane przez przestawienie stacji z dala od lustra; sprawa zamknięta 3.12.']),
  i('2026-11-03', 'CUST-1017', 'phone', 'service_request', { caseId: 'CASE-2026-034' }, 'Lena Sauer',
    ['RoboClean R5 brush motor error', 'RoboClean R5: błąd silnika szczotki'],
    ['Main brush stops after about two minutes; the app shows a brush motor error.', 'Szczotka główna staje po około dwóch minutach; aplikacja pokazuje błąd silnika szczotki.'],
    ['Case CASE-2026-034 opened; a replacement brush motor module will be sent to the customer, who will fit it himself.', 'Założono sprawę CASE-2026-034; nowy moduł silnika szczotki zostanie wysłany do klienta, który sam go zamontuje.']),
  i('2026-11-10', 'CUST-1017', 'email', 'follow_up', { caseId: 'CASE-2026-034' }, 'Lena Sauer',
    ['Replacement part dispatched', 'Część zamienna wysłana'],
    ['Sent the tracking details for SHIP-2026-100; expected delivery 14 Nov 2026.', 'Wysłano dane śledzenia przesyłki SHIP-2026-100; przewidywane doręczenie 14.11.2026.'],
    ['Informational e-mail; no reply needed.', 'E-mail informacyjny; odpowiedź niepotrzebna.']),

  // CUST-1019 Mateo García
  i('2026-06-03', 'CUST-1019', 'phone', 'service_request', { caseId: 'CASE-2026-017' }, 'Chris Dunn',
    ['Barista Pro 300 does not heat', 'Barista Pro 300 nie grzeje'],
    ['Machine does not heat up. The customer mentioned that a local workshop had replaced the pump in April.', 'Ekspres się nie nagrzewa. Klient wspomniał, że w kwietniu lokalny warsztat wymienił pompę.'],
    ['Case CASE-2026-017 opened; courier pickup arranged for an inspection.', 'Założono sprawę CASE-2026-017; zamówiono kuriera, ekspres trafi do oględzin.']),
  i('2026-06-12', 'CUST-1019', 'email', 'follow_up', { caseId: 'CASE-2026-017' }, 'Chris Dunn',
    ['Inspection result', 'Wynik oględzin'],
    ['Inspection found an opened housing and a non-original pump. Warranty voided under the unauthorised-repair exclusion; paid repair quote of EUR 160 sent.', 'Oględziny wykazały otwieraną obudowę i nieoryginalną pompę. Gwarancja unieważniona z powodu nieautoryzowanej naprawy; wysłano wycenę odpłatnej naprawy: 160 EUR.'],
    ["Waiting for the customer's decision.", 'Czekamy na decyzję klienta.']),
  i('2026-06-20', 'CUST-1019', 'email', 'complaint', { caseId: 'CASE-2026-017' }, 'Ravi Patel',
    ['Disputes the void warranty', 'Kwestionuje unieważnienie gwarancji'],
    ['Customer argued that the workshop only replaced the pump and that the heating fault is unrelated.', 'Klient twierdzi, że warsztat wymienił tylko pompę, a usterka grzania nie ma z tym związku.'],
    ['Warranty team reviewed the photos and upheld the decision; explained in writing. Customer declined the quote on 24 Jun.', 'Zespół gwarancyjny przejrzał zdjęcia i podtrzymał decyzję; wyjaśnienie wysłano na piśmie. Klient odrzucił wycenę 24.06.']),
  i('2026-10-15', 'CUST-1019', 'phone', 'service_request', { caseId: 'CASE-2026-032' }, 'Chris Dunn',
    ['AirCrisp 5 fan rattles', 'Wentylator AirCrisp 5 grzechocze'],
    ['Loud rattling from the fan during cooking.', 'Głośne grzechotanie wentylatora podczas pracy.'],
    ['Case CASE-2026-032 opened; courier pickup on 19 Oct.', 'Założono sprawę CASE-2026-032; kurier odbierze urządzenie 19.10.']),

  // CUST-1023 Daniel Kim
  i('2026-09-05', 'CUST-1023', 'chat', 'inquiry', { orderId: 'ORD-2026-0624' }, 'Tom Reilly',
    ['Connecting PureAir 500 Smart to the app', 'Łączenie PureAir 500 Smart z aplikacją'],
    ['Purifier did not appear in the Northstar app during setup.', 'Podczas konfiguracji oczyszczacz nie pojawiał się w aplikacji Northstar.'],
    ['Connected after switching the router to the 2.4 GHz band.', 'Połączono po przełączeniu routera na pasmo 2,4 GHz.']),
  i('2026-11-18', 'CUST-1023', 'chat', 'service_request', { caseId: 'CASE-2026-039' }, 'Tom Reilly',
    ['App connection lost after update', 'Utrata połączenia z aplikacją po aktualizacji'],
    ['Purifier no longer connects to the app after the latest app update.', 'Po ostatniej aktualizacji aplikacji oczyszczacz nie łączy się z nią.'],
    ['Case CASE-2026-039 opened; customer will send app logs.', 'Założono sprawę CASE-2026-039; klient prześle logi aplikacji.']),

  // CUST-1026 Ingrid Larsen
  i('2026-07-02', 'CUST-1026', 'phone', 'service_request', { caseId: 'CASE-2026-020' }, 'Ravi Patel',
    ['InductaCook 2 shows E3', 'InductaCook 2 pokazuje E3'],
    ['Hob switches off after a few minutes with E3 (overheating); vents are clear.', 'Płyta wyłącza się po kilku minutach z kodem E3 (przegrzanie); otwory wentylacyjne są drożne.'],
    ['Case CASE-2026-020 opened; covered by the warranty valid until 14 Jul 2026; courier pickup arranged.', 'Założono sprawę CASE-2026-020; naprawa w ramach gwarancji ważnej do 14.07.2026; zamówiono kuriera.']),
  i('2026-10-14', 'CUST-1026', 'chat', 'inquiry', { orderId: 'ORD-2026-0728' }, 'Ravi Patel',
    ['Barista Pro 700 Duo: two bean hoppers', 'Barista Pro 700 Duo: dwa pojemniki na ziarna'],
    ['Customer asked how to use decaf beans in the second hopper.', 'Klientka zapytała, jak używać kawy bezkofeinowej w drugim pojemniku.'],
    ['Explained how to assign a hopper to each drink.', 'Wyjaśniono, jak przypisać pojemnik do każdego napoju.']),

  // CUST-1029 Javier Morales
  i('2026-04-08', 'CUST-1029', 'phone', 'service_request', { caseId: 'CASE-2026-011' }, 'Chris Dunn',
    ['Barista Compact 200: E07 and water under the machine', 'Barista Compact 200: E07 i woda pod ekspresem'],
    ['Display shows E07 and water collects under the machine.', 'Wyświetlacz pokazuje E07, a pod ekspresem zbiera się woda.'],
    ['Case CASE-2026-011 opened; technician visit booked for 17 Apr. Advised to use descaler and a water filter.', 'Założono sprawę CASE-2026-011; wizyta technika 17.04. Zalecono odkamieniacz i filtr wody.']),
  i('2026-04-21', 'CUST-1029', 'email', 'follow_up', { caseId: 'CASE-2026-011' }, 'Chris Dunn',
    ['Leak fixed', 'Wyciek usunięty'],
    ['Customer confirmed the machine no longer leaks after the seal replacement.', 'Klient potwierdził, że po wymianie uszczelki ekspres już nie cieknie.'],
    ['Case closed.', 'Sprawa zamknięta.']),
  i('2026-08-24', 'CUST-1029', 'chat', 'service_request', { caseId: 'CASE-2026-026' }, 'Lena Sauer',
    ['E07 again', 'Znowu E07'],
    ['The E07 leak is back, this time under the drip tray.', 'Wyciek z błędem E07 wrócił, tym razem pod tacką ociekową.'],
    ['Second case CASE-2026-026 opened for the same fault; technician visit booked for 3 Sep.', 'Założono drugą sprawę, CASE-2026-026, dla tej samej usterki; wizyta technika 3.09.']),
  i('2026-09-06', 'CUST-1029', 'email', 'follow_up', { caseId: 'CASE-2026-026' }, 'Lena Sauer',
    ['Second repair done', 'Druga naprawa zakończona'],
    ['Customer confirmed the leak stopped after the hose connector was replaced.', 'Klient potwierdził, że po wymianie złączki węża wyciek ustał.'],
    ['Case closed.', 'Sprawa zamknięta.']),
  i('2026-09-08', 'CUST-1029', 'phone', 'complaint', { caseId: 'CASE-2026-026' }, 'Ravi Patel',
    ['Same fault twice', 'Ta sama usterka dwa razy'],
    ['Customer is unhappy that the E07 leak needed two repairs within five months and worries it will come back.', 'Klient jest niezadowolony, że wyciek E07 wymagał dwóch napraw w ciągu pięciu miesięcy, i obawia się, że wróci.'],
    ['Apologised. Note on the account: if the leak returns, escalate to the service team lead for a replacement decision.', 'Przeproszono klienta. Notatka na koncie: jeśli wyciek wróci, przekazać sprawę kierownikowi zespołu serwisu do decyzji o wymianie.']),

  // CUST-1031 Katarzyna Wiśniewska
  i('2026-07-21', 'CUST-1031', 'chat', 'service_request', { caseId: 'CASE-2026-022' }, 'Ola Wrona',
    ['PureAir 300 shows S2', 'PureAir 300 pokazuje S2'],
    ['Error S2 and the air quality reading does not change.', 'Błąd S2, a odczyt jakości powietrza się nie zmienia.'],
    ['Sensor cleaning from the manual explained; the error cleared on 23 Jul.', 'Wyjaśniono czyszczenie czujnika według instrukcji; błąd zniknął 23.07.']),
  i('2026-11-08', 'CUST-1031', 'chat', 'inquiry', { orderId: 'ORD-2026-0796' }, 'Ola Wrona',
    ['Return of AeroClean V10', 'Zwrot AeroClean V10'],
    ['Customer wants to return the vacuum within the 14-day period; it is too heavy for her.', 'Klientka chce zwrócić odkurzacz w ciągu 14 dni; jest dla niej za ciężki.'],
    ['Return label sent; parcel locker drop-off.', 'Wysłano etykietę zwrotną; nadanie w paczkomacie.']),
  i('2026-11-16', 'CUST-1031', 'email', 'follow_up', { orderId: 'ORD-2026-0796' }, 'Ola Wrona',
    ['Refund issued', 'Zwrot pieniędzy'],
    ['Return SHIP-2026-101 received at the warehouse on 14 Nov and checked.', 'Zwrot SHIP-2026-101 dotarł do magazynu 14.11 i został sprawdzony.'],
    ['Refund of EUR 389 issued.', 'Zwrócono 389 EUR.']),

  // CUST-1033 Aiko Tanaka
  i('2026-06-28', 'CUST-1033', 'email', 'inquiry', { orderId: 'ORD-2025-0429' }, 'Tom Reilly',
    ['Which replacement filter?', 'Który filtr zamienny?'],
    ['The filter indicator on the PureAir 300 is red; customer asked which filter to buy.', 'Wskaźnik filtra w PureAir 300 świeci na czerwono; klientka zapytała, jaki filtr kupić.'],
    ['Recommended the HEPA H13 Filter (PRD-AIR-5); ordered on 30 Jun (ORD-2026-0471).', 'Polecono filtr HEPA H13 (PRD-AIR-5); zamówiony 30.06 (ORD-2026-0471).']),

  // CUST-1036 Hannah Schmidt
  i('2024-05-02', 'CUST-1036', 'phone', 'service_request', { caseId: 'CASE-2024-014' }, 'Lena Sauer',
    ['Barista Pro 300 grinder jams', 'Młynek Barista Pro 300 się blokuje'],
    ['Grinder jams and stops with a clicking noise.', 'Młynek się blokuje i zatrzymuje z klikającym dźwiękiem.'],
    ['Case CASE-2024-014 opened; drop-off at the Hamburg service partner.', 'Założono sprawę CASE-2024-014; oddanie ekspresu do serwisu partnerskiego w Hamburgu.']),
  i('2025-11-12', 'CUST-1036', 'phone', 'service_request', { caseId: 'CASE-2025-035' }, 'Lena Sauer',
    ['Descaling stops halfway', 'Odkamienianie zatrzymuje się w połowie'],
    ['On the home machine (Barista Pro 300) the descaling programme stops halfway.', 'W domowym ekspresie (Barista Pro 300) program odkamieniania zatrzymuje się w połowie.'],
    ['Case CASE-2025-035 opened; drop-off at the Hamburg service partner.', 'Założono sprawę CASE-2025-035; oddanie ekspresu do serwisu partnerskiego w Hamburgu.']),
  i('2026-09-15', 'CUST-1036', 'email', 'service_request', { caseId: 'CASE-2026-028' }, 'Lena Sauer',
    ['Broken bean hopper lid on the studio machine', 'Pęknięta pokrywa pojemnika na ziarna w ekspresie w studiu'],
    ['The bean hopper lid of the Barista Compact 200 in the studio broke at the hinge.', 'Pokrywa pojemnika na ziarna w ekspresie Barista Compact 200 w studiu pękła przy zawiasie.'],
    ['Replacement lid approved under warranty; case CASE-2026-028 opened.', 'Zatwierdzono wymianę pokrywy w ramach gwarancji; założono sprawę CASE-2026-028.']),

  // CUST-1038 Piotr Zieliński
  i('2025-01-30', 'CUST-1038', 'phone', 'service_request', { caseId: 'CASE-2025-003' }, 'Ola Wrona',
    ['Home Hub Classic offline after a router change', 'Home Hub Classic offline po wymianie routera'],
    ['Hub does not connect to the new router.', 'Centrala nie łączy się z nowym routerem.'],
    ['Network reset explained; solved the next day.', 'Wyjaśniono reset ustawień sieci; rozwiązane następnego dnia.']),
  i('2026-09-29', 'CUST-1038', 'email', 'inquiry', { orderId: 'ORD-2026-0689' }, 'Ola Wrona',
    ['Parcel returned to sender', 'Paczka zwrócona do nadawcy'],
    ['Customer missed the 48-hour locker pickup window for SHIP-2026-084, which went back to the warehouse.', 'Klient nie odebrał przesyłki SHIP-2026-084 z paczkomatu w ciągu 48 godzin i wróciła ona do magazynu.'],
    ['Re-sent by courier to the home address (SHIP-2026-087); delivered on 1 Oct.', 'Wysłano ponownie kurierem na adres domowy (SHIP-2026-087); doręczono 1.10.']),
  i('2026-11-14', 'CUST-1038', 'phone', 'service_request', { caseId: 'CASE-2026-037' }, 'Maja Lis',
    ['Home Hub Classic drops Wi-Fi', 'Home Hub Classic traci Wi-Fi'],
    ['Hub loses its Wi-Fi connection several times a day since firmware 4.2. Customer asked about an upgrade offer for the Home Hub.', 'Od aktualizacji 4.2 centrala kilka razy dziennie traci połączenie z Wi-Fi. Klient zapytał o ofertę wymiany na Home Hub.'],
    ['Case CASE-2026-037 escalated to the product team; answer expected by 27 Nov.', 'Sprawę CASE-2026-037 przekazano do zespołu produktowego; odpowiedź do 27.11.']),

  // CUST-1042 Emma Wilson (anchor)
  i('2026-03-20', 'CUST-1042', 'chat', 'inquiry', { orderId: 'ORD-2026-0187' }, 'Tom Reilly',
    ['Milk foam settings', 'Ustawienia pianki mlecznej'],
    ['Customer asked how to get firmer milk foam on her new Barista Pro 500.', 'Klientka zapytała, jak uzyskać gęstszą piankę w nowym ekspresie Barista Pro 500.'],
    ['Explained the milk foam settings; recommended the AquaPure water filter.', 'Wyjaśniono ustawienia pianki; polecono filtr wody AquaPure.']),
  i('2026-10-06', 'CUST-1042', 'phone', 'service_request', { caseId: 'CASE-2026-031' }, 'Tom Reilly',
    ['No steam from the steam wand', 'Brak pary z dyszy'],
    ['Steam wand produces no steam; coffee brews normally.', 'Dysza parowa nie wytwarza pary; kawa parzy się normalnie.'],
    ['Case CASE-2026-031 opened; replacement nozzle to be sent.', 'Założono sprawę CASE-2026-031; zostanie wysłana nowa końcówka dyszy.']),
  i('2026-10-16', 'CUST-1042', 'email', 'follow_up', { caseId: 'CASE-2026-031' }, 'Tom Reilly',
    ['Steam works again', 'Para znów działa'],
    ['Customer fitted the replacement nozzle from SHIP-2026-091 herself.', 'Klientka sama zamontowała nową końcówkę z przesyłki SHIP-2026-091.'],
    ['Case closed.', 'Sprawa zamknięta.']),

  // CUST-1045 Olumide Adeyemi
  i('2026-11-20', 'CUST-1045', 'email', 'inquiry', { orderId: 'ORD-2026-0832' }, 'Chris Dunn',
    ['Parcel at a pickup point', 'Paczka w punkcie odbioru'],
    ['The courier could not deliver SHIP-2026-103; customer asked for home delivery instead.', 'Kurier nie doręczył przesyłki SHIP-2026-103; klient poprosił o dostawę do domu.'],
    ['Redelivery is not possible for this shipment; collect at the pickup point by 27 Nov 2026.', 'Ponowne doręczenie tej przesyłki nie jest możliwe; odbiór w punkcie do 27.11.2026.']),
  i('2026-11-21', 'CUST-1045', 'phone', 'service_request', { caseId: 'CASE-2026-040' }, 'Chris Dunn',
    ["SteamChef: 'Fill water tank' message", "SteamChef: komunikat 'Napełnij zbiornik'"],
    ["Oven shows 'Fill water tank' although the tank is full.", "Piekarnik pokazuje 'Napełnij zbiornik', choć zbiornik jest pełny."],
    ['Case CASE-2026-040 opened; photos requested.', 'Założono sprawę CASE-2026-040; poproszono o zdjęcia.']),

  // CUST-1048 Zofia Kowalska
  i('2025-05-12', 'CUST-1048', 'email', 'follow_up', {}, 'Ola Wrona',
    ['Warranty transfer confirmed', 'Potwierdzenie przeniesienia gwarancji'],
    ['New owner of the ChefMix 900 (CX900-24-03117) registered; warranty WAR-0010 confirmed in her name.', 'Zarejestrowano nową właścicielkę robota ChefMix 900 (CX900-24-03117); gwarancja WAR-0010 potwierdzona na jej nazwisko.'],
    ['Customer account created.', 'Założono konto klientki.']),
  i('2026-03-04', 'CUST-1048', 'phone', 'service_request', { caseId: 'CASE-2026-007' }, 'Ola Wrona',
    ['ChefMix 900 grinding noise', 'Zgrzytanie ChefMix 900'],
    ['Grinding noise from the planetary gear at high speed.', 'Zgrzytanie przekładni planetarnej na wysokich obrotach.'],
    ['Case CASE-2026-007 opened under the transferred warranty.', 'Założono sprawę CASE-2026-007 w ramach przeniesionej gwarancji.']),
  i('2026-11-23', 'CUST-1048', 'chat', 'service_request', { caseId: 'CASE-2026-041' }, 'Maja Lis',
    ['Cracked blender jug', 'Pęknięty dzbanek blendera'],
    ['Hairline crack at the base of the QuickBlend 600 jug; a few drops leak.', 'Włoskowate pęknięcie u podstawy dzbanka QuickBlend 600; przecieka kilka kropli.'],
    ['Case CASE-2026-041 opened; photos requested.', 'Założono sprawę CASE-2026-041; poproszono o zdjęcia.']),

  // CUST-1051 Marek Nowak
  i('2026-10-20', 'CUST-1051', 'phone', 'service_request', { caseId: 'CASE-2026-033' }, 'Maja Lis',
    ['SteamChef Oven 30: H1, not heating', 'SteamChef Oven 30: H1, nie grzeje'],
    ['Oven stops heating in the middle of a programme and shows H1.', 'Piekarnik przestaje grzać w trakcie programu i pokazuje H1.'],
    ['Case CASE-2026-033 opened; courier pickup on 22 Oct; repair promised by 10 Nov 2026.', 'Założono sprawę CASE-2026-033; kurier odbierze piekarnik 22.10; naprawa obiecana do 10.11.2026.']),
  i('2026-11-12', 'CUST-1051', 'phone', 'follow_up', { caseId: 'CASE-2026-033' }, 'Maja Lis',
    ['Repair status', 'Stan naprawy'],
    ['Customer asked why the oven has not been returned yet.', 'Klient zapytał, dlaczego piekarnik jeszcze nie wrócił.'],
    ['Control board not yet delivered; call-back promised within two working days.', 'Płyta sterująca jeszcze nie dotarła; obiecano oddzwonić w ciągu dwóch dni roboczych.']),
  i('2026-11-19', 'CUST-1051', 'email', 'complaint', { caseId: 'CASE-2026-033' }, 'Maja Lis',
    ['Complaint: repair overdue', 'Reklamacja: opóźniona naprawa'],
    ['The repair promised for 10 Nov is overdue, nobody called back as promised on 12 Nov, and the customer has been without an oven for a month. He asks for a firm completion date or a replacement oven.', 'Naprawa obiecana na 10.11 jest opóźniona, nikt nie oddzwonił, choć obiecano to 12.11, a klient od miesiąca nie ma piekarnika. Prosi o konkretny termin zakończenia naprawy albo wymianę piekarnika.'],
    ['Complaint registered and forwarded to the service centre lead. No answer sent yet.', 'Reklamację zarejestrowano i przekazano kierownikowi centrum serwisowego. Odpowiedź jeszcze nie została wysłana.']),

  // CUST-1054 Elena Popescu
  i('2026-04-27', 'CUST-1054', 'phone', 'service_request', { caseId: 'CASE-2026-013' }, 'Ravi Patel',
    ['Loud grinder', 'Głośny młynek'],
    ['Grinder of the Barista Pro 500 is very loud and grinds coarsely.', 'Młynek ekspresu Barista Pro 500 jest bardzo głośny i mieli zbyt grubo.'],
    ['Case CASE-2026-013 opened; courier pickup arranged.', 'Założono sprawę CASE-2026-013; zamówiono kuriera.']),
  i('2026-05-21', 'CUST-1054', 'email', 'inquiry', { orderId: 'ORD-2026-0364' }, 'Ravi Patel',
    ['Cancel order', 'Anulowanie zamówienia'],
    ['Customer asked to cancel the AirCrisp 5 order placed the day before.', 'Klientka poprosiła o anulowanie zamówienia AirCrisp 5 złożonego dzień wcześniej.'],
    ['Order ORD-2026-0364 cancelled before dispatch; payment refunded.', 'Zamówienie ORD-2026-0364 anulowane przed wysyłką; płatność zwrócona.']),

  // CUST-1057 Lars Johansson
  i('2025-10-17', 'CUST-1057', 'chat', 'service_request', { caseId: 'CASE-2025-032' }, 'Tom Reilly',
    ['LeakGuard false alarms', 'Fałszywe alarmy LeakGuard'],
    ['Leak sensor raises alarms at night although the floor is dry.', 'Czujnik zalania w nocy włącza alarm, choć podłoga jest sucha.'],
    ['Firmware update suggested; case CASE-2025-032 solved.', 'Zalecono aktualizację oprogramowania; sprawa CASE-2025-032 rozwiązana.']),
  i('2026-01-12', 'CUST-1057', 'phone', 'service_request', { caseId: 'CASE-2026-001' }, 'Tom Reilly',
    ['Home Hub offline after a power cut', 'Home Hub offline po przerwie w zasilaniu'],
    ['Hub stays offline after a power cut.', 'Po przerwie w zasilaniu centrala pozostaje offline.'],
    ['Solved during the call (recovery mode); case CASE-2026-001 closed.', 'Rozwiązane podczas rozmowy (tryb odzyskiwania); sprawa CASE-2026-001 zamknięta.']),
  i('2026-11-16', 'CUST-1057', 'chat', 'service_request', { caseId: 'CASE-2026-038' }, 'Lena Sauer',
    ['AeroClean V10 battery does not charge', 'Akumulator AeroClean V10 się nie ładuje'],
    ['Charging light blinks red and the battery does not charge.', 'Kontrolka ładowania miga na czerwono, a akumulator się nie ładuje.'],
    ['Replacement battery ordered under warranty; case CASE-2026-038 opened.', 'Zamówiono nowy akumulator w ramach gwarancji; założono sprawę CASE-2026-038.']),

  // CUST-1060 Fatima El Amrani
  i('2025-05-09', 'CUST-1060', 'phone', 'service_request', { orderId: 'ORD-2025-0325' }, 'Chris Dunn',
    ['BreezePure Mini does not start', 'BreezePure Mini się nie włącza'],
    ['The unit delivered on 8 May does not start.', 'Urządzenie doręczone 8.05 nie włącza się.'],
    ['Treated as dead on arrival: return arranged (SHIP-2025-042) and full refund on receipt.', 'Uznano za wadliwe przy dostawie: zorganizowano zwrot (SHIP-2025-042) i pełny zwrot pieniędzy po jego otrzymaniu.']),
  i('2025-09-17', 'CUST-1060', 'phone', 'service_request', { caseId: 'CASE-2025-029' }, 'Chris Dunn',
    ['ChefMix 900 speed selector', 'Pokrętło prędkości ChefMix 900'],
    ['Speed selector jumps between speeds 4 and 7.', 'Pokrętło prędkości przeskakuje między biegami 4 i 7.'],
    ['Case CASE-2025-029 opened; courier pickup arranged.', 'Założono sprawę CASE-2025-029; zamówiono kuriera.']),
  i('2026-11-09', 'CUST-1060', 'phone', 'service_request', { caseId: 'CASE-2026-036' }, 'Ravi Patel',
    ['Milk leak on the Barista Pro 700 Duo', 'Wyciek mleka w Barista Pro 700 Duo'],
    ['Milk leaks under the machine when making cappuccino.', 'Przy robieniu cappuccino mleko wycieka pod ekspres.'],
    ['Case CASE-2026-036 opened; technician visit once the part arrives, by 4 Dec 2026.', 'Założono sprawę CASE-2026-036; wizyta technika po dostarczeniu części, do 4.12.2026.']),
]

/** 53 CRM interactions; IDs follow the date (INT-0001 is the oldest). */
export const INTERACTIONS: Interaction[] = [...ROWS]
  .sort((a, b) => a.date.localeCompare(b.date) || a.customerId.localeCompare(b.customerId))
  .map((r, n) => ({ id: `INT-${String(n + 1).padStart(4, '0')}`, ...r }))
