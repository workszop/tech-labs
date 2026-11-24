import { WARRANTIES } from './warranties'
import type { CaseStatus, Localized, ServiceCase } from './types'

const BY_SERIAL = new Map(WARRANTIES.map((w) => [w.serialNumber, w]))

type H = [date: string, en: string, pl: string]

interface CaseRow {
  id: string
  customerId: string
  serial: string
  opened: string
  status: CaseStatus
  errorCode?: string
  fault: Localized
  covered: boolean
  promised?: string
  resolved?: string
  resolution?: Localized
  shipments?: string[]
  history: H[]
}

/** Product and warranty come from the unit's serial number, so they always match. */
function k(r: CaseRow): ServiceCase {
  const w = BY_SERIAL.get(r.serial)
  if (!w) throw new Error(`cases: no warranty for serial ${r.serial}`)
  return {
    id: r.id,
    customerId: r.customerId,
    productId: w.productId,
    serialNumber: r.serial,
    warrantyId: w.id,
    openedDate: r.opened,
    status: r.status,
    errorCode: r.errorCode ?? null,
    fault: r.fault,
    coveredByWarranty: r.covered,
    promisedDate: r.promised ?? null,
    resolvedDate: r.resolved ?? null,
    resolution: r.resolution ?? null,
    shipmentIds: r.shipments ?? [],
    history: r.history.map(([date, en, pl]) => ({ date, note: { en, pl } })),
  }
}

/** 30 service cases. Statuses: open, waiting_for_part, in_repair, resolved, escalated. */
export const CASES: ServiceCase[] = [
  // 2024
  k({
    id: 'CASE-2024-014', customerId: 'CUST-1036', serial: 'BP300-24-02215', opened: '2024-05-02', status: 'resolved', covered: true,
    promised: '2024-05-16', resolved: '2024-05-14',
    fault: { en: 'Grinder jams and stops with a clicking noise.', pl: 'Młynek się blokuje i zatrzymuje z klikającym dźwiękiem.' },
    resolution: { en: 'Grinder burr carrier replaced under warranty by the service partner in Hamburg.', pl: 'Serwis partnerski w Hamburgu wymienił w ramach gwarancji nośnik żaren młynka.' },
    history: [
      ['2024-05-02', 'Case opened after a phone call.', 'Sprawa założona po rozmowie telefonicznej.'],
      ['2024-05-06', 'Machine handed in at the service partner in Hamburg.', 'Ekspres oddany do serwisu partnerskiego w Hamburgu.'],
      ['2024-05-14', 'Repaired and collected by the customer.', 'Naprawiony i odebrany przez klientkę.'],
    ],
  }),
  k({
    id: 'CASE-2024-029', customerId: 'CUST-1012', serial: 'ES1-23-12230', opened: '2024-09-14', status: 'resolved', covered: true,
    promised: '2024-10-01', resolved: '2024-09-30',
    fault: { en: 'No pressure; water runs through the coffee without crema.', pl: 'Brak ciśnienia; woda przelatuje przez kawę bez cremy.' },
    resolution: { en: 'Pump replaced under warranty.', pl: 'Pompa wymieniona w ramach gwarancji.' },
    history: [
      ['2024-09-14', 'Case opened by phone.', 'Sprawa założona telefonicznie.'],
      ['2024-09-17', 'Machine collected by courier for the service centre.', 'Kurier odebrał ekspres do centrum serwisowego.'],
      ['2024-09-26', 'Pump replaced, pressure test passed.', 'Pompa wymieniona, test ciśnienia zaliczony.'],
      ['2024-09-30', 'Machine returned to the customer.', 'Ekspres odesłany do klienta.'],
    ],
  }),

  // 2025
  k({
    id: 'CASE-2025-003', customerId: 'CUST-1038', serial: 'HHC-23-05561', opened: '2025-01-30', status: 'resolved', covered: true, resolved: '2025-01-31',
    fault: { en: 'Hub no longer connects to Wi-Fi after the customer changed his router.', pl: 'Centrala nie łączy się z Wi-Fi po wymianie routera przez klienta.' },
    resolution: { en: 'Network reset guided over the phone; hub reconnected.', pl: 'Reset ustawień sieci przeprowadzony przez telefon; centrala znów połączona.' },
    history: [
      ['2025-01-30', 'Case opened by phone; network reset explained.', 'Sprawa założona telefonicznie; wyjaśniono reset ustawień sieci.'],
      ['2025-01-31', 'Customer confirmed the hub is online again.', 'Klient potwierdził, że centrala znów działa w sieci.'],
    ],
  }),
  k({
    id: 'CASE-2025-017', customerId: 'CUST-1005', serial: 'AF5-24-20931', opened: '2025-06-02', status: 'resolved', covered: true,
    promised: '2025-06-10', resolved: '2025-06-09', shipments: ['SHIP-2025-049'],
    fault: { en: 'Non-stick coating is peeling off the basket.', pl: 'Powłoka nieprzywierająca odchodzi od kosza.' },
    resolution: { en: 'Replacement basket sent (SHIP-2025-049); the customer confirmed it fits.', pl: 'Wysłano zamienny kosz (SHIP-2025-049); klient potwierdził, że pasuje.' },
    history: [
      ['2025-06-02', 'Case opened from an e-mail with photos.', 'Sprawa założona na podstawie e-maila ze zdjęciami.'],
      ['2025-06-04', 'Replacement basket dispatched (SHIP-2025-049).', 'Wysłano zamienny kosz (SHIP-2025-049).'],
      ['2025-06-09', 'Customer confirmed the new basket fits. Case closed.', 'Klient potwierdził, że nowy kosz pasuje. Sprawa zamknięta.'],
    ],
  }),
  k({
    id: 'CASE-2025-025', customerId: 'CUST-1001', serial: 'PA200-25-07788', opened: '2025-08-13', status: 'resolved', covered: true,
    promised: '2025-08-29', resolved: '2025-08-26',
    fault: { en: 'Fan rattles at the highest speed.', pl: 'Wentylator grzechocze na najwyższym biegu.' },
    resolution: { en: 'Fan assembly replaced at the service partner in Kraków.', pl: 'Serwis partnerski w Krakowie wymienił zespół wentylatora.' },
    history: [
      ['2025-08-13', 'Case opened by phone.', 'Sprawa założona telefonicznie.'],
      ['2025-08-18', 'Unit handed in at the service partner in Kraków.', 'Urządzenie oddane do serwisu partnerskiego w Krakowie.'],
      ['2025-08-26', 'Repaired and collected by the customer.', 'Naprawione i odebrane przez klientkę.'],
    ],
  }),
  k({
    id: 'CASE-2025-029', customerId: 'CUST-1060', serial: 'CX900-25-01164', opened: '2025-09-17', status: 'resolved', covered: true,
    promised: '2025-10-01', resolved: '2025-09-29',
    fault: { en: 'Speed selector jumps between speeds 4 and 7.', pl: 'Pokrętło prędkości przeskakuje między biegami 4 i 7.' },
    resolution: { en: 'Speed control board replaced under warranty.', pl: 'Płytka sterowania prędkością wymieniona w ramach gwarancji.' },
    history: [
      ['2025-09-17', 'Case opened by phone.', 'Sprawa założona telefonicznie.'],
      ['2025-09-19', 'Mixer collected by courier for the service centre.', 'Kurier odebrał robota do centrum serwisowego.'],
      ['2025-09-29', 'Repaired and returned to the customer.', 'Naprawiony i odesłany do klientki.'],
    ],
  }),
  k({
    id: 'CASE-2025-032', customerId: 'CUST-1057', serial: 'LG1-25-04476', opened: '2025-10-17', status: 'resolved', covered: true, resolved: '2025-10-21',
    fault: { en: 'Sensor raises false leak alarms at night.', pl: 'Czujnik w nocy zgłasza fałszywe alarmy zalania.' },
    resolution: { en: 'Firmware 2.3.1 installed through the Home Hub; no false alarms since.', pl: 'Zainstalowano oprogramowanie 2.3.1 przez Home Hub; od tej pory brak fałszywych alarmów.' },
    history: [
      ['2025-10-17', 'Case opened via chat; firmware update suggested.', 'Sprawa założona na czacie; zalecono aktualizację oprogramowania.'],
      ['2025-10-21', 'Customer confirmed no false alarms for four nights. Case closed.', 'Klient potwierdził brak fałszywych alarmów przez cztery noce. Sprawa zamknięta.'],
    ],
  }),
  k({
    id: 'CASE-2025-035', customerId: 'CUST-1036', serial: 'BP300-24-02215', opened: '2025-11-12', status: 'resolved', covered: true,
    promised: '2025-11-28', resolved: '2025-11-25',
    fault: { en: 'Descaling programme stops halfway and the descale light flashes.', pl: 'Program odkamieniania zatrzymuje się w połowie, a kontrolka odkamieniania miga.' },
    resolution: { en: 'Descaling valve replaced under warranty; customer advised to use an AquaPure water filter.', pl: 'Zawór odkamieniania wymieniony w ramach gwarancji; zalecono filtr wody AquaPure.' },
    history: [
      ['2025-11-12', 'Case opened by phone.', 'Sprawa założona telefonicznie.'],
      ['2025-11-17', 'Machine handed in at the service partner in Hamburg.', 'Ekspres oddany do serwisu partnerskiego w Hamburgu.'],
      ['2025-11-25', 'Repaired and collected by the customer.', 'Naprawiony i odebrany przez klientkę.'],
    ],
  }),
  k({
    id: 'CASE-2025-037', customerId: 'CUST-1017', serial: 'RC5-25-30418', opened: '2025-12-01', status: 'resolved', covered: true, resolved: '2025-12-03',
    fault: { en: 'Robot cannot find its dock.', pl: 'Robot nie znajduje stacji dokującej.' },
    resolution: { en: 'Dock moved away from a mirrored wardrobe and the lidar cover cleaned; docking works again.', pl: 'Stację przestawiono z dala od szafy z lustrem i wyczyszczono osłonę lidaru; dokowanie znów działa.' },
    history: [
      ['2025-12-01', 'Case opened via chat; placement of the dock checked with photos.', 'Sprawa założona na czacie; ustawienie stacji sprawdzone na zdjęciach.'],
      ['2025-12-03', 'Customer confirmed the robot docks again. Case closed.', 'Klient potwierdził, że robot znów dokuje. Sprawa zamknięta.'],
    ],
  }),

  // 2026
  k({
    id: 'CASE-2026-001', customerId: 'CUST-1057', serial: 'HH1-25-02208', opened: '2026-01-12', status: 'resolved', covered: true, resolved: '2026-01-12',
    fault: { en: 'Hub stays offline after a power cut.', pl: 'Centrala pozostaje offline po przerwie w dostawie prądu.' },
    resolution: { en: 'Hub restarted in recovery mode; settings restored from the cloud backup.', pl: 'Centrala uruchomiona w trybie odzyskiwania; ustawienia przywrócone z kopii w chmurze.' },
    history: [['2026-01-12', 'Solved during the phone call. Case closed.', 'Rozwiązane w trakcie rozmowy telefonicznej. Sprawa zamknięta.']],
  }),
  k({
    id: 'CASE-2026-007', customerId: 'CUST-1048', serial: 'CX900-24-03117', opened: '2026-03-04', status: 'resolved', covered: true,
    promised: '2026-03-20', resolved: '2026-03-18',
    fault: { en: 'Grinding noise from the planetary gear at high speed.', pl: 'Zgrzytanie przekładni planetarnej na wysokich obrotach.' },
    resolution: { en: 'Gearbox replaced at the service partner in Wrocław under the transferred warranty.', pl: 'Serwis partnerski we Wrocławiu wymienił przekładnię w ramach przeniesionej gwarancji.' },
    history: [
      ['2026-03-04', 'Case opened by phone. Warranty checked: transferred to the customer on 10 May 2025, valid until 15 Jun 2027.', 'Sprawa założona telefonicznie. Sprawdzono gwarancję: przeniesiona na klientkę 10.05.2025, ważna do 15.06.2027.'],
      ['2026-03-06', 'Mixer handed in at the service partner in Wrocław.', 'Robot oddany do serwisu partnerskiego we Wrocławiu.'],
      ['2026-03-18', 'Repaired and collected by the customer.', 'Naprawiony i odebrany przez klientkę.'],
    ],
  }),
  k({
    id: 'CASE-2026-011', customerId: 'CUST-1029', serial: 'BC200-25-17760', opened: '2026-04-08', status: 'resolved', errorCode: 'E07', covered: true,
    promised: '2026-04-17', resolved: '2026-04-21',
    fault: { en: 'Error E07; water collects under the machine.', pl: 'Błąd E07; pod ekspresem zbiera się woda.' },
    resolution: { en: 'Technician replaced the water tank valve seal. Customer advised to descale regularly and use a water filter.', pl: 'Technik wymienił uszczelkę zaworu zbiornika na wodę. Zalecono regularne odkamienianie i filtr wody.' },
    history: [
      ['2026-04-08', 'Case opened by phone.', 'Sprawa założona telefonicznie.'],
      ['2026-04-17', 'Technician visit: valve seal replaced, leak test passed.', 'Wizyta technika: wymieniona uszczelka zaworu, test szczelności zaliczony.'],
      ['2026-04-21', 'Customer confirmed by e-mail that the machine no longer leaks. Case closed.', 'Klient potwierdził e-mailem, że ekspres już nie cieknie. Sprawa zamknięta.'],
    ],
  }),
  k({
    id: 'CASE-2026-013', customerId: 'CUST-1054', serial: 'BP500-26-03342', opened: '2026-04-27', status: 'resolved', covered: true,
    promised: '2026-05-08', resolved: '2026-05-06',
    fault: { en: 'Grinder very loud; the coffee grounds are coarse.', pl: 'Młynek bardzo głośny; kawa mielona zbyt grubo.' },
    resolution: { en: 'A small stone among the beans had blocked the burrs; removed and grinder recalibrated. No parts needed.', pl: 'Mały kamyk wśród ziaren zablokował żarna; usunięty, młynek skalibrowany. Bez wymiany części.' },
    history: [
      ['2026-04-27', 'Case opened by phone.', 'Sprawa założona telefonicznie.'],
      ['2026-04-29', 'Machine collected by courier for the service centre.', 'Kurier odebrał ekspres do centrum serwisowego.'],
      ['2026-05-06', 'Checked, cleaned and returned to the customer.', 'Sprawdzony, wyczyszczony i odesłany do klientki.'],
    ],
  }),
  k({
    id: 'CASE-2026-015', customerId: 'CUST-1012', serial: 'QB600-23-08840', opened: '2026-05-19', status: 'resolved', covered: false,
    promised: '2026-06-03', resolved: '2026-06-02',
    fault: { en: 'Motor smells of burning under load.', pl: 'Silnik pod obciążeniem pachnie spalenizną.' },
    resolution: { en: 'Paid repair (warranty expired on 19 Aug 2025): motor brushes replaced for EUR 45, paid by the customer.', pl: 'Naprawa odpłatna (gwarancja wygasła 19.08.2025): wymiana szczotek silnika za 45 EUR, opłacona przez klienta.' },
    history: [
      ['2026-05-19', 'Case opened by phone. Warranty expired on 19 Aug 2025; paid repair quote of EUR 45 accepted by the customer.', 'Sprawa założona telefonicznie. Gwarancja wygasła 19.08.2025; klient zaakceptował wycenę odpłatnej naprawy: 45 EUR.'],
      ['2026-05-21', 'Blender collected by courier for the service centre.', 'Kurier odebrał blender do centrum serwisowego.'],
      ['2026-06-02', 'Repaired, paid and returned to the customer.', 'Naprawiony, opłacony i odesłany do klienta.'],
    ],
  }),
  k({
    id: 'CASE-2026-017', customerId: 'CUST-1019', serial: 'BP300-25-04471', opened: '2026-06-03', status: 'resolved', covered: false, resolved: '2026-06-24',
    fault: { en: 'Machine does not heat up after a repair by a local workshop.', pl: 'Ekspres nie nagrzewa się po naprawie w lokalnym warsztacie.' },
    resolution: {
      en: 'Not covered: warranty void after an unauthorised third-party repair. A paid repair quote of EUR 160 was declined; the machine was returned unrepaired.',
      pl: 'Bez gwarancji: gwarancja unieważniona po nieautoryzowanej naprawie. Klient odrzucił wycenę odpłatnej naprawy (160 EUR); ekspres odesłano bez naprawy.',
    },
    history: [
      ['2026-06-03', 'Case opened by phone.', 'Sprawa założona telefonicznie.'],
      ['2026-06-05', 'Machine collected by courier for the service centre.', 'Kurier odebrał ekspres do centrum serwisowego.'],
      ['2026-06-12', 'Inspection: housing opened and a non-original pump fitted by a third party. Warranty voided; paid repair quote of EUR 160 sent.', 'Oględziny: obudowa otwierana, zewnętrzny warsztat zamontował nieoryginalną pompę. Gwarancja unieważniona; wysłano wycenę odpłatnej naprawy: 160 EUR.'],
      ['2026-06-20', 'Customer disputed the decision; the warranty team reviewed the photos and upheld it.', 'Klient zakwestionował decyzję; zespół gwarancyjny przejrzał zdjęcia i ją podtrzymał.'],
      ['2026-06-24', 'Quote declined; machine returned unrepaired. Case closed.', 'Wycena odrzucona; ekspres odesłany bez naprawy. Sprawa zamknięta.'],
    ],
  }),
  k({
    id: 'CASE-2026-020', customerId: 'CUST-1026', serial: 'IC2-24-04128', opened: '2026-07-02', status: 'resolved', errorCode: 'E3', covered: true,
    promised: '2026-07-12', resolved: '2026-07-10',
    fault: { en: 'Hob switches off after a few minutes and shows E3 (overheating).', pl: 'Płyta wyłącza się po kilku minutach i pokazuje E3 (przegrzanie).' },
    resolution: { en: 'Cooling fan replaced under warranty (warranty valid until 14 Jul 2026).', pl: 'Wentylator chłodzący wymieniony w ramach gwarancji (gwarancja ważna do 14.07.2026).' },
    history: [
      ['2026-07-02', 'Case opened by phone; the air vents were clear, so the unit was sent in.', 'Sprawa założona telefonicznie; otwory wentylacyjne były drożne, więc płytę wysłano do serwisu.'],
      ['2026-07-03', 'Hob collected by courier for the service centre.', 'Kurier odebrał płytę do centrum serwisowego.'],
      ['2026-07-10', 'Fan replaced and hob returned to the customer.', 'Wentylator wymieniony, płyta odesłana do klientki.'],
    ],
  }),
  k({
    id: 'CASE-2026-022', customerId: 'CUST-1031', serial: 'PA300-25-21567', opened: '2026-07-21', status: 'resolved', errorCode: 'S2', covered: true, resolved: '2026-07-23',
    fault: { en: 'Error S2; the air quality reading stays at the same value.', pl: 'Błąd S2; odczyt jakości powietrza stoi w miejscu.' },
    resolution: { en: 'Customer cleaned the particle sensor opening as described in the PureAir 300 manual; error cleared.', pl: 'Klientka wyczyściła otwór czujnika pyłu zgodnie z instrukcją PureAir 300; błąd zniknął.' },
    history: [
      ['2026-07-21', 'Case opened via chat; sensor cleaning from the manual explained.', 'Sprawa założona na czacie; wyjaśniono czyszczenie czujnika według instrukcji.'],
      ['2026-07-23', 'Customer confirmed the reading changes again. Case closed.', 'Klientka potwierdziła, że odczyt znów się zmienia. Sprawa zamknięta.'],
    ],
  }),
  k({
    id: 'CASE-2026-026', customerId: 'CUST-1029', serial: 'BC200-25-17760', opened: '2026-08-24', status: 'resolved', errorCode: 'E07', covered: true,
    promised: '2026-09-04', resolved: '2026-09-06',
    fault: { en: 'Error E07 again; water leaks under the drip tray.', pl: 'Ponownie błąd E07; woda wycieka pod tackę ociekową.' },
    resolution: { en: 'Technician replaced the pump hose connector and its seal; leak test passed. Second repair of the same fault (see CASE-2026-011).', pl: 'Technik wymienił złączkę węża pompy z uszczelką; test szczelności zaliczony. Druga naprawa tej samej usterki (zob. CASE-2026-011).' },
    history: [
      ['2026-08-24', 'Case opened via chat. Same fault as CASE-2026-011.', 'Sprawa założona na czacie. Ta sama usterka co w CASE-2026-011.'],
      ['2026-09-03', 'Technician visit: hose connector and seal replaced.', 'Wizyta technika: wymieniona złączka węża i uszczelka.'],
      ['2026-09-06', 'Customer confirmed by e-mail that the leak has stopped. Case closed.', 'Klient potwierdził e-mailem, że wyciek ustał. Sprawa zamknięta.'],
    ],
  }),
  k({
    id: 'CASE-2026-028', customerId: 'CUST-1036', serial: 'BC200-25-14420', opened: '2026-09-15', status: 'resolved', covered: true, resolved: '2026-09-21',
    shipments: ['SHIP-2026-082'],
    fault: { en: 'Bean hopper lid broke at the hinge.', pl: 'Pokrywa pojemnika na ziarna pękła przy zawiasie.' },
    resolution: { en: 'Replacement lid sent (SHIP-2026-082) and fitted by the customer.', pl: 'Wysłano zamienną pokrywę (SHIP-2026-082); klientka sama ją założyła.' },
    history: [
      ['2026-09-15', 'Case opened from an e-mail with a photo.', 'Sprawa założona na podstawie e-maila ze zdjęciem.'],
      ['2026-09-17', 'Replacement lid dispatched (SHIP-2026-082).', 'Wysłano zamienną pokrywę (SHIP-2026-082).'],
      ['2026-09-21', 'Customer confirmed the lid fits. Case closed.', 'Klientka potwierdziła, że pokrywa pasuje. Sprawa zamknięta.'],
    ],
  }),
  k({
    id: 'CASE-2026-031', customerId: 'CUST-1042', serial: 'BP500-26-10482', opened: '2026-10-06', status: 'resolved', covered: true,
    promised: '2026-10-16', resolved: '2026-10-16', shipments: ['SHIP-2026-091'],
    fault: { en: 'Steam wand produces no steam; the machine brews coffee normally.', pl: 'Dysza parowa nie wytwarza pary; kawa parzy się normalnie.' },
    resolution: { en: 'Blocked steam wand nozzle. Replacement nozzle sent (SHIP-2026-091) and fitted by the customer; steam works again.', pl: 'Zatkana końcówka dyszy parowej. Wysłano nową końcówkę (SHIP-2026-091), klientka sama ją wymieniła; para znów działa.' },
    history: [
      ['2026-10-06', 'Case opened by phone. The nozzle is a user-replaceable part; replacement ordered.', 'Sprawa założona telefonicznie. Końcówka dyszy to część wymieniana przez użytkownika; zamówiono nową.'],
      ['2026-10-13', 'Replacement nozzle dispatched (SHIP-2026-091).', 'Wysłano nową końcówkę (SHIP-2026-091).'],
      ['2026-10-15', 'Part delivered.', 'Część doręczona.'],
      ['2026-10-16', 'Customer confirmed by e-mail that steam works again. Case closed.', 'Klientka potwierdziła e-mailem, że para znów działa. Sprawa zamknięta.'],
    ],
  }),
  k({
    id: 'CASE-2026-032', customerId: 'CUST-1019', serial: 'AF5-26-33410', opened: '2026-10-15', status: 'in_repair', covered: true, promised: '2026-11-28',
    fault: { en: 'Loud rattling from the fan during cooking.', pl: 'Głośne grzechotanie wentylatora podczas pracy.' },
    history: [
      ['2026-10-15', 'Case opened by phone.', 'Sprawa założona telefonicznie.'],
      ['2026-10-19', 'Air fryer collected by courier for the service centre.', 'Kurier odebrał frytkownicę do centrum serwisowego.'],
      ['2026-11-02', 'Diagnosis: worn fan bearing; fan motor ordered. Repair promised by 28 Nov 2026.', 'Diagnoza: zużyte łożysko wentylatora; zamówiono silnik wentylatora. Naprawa obiecana do 28.11.2026.'],
      ['2026-11-18', 'Fan motor received; repair in progress.', 'Silnik wentylatora dotarł; trwa naprawa.'],
    ],
  }),
  k({
    id: 'CASE-2026-033', customerId: 'CUST-1051', serial: 'SC30-26-01277', opened: '2026-10-20', status: 'in_repair', errorCode: 'H1', covered: true, promised: '2026-11-10',
    fault: { en: 'Oven stops heating in the middle of a programme and shows H1.', pl: 'Piekarnik przestaje grzać w trakcie programu i pokazuje H1.' },
    history: [
      ['2026-10-20', 'Case opened by phone. Repair promised by 10 Nov 2026.', 'Sprawa założona telefonicznie. Naprawa obiecana do 10.11.2026.'],
      ['2026-10-22', 'Oven collected by courier for the service centre in Warsaw.', 'Kurier odebrał piekarnik do centrum serwisowego w Warszawie.'],
      ['2026-10-28', 'Diagnosis: heating element and control board faulty. Heating element replaced; control board ordered.', 'Diagnoza: uszkodzona grzałka i płyta sterująca. Grzałkę wymieniono; płytę sterującą zamówiono.'],
      ['2026-11-12', 'Customer asked about the status; told the control board had not arrived yet. Call-back promised within two working days.', 'Klient zapytał o stan naprawy; poinformowano go, że płyta sterująca jeszcze nie dotarła. Obiecano oddzwonić w ciągu dwóch dni roboczych.'],
      ['2026-11-17', 'Control board received; repair in progress. No new completion date set.', 'Płyta sterująca dotarła; trwa naprawa. Nie ustalono nowego terminu zakończenia.'],
      ['2026-11-19', 'Complaint about the overdue repair received by e-mail; forwarded to the service centre lead.', 'Reklamacja dotycząca opóźnionej naprawy wpłynęła e-mailem; przekazana kierownikowi centrum serwisowego.'],
    ],
  }),
  k({
    id: 'CASE-2026-034', customerId: 'CUST-1017', serial: 'RC5-25-30418', opened: '2026-11-03', status: 'waiting_for_part', covered: true, shipments: ['SHIP-2026-100'],
    fault: { en: "Main brush stops after about two minutes; the app shows 'Brush motor error'.", pl: "Szczotka główna staje po około dwóch minutach; aplikacja pokazuje 'Błąd silnika szczotki'." },
    history: [
      ['2026-11-03', 'Case opened by phone. Brush motor module faulty; it is user-replaceable, so a new module is sent to the customer.', 'Sprawa założona telefonicznie. Uszkodzony moduł silnika szczotki; klient może go wymienić sam, więc nowy moduł zostanie wysłany do niego.'],
      ['2026-11-10', 'Part dispatched (SHIP-2026-100); expected delivery 14 Nov 2026.', 'Część wysłana (SHIP-2026-100); przewidywane doręczenie 14.11.2026.'],
      ['2026-11-14', 'Carrier reported a delay at the sorting hub. Customer not yet informed.', 'Przewoźnik zgłosił opóźnienie w sortowni. Klient jeszcze nie został poinformowany.'],
    ],
  }),
  k({
    id: 'CASE-2026-035', customerId: 'CUST-1001', serial: 'PA200-25-07788', opened: '2026-11-06', status: 'escalated', covered: true,
    fault: { en: 'Burning smell and a crackling sound from the unit.', pl: 'Zapach spalenizny i trzaski z urządzenia.' },
    history: [
      ['2026-11-06', 'Case opened by phone. Customer told to unplug the unit and stop using it. Escalated to the product safety team.', 'Sprawa założona telefonicznie. Klientce zalecono odłączenie urządzenia i niekorzystanie z niego. Przekazano do zespołu ds. bezpieczeństwa produktów.'],
      ['2026-11-10', 'Unit collected by courier for investigation.', 'Kurier odebrał urządzenie do badania.'],
      ['2026-11-18', 'Product safety team: investigation ongoing; the customer will be offered a replacement or a refund after the report.', 'Zespół ds. bezpieczeństwa: badanie trwa; po raporcie klientka otrzyma propozycję wymiany lub zwrotu pieniędzy.'],
    ],
  }),
  k({
    id: 'CASE-2026-036', customerId: 'CUST-1060', serial: 'BP700-26-00402', opened: '2026-11-09', status: 'waiting_for_part', covered: true, promised: '2026-12-04',
    fault: { en: 'Milk system leaks milk under the machine when making cappuccino.', pl: 'System mleczny wycieka pod ekspres przy robieniu cappuccino.' },
    history: [
      ['2026-11-09', 'Case opened by phone; video diagnosis with a technician: milk pump seal set faulty. Part ordered for the service partner.', 'Sprawa założona telefonicznie; diagnoza wideo z technikiem: uszkodzony zestaw uszczelek pompy mleka. Część zamówiona dla serwisu partnerskiego.'],
      ['2026-11-16', 'Technician visit to be booked as soon as the part arrives, at the latest by 4 Dec 2026.', 'Wizyta technika zostanie umówiona po dostarczeniu części, najpóźniej do 4.12.2026.'],
    ],
  }),
  k({
    id: 'CASE-2026-037', customerId: 'CUST-1038', serial: 'HHC-23-05561', opened: '2026-11-14', status: 'escalated', covered: false, promised: '2026-11-27',
    fault: { en: 'Hub drops its Wi-Fi connection several times a day since firmware 4.2.', pl: 'Od aktualizacji 4.2 centrala kilka razy dziennie traci połączenie z Wi-Fi.' },
    history: [
      ['2026-11-14', 'Case opened by phone. Warranty expired on 16 Feb 2025 and the product is discontinued. Escalated to the product team for a firmware fix or an upgrade offer.', 'Sprawa założona telefonicznie. Gwarancja wygasła 16.02.2025, a produkt jest wycofany. Przekazano do zespołu produktowego z prośbą o poprawkę oprogramowania lub ofertę wymiany.'],
      ['2026-11-20', 'Product team acknowledged the escalation; answer expected by 27 Nov 2026.', 'Zespół produktowy potwierdził przyjęcie sprawy; odpowiedź do 27.11.2026.'],
    ],
  }),
  k({
    id: 'CASE-2026-038', customerId: 'CUST-1057', serial: 'AC10-26-29105', opened: '2026-11-16', status: 'waiting_for_part', covered: true,
    promised: '2026-11-25', shipments: ['SHIP-2026-104'],
    fault: { en: 'Battery does not charge; the charging light blinks red.', pl: 'Akumulator się nie ładuje; kontrolka ładowania miga na czerwono.' },
    history: [
      ['2026-11-16', 'Case opened via chat. Battery fault confirmed by a remote check; replacement battery ordered.', 'Sprawa założona na czacie. Usterkę akumulatora potwierdzono zdalnie; zamówiono nowy akumulator.'],
      ['2026-11-20', 'Replacement battery dispatched (SHIP-2026-104).', 'Wysłano nowy akumulator (SHIP-2026-104).'],
    ],
  }),
  k({
    id: 'CASE-2026-039', customerId: 'CUST-1023', serial: 'PA500-26-08821', opened: '2026-11-18', status: 'open', covered: true,
    fault: { en: 'Purifier no longer connects to the Northstar app after the app update.', pl: 'Po aktualizacji aplikacji oczyszczacz nie łączy się z aplikacją Northstar.' },
    history: [['2026-11-18', 'Case opened via chat; waiting for app logs from the customer.', 'Sprawa założona na czacie; czekamy na logi aplikacji od klienta.']],
  }),
  k({
    id: 'CASE-2026-040', customerId: 'CUST-1045', serial: 'SC30-25-03390', opened: '2026-11-21', status: 'open', covered: true,
    fault: { en: "Oven shows 'Fill water tank' although the tank is full.", pl: "Piekarnik pokazuje 'Napełnij zbiornik', choć zbiornik jest pełny." },
    history: [['2026-11-21', 'Case opened by phone; customer asked to send photos of the tank and the display.', 'Sprawa założona telefonicznie; poproszono klienta o zdjęcia zbiornika i wyświetlacza.']],
  }),
  k({
    id: 'CASE-2026-041', customerId: 'CUST-1048', serial: 'QB600-25-27719', opened: '2026-11-23', status: 'open', covered: true,
    fault: { en: 'Hairline crack at the base of the glass jug; a few drops leak.', pl: 'Włoskowate pęknięcie u podstawy szklanego dzbanka; przecieka kilka kropli.' },
    history: [['2026-11-23', 'Case opened via chat; photos requested to rule out impact damage.', 'Sprawa założona na czacie; poproszono o zdjęcia, by wykluczyć uszkodzenie mechaniczne.']],
  }),
]
