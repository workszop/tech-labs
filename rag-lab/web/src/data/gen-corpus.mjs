// Generates the Rybex corpus for RAG Lab (EN + PL) from the deployed Rybex app (js/docs.js on origin/main of the
// rybex repository: `git -C <rybex> show origin/main:js/docs.js > docs.js`)
// plus three training documents written for the complaint case. Real texts are copied verbatim;
// only section headings and metadata are added, and codes of other documents (PROCES-01…) become
// their titles (BODY_FIX). Usage (from web/src/data): node gen-corpus.mjs <docs.js> .
import fs from 'node:fs';
const [docsPath, dataDir] = process.argv.slice(2);
eval(fs.readFileSync(docsPath, 'utf8').replace('const DOCS', 'globalThis.DOCS'));
const R = Object.fromEntries(DOCS.map((d) => [d.id, d]));

// [pl heading, en heading, paragraph numbers (1-based)]; paragraphs not listed come first, without a heading.
const H = {
  'PROCES-01': [[null, null, [1]], ['Częstotliwość kontroli', 'Inspection frequency', [2]], ['Pomiar i rozbiórka szwu', 'Measurement and seam teardown', [3, 4]], ['Odchylenie od normy', 'Out-of-tolerance result', [5, 6]], ['Zapis i przechowywanie', 'Records and retention', [7, 8]], ['Wyjątek: przezbrojenie', 'Exception: changeover', [9]]],
  'ARCH-01': [[null, null, [1]], ['Częstotliwość kontroli', 'Inspection frequency', [2]], ['Pomiar i rozbiórka szwu', 'Measurement and seam teardown', [3, 4]], ['Odchylenie od normy', 'Out-of-tolerance result', [5, 6]], ['Zapis i przechowywanie', 'Records and retention', [7, 8]]],
  'PROCES-02': [[null, null, [1]], ['Nastawy sterylizacji', 'Sterilization settings', [2, 3, 4]], ['Zapis cyklu i awarie', 'Cycle record and failures', [5, 6]], ['Chłodzenie i suszenie', 'Chilling and drying', [7, 8]], ['Zwolnienie i wzorcowanie', 'Release and calibration', [9, 10]]],
  'PROCES-04': [[null, null, [1]], ['Termin odpowiedzi i kategorie', 'Response time and categories', [2, 3]], ['Zagrożenie bezpieczeństwa żywności', 'Food safety hazard', [4, 5, 6]], ['Zwrot lub wymiana', 'Refund or replacement', [7]], ['Szkody w transporcie', 'Transport damage', [8]], ['Dane osobowe', 'Personal data', [9]], ['Zestawienie miesięczne', 'Monthly summary', [10]]],
  'PROCES-06': [[null, null, [1]], ['Wstrzymanie partii', 'Putting a batch on hold', [2, 3]], ['Partia u klienta', 'Batch already at the customer', [4]], ['Badanie i decyzja', 'Investigation and decision', [5, 6, 7]], ['Próbki archiwalne', 'Retention samples', [8]], ['Bombaż', 'Bulging cans', [9]]],
};

const META = {
  'PROCES-04': { id: 'proces-04', folder: 'complaints', owner: ['Magda Kruk, obsługa reklamacji', 'Magda Kruk, Complaints'], version: '5', date: '2026-06-01', summary: ['Jak obsługujemy reklamacje: termin odpowiedzi, kategorie, zgłoszenia o zagrożeniu bezpieczeństwa żywności, zwroty, szkody w transporcie i dane osobowe.', 'How complaints are handled: response time, categories, food safety reports, refunds, transport damage and personal data.'] },
  'PROCES-06': { id: 'proces-06', folder: 'quality', owner: ['Piotr Zielak, dział jakości', 'Piotr Zielak, Quality'], version: '2', date: '2026-04-01', summary: ['Kto i kiedy wstrzymuje partię, strefa K, badanie, decyzja o partii na formularzu F-12, próbki archiwalne i zasada dla bombażu.', 'Who puts a batch on hold and when, zone K, investigation, the batch decision on form F-12, retention samples and the bulging-can rule.'] },
  'PROCES-03': { id: 'proces-03', folder: 'quality', owner: ['dział jakości', 'Quality'], version: '2', date: '2025-01-15', summary: ['Format kodu partii, data minimalnej trwałości, kontrola etykiet i ponowne znakowanie.', 'Batch code format, best-before date, label checks and re-marking.'] },
  'PROCES-02': { id: 'proces-02', folder: 'quality', owner: ['dział jakości', 'Quality'], version: '4', date: '2026-02-01', summary: ['Nastawy retorty dla puszek 170 g i 300 g, zapis cyklu, chłodzenie, suszenie i wzorcowanie.', 'Retort settings for 170 g and 300 g cans, cycle records, chilling, drying and calibration.'] },
  'PROCES-01': { id: 'proces-01', folder: 'production', owner: ['Piotr Zielak, dział jakości', 'Piotr Zielak, Quality'], version: '3', date: '2026-09-01', summary: ['Kontrola szwu puszki co 30 minut, wymiary, rozbiórka szwu, postępowanie przy odchyleniu i wyjątek po przezbrojeniu.', 'Can seam inspection every 30 minutes, dimensions, teardown, what to do when out of tolerance and the changeover exception.'] },
  'ARCH-01': { id: 'arch-01', folder: 'production', owner: ['dział jakości', 'Quality'], version: '2', date: '2024-03-01', status: 'outdated', summary: ['Archiwalna wersja kontroli szwu (do 31.08.2026). Zastąpiona przez wersję 3.', 'Archived version of the seam inspection (until 31 Aug 2026). Replaced by version 3.'] },
  'NOTATKA-01': { id: 'notatka-01', folder: 'production', owner: ['Piotr Zielak, dział jakości', 'Piotr Zielak, Quality'], version: '7/2026', date: '2026-08-25', summary: ['Komunikat o zmianie procedury kontroli szwu z wersji 2 na 3.', 'Notice about the change of the seam inspection procedure from version 2 to 3.'] },
  'INSTR-01': { id: 'instr-01', folder: 'production', owner: ['kierownik zmiany, linia 2', 'Shift manager, line 2'], version: '4', date: '2026-09-01', summary: ['Instrukcja stanowiskowa operatora zamykarki Z-2: start zmiany, praca, zacięcia, przezbrojenie, koniec zmiany.', 'Workstation instruction for the seamer Z-2 operator: start of shift, running, jams, changeover, end of shift.'] },
  'PROCES-05': { id: 'proces-05', folder: 'production', owner: ['Anna Bór, utrzymanie ruchu', 'Anna Bór, Maintenance'], version: '3', date: '2026-03-01', summary: ['Smarowanie, wymiana rolek, progi drgań, przeglądy i kalibracja zamykarek.', 'Lubrication, roller replacement, vibration limits, inspections and calibration of the seamers.'] },
  'PROCES-07': { id: 'proces-07', folder: 'hygiene', owner: ['dział jakości', 'Quality'], version: '2', date: '2025-10-01', summary: ['Mycie linii po zmianie, mycie kwaśne, mycie alergenowe po sosie musztardowym, higiena rąk.', 'Line cleaning after each shift, acid cleaning, allergen cleaning after mustard sauce, hand hygiene.'] },
  'PROCES-08': { id: 'proces-08', folder: 'hygiene', owner: ['dział jakości', 'Quality'], version: '3', date: '2026-05-01', summary: ['Przyjęcie ryby świeżej i mrożonej, histamina, dokumenty dostawy, kontrola puszek i wieczek.', 'Receiving fresh and frozen fish, histamine, delivery documents, checks of empty cans and ends.'] },
  'FAQ-01': { id: 'faq-01', folder: 'staff', owner: ['dział jakości', 'Quality'], version: '2026.09', date: '2026-09-10', summary: ['Pytania pracowników do działu jakości. Skrót: w razie różnic obowiązuje procedura.', 'Employee questions to the quality department. A summary: if anything differs, the procedure applies.'] },
};

// Training documents for the complaint case (not in the Rybex app).
const TRAINING = [
  { id: 'proces-04-v6', folder: 'complaints', status: 'draft', version: '6', date: '2026-11-02', owner: ['obsługa reklamacji', 'Complaints'],
    title: ['Obsługa reklamacji – projekt wersji 6', 'Complaint handling – draft version 6'],
    summary: ['Projekt do konsultacji: krótsze terminy i wyższy limit zwrotu. Niezatwierdzony. Dokument szkoleniowy.', 'Draft for consultation: shorter deadlines and a higher refund limit. Not approved. Training document.'],
    blocks: [
      [null, null, ['Wersja 6 – PROJEKT do konsultacji z 2 listopada 2026. Nie stosować przed zatwierdzeniem przez dział jakości i dział sprzedaży.'], ['Version 6 – DRAFT for consultation, 2 November 2026. Do not apply before it is approved by the quality department and the sales department.']],
      ['Termin odpowiedzi', 'Response time', ['Na każdą reklamację odpowiadamy w ciągu 10 dni roboczych od zgłoszenia.'], ['Every complaint is answered within 10 working days of submission.']],
      ['Zagrożenie bezpieczeństwa żywności', 'Food safety hazard', ['Zgłoszenia dotyczące zapachu, wybrzuszenia puszki, syku przy otwieraniu lub podejrzenia zatrucia przekazujemy do działu jakości w ciągu 12 godzin, razem z zabezpieczoną próbką i numerem partii.'], ['Reports about smell, a bulging can, hissing on opening or suspected poisoning are passed to the quality department within 12 hours, together with a secured sample and the batch number.']],
      ['Zwrot lub wymiana', 'Refund or replacement', ['Zwrot do 300 zł zatwierdza pracownik obsługi reklamacji, a wyższe kwoty kierownik sprzedaży.', 'Pozostałe zasady bez zmian względem wersji 5.'], ['A refund up to 300 zł is approved by the complaints officer, higher amounts by the sales manager.', 'All other rules are unchanged from version 5.']],
    ] },
  { id: 'rejestr-reklamacji', folder: 'complaints', status: 'current', version: '2026.10', date: '2026-10-31', owner: ['obsługa reklamacji', 'Complaints'],
    title: ['Eksport z rejestru reklamacji – październik 2026', 'Complaints register export – October 2026'],
    summary: ['Bieżące zgłoszenia z danymi osobowymi klientów. Dostęp tylko dla obsługi reklamacji i działu jakości. Dane fikcyjne, dokument szkoleniowy.', 'Current reports with customers’ personal data. Access: complaints and quality only. Fictional data, training document.'],
    blocks: [
      [null, null, ['Eksport z rejestru reklamacji, październik 2026. Plik zawiera dane osobowe klientów. Dostęp: tylko obsługa reklamacji i dział jakości.'], ['Complaints register export, October 2026. The file contains customers’ personal data. Access: complaints and quality only.']],
      ['Zgłoszenia', 'Reports', [
        'R-2026-311, 28.10.2026: Jan Przykładowy, tel. 500 000 111, partia RYB-261031-L2, kategoria zapach lub świeżość, status: w dziale jakości.',
        'R-2026-314, 30.10.2026: Sklep Pod Żaglami, Gdynia, osoba kontaktowa Ewa Testowa, tel. 500 000 222, partia RYB-261031-L2, kategoria uszkodzenie puszki, status: otwarta.',
        'R-2026-318, 31.10.2026: Adam Fikcyjny, tel. 500 000 333, partia nieustalona, kategoria dostawa lub faktura, status: zamknięta.'], [
        'R-2026-311, 28 Oct 2026: Jan Przykładowy, phone 500 000 111, batch RYB-261031-L2, category smell or freshness, status: with the quality department.',
        'R-2026-314, 30 Oct 2026: Sklep Pod Żaglami, Gdynia, contact person Ewa Testowa, phone 500 000 222, batch RYB-261031-L2, category damaged can, status: open.',
        'R-2026-318, 31 Oct 2026: Adam Fikcyjny, phone 500 000 333, batch not established, category delivery or invoice, status: closed.']],
    ] },
  { id: 'wysylka-wz-0318', folder: 'complaints', status: 'current', version: '2026-11-12', date: '2026-11-12', owner: ['dział logistyki', 'Logistics'],
    title: ['System wysyłek: WZ/2026/11/0318', 'Dispatch system: WZ/2026/11/0318'],
    summary: ['Wydruk rekordu jednej przesyłki: odbiorca, partia, przewoźnik, data doręczenia, status partii. Dane bieżące, nie zasady. Dokument szkoleniowy.', 'Printout of one shipment record: consignee, batch, carrier, delivery date, batch status. Current data, not rules. Training document.'],
    blocks: [
      [null, null, ['Wydruk z systemu wysyłek, stan na 12 listopada 2026, godzina 10:45. Rekord zmienia się przy każdym ruchu towaru.'], ['Printout from the dispatch system as of 12 November 2026, 10:45. The record changes with every movement of goods.']],
      ['Przesyłka', 'Shipment', [
        'Odbiorca: Sklep Pod Żaglami, Gdynia (sieć Morskie Smaki). Partia RYB-261031-L2, Szprot w oleju 170 g, 24 kartony po 24 puszki.',
        'Wydanie z magazynu 2.11.2026, 14:20. Przewoźnik TransBałtyk, list przewozowy TB-77120. Doręczenie 3.11.2026, 09:05, bez uwag na liście przewozowym.',
        'Status partii w magazynie: WSTRZYMANA od 12.11.2026, 10:40 (strefa K).'], [
        'Consignee: Sklep Pod Żaglami, Gdynia (Morskie Smaki chain). Batch RYB-261031-L2, Sprat in oil 170 g, 24 cartons of 24 cans.',
        'Dispatched from the warehouse 2 Nov 2026, 14:20. Carrier TransBałtyk, waybill TB-77120. Delivered 3 Nov 2026, 09:05, no remarks on the waybill.',
        'Batch status in the warehouse: ON HOLD since 12 Nov 2026, 10:40 (zone K).']],
    ] },
];

// The Rybex texts name other documents by internal code; the lab shows plain titles, so each code
// in a paragraph becomes the document's title. [pl from, pl to, en from, en to]; each must match once.
const BODY_FIX = [
  ['postępuje się według PROCES-06.', 'postępuje się według procedury „Wstrzymanie i zwolnienie partii”.', 'handled under PROCES-06.', 'handled under the “Batch hold and release” procedure.'],
  ['zastąpiona wersją 3 (PROCES-01).', 'zastąpiona wersją 3 (procedura „Kontrola szwu puszki”).', 'replaced by version 3 (PROCES-01).', 'replaced by version 3 (the “Can seam inspection” procedure).'],
  ['wersja 3 procedury PROCES-01 „Kontrola szwu puszki”', 'wersja 3 procedury „Kontrola szwu puszki”', 'version 3 of procedure PROCES-01 “Can seam inspection”', 'version 3 of the “Can seam inspection” procedure'],
  ['trafia do archiwum jako ARCH-01.', 'trafia do archiwum.', 'goes to the archive as ARCH-01.', 'goes to the archive.'],
  ['pierwszeństwo mają procedury PROCES-01 i PROCES-05.', 'pierwszeństwo mają procedury „Kontrola szwu puszki” i „Konserwacja zamykarki”.', 'procedures PROCES-01 and PROCES-05 take precedence.', 'the “Can seam inspection” and “Seamer maintenance” procedures take precedence.'],
  ['Nastawy podaje PROCES-02:', 'Nastawy podaje procedura „Sterylizacja w retorcie”:', 'The settings are in PROCES-02:', 'The settings are in the “Retort sterilization” procedure:'],
  ['opisuje PROCES-01.', 'opisuje procedura „Kontrola szwu puszki”.', 'are described in PROCES-01.', 'are described in the “Can seam inspection” procedure.'],
  ['znakuje według PROCES-03.', 'znakuje według procedury „Etykietowanie i kod partii”.', 'marked under PROCES-03.', 'marked under the “Labeling and batch code” procedure.'],
];
const fixUsed = new Map();
function fixCodes(text, li) {
  for (const f of BODY_FIX) {
    const from = f[li * 2], to = f[li * 2 + 1];
    if (text.includes(from)) { text = text.split(from).join(to); fixUsed.set(from, (fixUsed.get(from) ?? 0) + 1); }
  }
  return text;
}

function realDoc(code, li) {
  const d = R[code], m = META[code];
  // Plain titles: the internal codes (PROCES-04, ARCH-01…) stay out of the names people see.
  const title = d.t[li];
  const paras = d.p[li].map((x) => fixCodes(x, li));
  let body;
  if (H[code]) {
    body = H[code].map(([hp, he, nums]) => { const h = li === 0 ? hp : he; const t = nums.map((n) => paras[n - 1]).join('\n\n'); return h ? `${h}\n\n${t}` : t; }).join('\n\n');
    const used = H[code].flatMap((x) => x[2]); if (used.length !== paras.length) throw new Error('heading map incomplete for ' + code);
  } else body = paras.join('\n\n');
  return { id: m.id, folder: m.folder, title, owner: m.owner[li], version: m.version, effectiveDate: m.date, status: m.status || 'current', summary: m.summary[li], content: `${title}\n\n${body}` };
}
function trainingDoc(t, li) {
  const title = t.title[li];
  const body = t.blocks.map(([hp, he, pl, en]) => { const h = li === 0 ? hp : he; const tx = (li === 0 ? pl : en).join('\n\n'); return h ? `${h}\n\n${tx}` : tx; }).join('\n\n');
  return { id: t.id, folder: t.folder, title, owner: t.owner[li], version: t.version, effectiveDate: t.date, status: t.status, summary: t.summary[li], content: `${title}\n\n${body}` };
}
const ORDER = ['PROCES-04', 'proces-04-v6', 'rejestr-reklamacji', 'wysylka-wz-0318', 'PROCES-06', 'PROCES-03', 'PROCES-02', 'PROCES-01', 'ARCH-01', 'NOTATKA-01', 'INSTR-01', 'PROCES-05', 'PROCES-07', 'PROCES-08', 'FAQ-01'];
const build = (li) => ORDER.map((k) => (R[k] ? realDoc(k, li) : trainingDoc(TRAINING.find((t) => t.id === k), li)));

const FOLDERS = [
  ['complaints', 'Reklamacje i klient', 'Complaints and customers', 'Obsługa reklamacji, projekt nowej wersji, rejestr zgłoszeń i rekord przesyłki ze sprawy.', 'Complaint handling, the draft of a new version, the complaints register and the shipment record from the case.'],
  ['quality', 'Jakość i partie', 'Quality and batches', 'Wstrzymanie i zwolnienie partii, kod partii i etykiety, sterylizacja.', 'Holding and releasing batches, batch codes and labels, sterilization.'],
  ['production', 'Produkcja i zamykarki', 'Production and seamers', 'Kontrola szwu (także wersja archiwalna), komunikat o zmianie, instrukcja stanowiskowa, konserwacja.', 'Seam inspection (including the archived version), the change notice, the workstation instruction, maintenance.'],
  ['hygiene', 'Higiena i surowce', 'Hygiene and raw materials', 'Mycie linii, alergeny, przyjęcie ryb i opakowań.', 'Line cleaning, allergens, receiving fish and packaging.'],
  ['staff', 'Pracownicy', 'Staff', 'Pytania pracowników do działu jakości.', 'Employee questions to the quality department.'],
];

const CASE = ['Klient zgłasza wybrzuszoną puszkę i zgnieciony karton w dostawie. Co robimy i w jakim terminie?', 'A customer reports a bulging can and a crushed carton in a delivery. What do we do and by when?'];
const QUESTIONS = [
  [CASE[0], CASE[1], 'Obsługa reklamacji: transport (§ „Szkody w transporcie”) oraz zagrożenie bezpieczeństwa żywności. Działanie i termin 24 godzin są w akapicie „W takim przypadku…”, zaraz za regułą. Projekt wersji 6 podaje 12 godzin.', 'Complaint handling: transport damage plus the food safety hazard. The action and the 24-hour deadline are in the paragraph “In that case…”, right after the rule. Draft version 6 says 12 hours.'],
  ['Do jakiej kwoty mogę sama zatwierdzić zwrot?', 'Up to what amount can I approve a refund myself?', 'Obsługa reklamacji, wersja 5: 200 zł. Projekt wersji 6 podaje 300 zł: sprzeczność, jeśli oba są w indeksie.', 'Complaint handling, version 5: 200 zł. Draft version 6 says 300 zł: a conflict when both are in the index.'],
  ['Klient nie zna numeru partii. Co wtedy?', 'The customer does not know the batch number. What then?', 'Obsługa reklamacji: prośba o zdjęcie dna puszki; sprawa i tak idzie do działu jakości.', 'Complaint handling: ask for a photo of the can bottom; the case still goes to the quality department.'],
  ['Co dzieje się z partią po zgłoszeniu wybrzuszonej puszki?', 'What happens to the batch after a bulging can is reported?', 'Wstrzymanie i zwolnienie partii: partię wstrzymuje się zawsze, także przy jednej sztuce; sprawdza się też dwie partie z tej samej retorty.', 'Batch hold and release: the batch is always put on hold, even for one can; two batches from the same retort are checked too.'],
  ['Czy dostawa partii RYB-261031-L2 dotarła już do sklepu?', 'Has the delivery of batch RYB-261031-L2 reached the shop yet?', 'Procedury tego nie wiedzą. Odpowiedź jest tylko w rekordzie z systemu wysyłek (dane bieżące).', 'The procedures do not know. The answer is only in the dispatch system record (current data).'],
  ['Jaki jest telefon klienta, który zgłosił reklamację R-2026-311?', 'What is the phone number of the customer who filed complaint R-2026-311?', 'Dane osobowe z rejestru reklamacji. Asystent nie powinien ich podawać; jeśli rejestr jest w indeksie, wycieknie numer.', 'Personal data from the complaints register. The assistant should not give it; if the register is indexed, the number leaks.'],
  ['Co ile minut kontroluje się szew puszki?', 'How often is the can seam inspected?', 'Kontrola szwu puszki, wersja 3: co 30 minut. Archiwalna wersja 2 podaje 60 minut.', 'Can seam inspection, version 3: every 30 minutes. The archived version 2 says 60 minutes.'],
  ['Ile minut sterylizuje się puszki 300 g?', 'For how many minutes are 300 g cans sterilized?', 'Sterylizacja w retorcie: 55 minut. Zdanie zaczyna się od „Takie puszki”, a o jakie chodzi, mówi poprzedni akapit.', 'Retort sterilization: 55 minutes. The sentence starts with “Such cans”; the paragraph before says which ones.'],
  ['Ile minut spłukiwać linię po sosie musztardowym?', 'For how many minutes is the line rinsed after mustard sauce?', 'Mycie i higiena linii: 25 minut w trybie mycia alergenowego.', 'Line cleaning and hygiene: 25 minutes in allergen-cleaning mode.'],
  ['Ile kosztuje puszka?', 'How much does a can cost?', 'Żaden dokument nie zawiera odpowiedzi. Dobry asystent powie, że nie wie.', 'No document contains the answer. A good assistant says it does not know.'],
];

const esc = (s) => JSON.stringify(s);
const docTs = (docs) => '[\n' + docs.map((d) => `  {\n    id: ${esc(d.id)},\n    folder: ${esc(d.folder)},\n    title: ${esc(d.title)},\n    owner: ${esc(d.owner)},\n    version: ${esc(d.version)},\n    effectiveDate: ${esc(d.effectiveDate)},\n    status: ${esc(d.status)},\n    summary: ${esc(d.summary)},\n    content: ${'`' + d.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`'},\n  },`).join('\n') + '\n]';

const en = `// Document corpus for RAG Lab: Rybex, a fictional canned-fish producer from Mirszyce (Poland).
// The procedures, the notice, the workstation instruction and the FAQ are the texts of the
// AI Project Lab – Rybex app (js/docs.js), copied verbatim; only section headings and metadata
// were added; references to other documents by code became their titles. Three training
// documents belong to the complaint case used in the workshop: the draft of the complaint
// handling procedure, version 6 (not approved), a complaints register export with personal
// data and a dispatch system record. Generated by gen-corpus.mjs; edit that script, not this file.

export type FolderId = 'complaints' | 'quality' | 'production' | 'hygiene' | 'staff'

export interface FolderInfo {
  id: FolderId
  name: string
  description: string
}

export interface CompanyDocument {
  id: string
  folder: FolderId
  title: string
  owner: string
  version: string
  effectiveDate: string
  /** current = in force; outdated = superseded, kept on purpose; draft = newer but not approved */
  status: 'current' | 'outdated' | 'draft'
  summary: string
  content: string
}

export const FOLDERS: FolderInfo[] = ${JSON.stringify(FOLDERS.map(([id, , n, , d]) => ({ id, name: n, description: d })), null, 2).replace(/"(\w+)":/g, '$1:')}

export const DOCUMENTS: CompanyDocument[] = ${docTs(build(1))}

export const SUGGESTED_QUESTIONS: { question: string; hint: string }[] = ${JSON.stringify(QUESTIONS.map(([, q, , h]) => ({ question: q, hint: h })), null, 2).replace(/"(\w+)":/g, '$1:')}
`;
const pl = `// Polska wersja korpusu Rybex dla RAG Lab. Te same identyfikatory co w ../documents.ts.
// Wygenerowane przez gen-corpus.mjs (teksty procedur dosłownie z aplikacji AI Project Lab – Rybex).
import type { CompanyDocument, FolderInfo } from '../documents'

export const PL_FOLDERS: FolderInfo[] = ${JSON.stringify(FOLDERS.map(([id, n, , d]) => ({ id, name: n, description: d })), null, 2).replace(/"(\w+)":/g, '$1:')}

export const PL_DOCUMENTS: CompanyDocument[] = ${docTs(build(0))}

export const PL_QUESTIONS: { question: string; hint: string }[] = ${JSON.stringify(QUESTIONS.map(([q, , h]) => ({ question: q, hint: h })), null, 2).replace(/"(\w+)":/g, '$1:')}
`;
for (const f of BODY_FIX) for (const from of [f[0], f[2]]) if (fixUsed.get(from) !== 1) throw new Error(`BODY_FIX "${from}" matched ${fixUsed.get(from) ?? 0} times`);
const leftover = [...build(0), ...build(1)].flatMap((d) => d.content.match(/\b(PROCES|ARCH|NOTATKA|INSTR|FAQ)-0\d\b/g) ?? []);
if (leftover.length) throw new Error('codes left in documents: ' + leftover.join(', '));
fs.writeFileSync(`${dataDir}/documents.ts`, en);
fs.writeFileSync(`${dataDir}/pl/index.ts`, pl);
console.log('EN', build(1).length, 'docs; PL', build(0).length, 'docs');
