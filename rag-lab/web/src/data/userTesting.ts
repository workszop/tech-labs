// Simulated conversations for the "User testing" exercise. Fixed on purpose: every group rates the
// same answers, each with one typical RAG failure, first with thumbs, then with structured feedback.
// Facts come from "Obsługa reklamacji" (version 5), its draft version 6 and the complaints register.
import type { Lang } from '@shared/api-types'

export type FeedbackTag = 'correct' | 'partial' | 'wrong' | 'wrongDocs' | 'noSource' | 'tooShort' | 'tooLong' | 'personalData'
export const FEEDBACK_TAGS: FeedbackTag[] = ['correct', 'partial', 'wrong', 'wrongDocs', 'noSource', 'tooShort', 'tooLong', 'personalData']

/** Where in the pipeline the answer is fixed. */
export type FixArea = 'none' | 'sources' | 'chunking' | 'retrieval' | 'prompt' | 'privacy'

export interface ScenarioText {
  question: string
  answer: string
  /** What really went wrong (shown after both rounds). */
  cause: string
  /** Where and how to fix it. */
  fix: string
}

export interface Scenario {
  id: string
  citedDocIds: string[]
  /** Tags a careful tester would give; any match counts as a hit. */
  expected: FeedbackTag[]
  fix: FixArea
  text: Record<Lang, ScenarioText>
}

const CASE: Record<Lang, string> = {
  pl: 'Klient zgłasza wybrzuszoną puszkę i zgnieciony karton w dostawie. Co robimy i w jakim terminie?',
  en: 'A customer reports a bulging can and a crushed carton in a delivery. What do we do and by when?',
}

export const SCENARIOS: Scenario[] = [
  {
    id: 's-correct',
    citedDocIds: ['proces-04'],
    expected: ['correct'],
    fix: 'none',
    text: {
      pl: {
        question: CASE.pl,
        answer: 'Wybrzuszona puszka to potencjalne zagrożenie bezpieczeństwa żywności. Zabezpieczamy próbkę, zapisujemy numer partii i przekazujemy sprawę do działu jakości w ciągu 24 godzin. Klienta prosimy, żeby nie wyrzucał puszki i nie jadł jej zawartości. Zgnieciony karton to szkoda w transporcie: zgłaszamy ją przewoźnikowi w ciągu 7 dni od dostawy, ze zdjęciami i listem przewozowym.',
        cause: 'Nic nie poszło źle. W kontekście był właściwy dokument, a odpowiedź obejmuje oba problemy razem z terminami.',
        fix: 'Bez poprawki. Zapiszcie to pytanie jako test, który ma przechodzić po każdej zmianie.',
      },
      en: {
        question: CASE.en,
        answer: 'A bulging can is a potential food safety hazard. We secure a sample, record the batch number and pass the case to the quality department within 24 hours. We ask the customer not to throw the can away and not to eat its contents. The crushed carton is transport damage: we report it to the carrier within 7 days of delivery, with photos and the waybill.',
        cause: 'Nothing went wrong. The right document was in the context and the answer covers both problems with their deadlines.',
        fix: 'No fix. Keep this question as a test that must pass after every change.',
      },
    },
  },
  {
    id: 's-draft',
    citedDocIds: ['proces-04-v6'],
    expected: ['wrong', 'wrongDocs'],
    fix: 'sources',
    text: {
      pl: {
        question: CASE.pl,
        answer: 'Wybrzuszona puszka to zagrożenie bezpieczeństwa żywności. Zgłoszenie przekazujemy do działu jakości w ciągu 12 godzin, razem z zabezpieczoną próbką i numerem partii. Na odpowiedź dla klienta mamy 10 dni roboczych.',
        cause: 'Do kontekstu trafił niezatwierdzony projekt wersji 6. Odpowiedź brzmi pewnie, ale terminy 12 godzin i 10 dni roboczych jeszcze nie obowiązują, a o kartonie i przewoźniku nie ma ani słowa.',
        fix: 'Wybór dokumentów: usuńcie projekt z bazy albo włączcie etykietę fragmentu ze statusem „PROJEKT, NIEZATWIERDZONY”.',
      },
      en: {
        question: CASE.en,
        answer: 'A bulging can is a food safety hazard. We pass the report to the quality department within 12 hours, together with a secured sample and the batch number. We have 10 working days to answer the customer.',
        cause: 'The unapproved draft version 6 reached the context. The answer sounds confident, but the 12 hours and 10 working days are not in force yet, and the carton and the carrier are not mentioned at all.',
        fix: 'Document selection: remove the draft from the knowledge base, or turn on the chunk label with the status "DRAFT, NOT APPROVED".',
      },
    },
  },
  {
    id: 's-partial',
    citedDocIds: ['proces-04'],
    expected: ['partial'],
    fix: 'chunking',
    text: {
      pl: {
        question: CASE.pl,
        answer: 'Zgnieciony karton to szkoda w transporcie. Zgłaszamy ją przewoźnikowi w ciągu 7 dni od dostawy i dołączamy zdjęcia oraz list przewozowy.',
        cause: 'Wyszukiwanie znalazło fragment o transporcie, ale akapit „W takim przypadku… w ciągu 24 godzin” został odcięty od reguły o wybrzuszonej puszce i nie trafił do kontekstu.',
        fix: 'Podział dokumentów: zmieńcie rozmiar fragmentu albo nakładanie, albo dołóżcie etykietę z nagłówkiem sekcji.',
      },
      en: {
        question: CASE.en,
        answer: 'The crushed carton is transport damage. We report it to the carrier within 7 days of delivery and attach photos and the waybill.',
        cause: 'Retrieval found the transport chunk, but the paragraph "In that case… within 24 hours" was cut away from the bulging-can rule and never reached the context.',
        fix: 'Splitting documents: change the chunk size or the overlap, or add the label with the section heading.',
      },
    },
  },
  {
    id: 's-long',
    citedDocIds: ['proces-04'],
    expected: ['tooLong'],
    fix: 'prompt',
    text: {
      pl: {
        question: CASE.pl,
        answer: 'Dziękujemy za pytanie. Procedura obsługi reklamacji w wersji 5 obowiązuje od 1 czerwca 2026, a jej właścicielką jest Magda Kruk. Każde zgłoszenie dostaje numer w rejestrze reklamacji i jedną kategorię: zapach lub świeżość, uszkodzenie puszki, etykieta lub kod, jakość produktu, dostawa lub faktura. Na każdą reklamację odpowiadamy w ciągu 14 dni. Wybrzuszona puszka to potencjalne zagrożenie bezpieczeństwa żywności, niezależnie od kategorii: zabezpieczamy próbkę, zapisujemy numer partii i w ciągu 24 godzin przekazujemy sprawę do działu jakości, a klienta prosimy, żeby nie wyrzucał puszki i nie jadł jej zawartości. Zgnieciony karton zgłaszamy przewoźnikowi w ciągu 7 dni od dostawy, ze zdjęciami i listem przewozowym. Klientowi możemy zaproponować zwrot pieniędzy lub wymianę, a zwrot do 200 zł zatwierdza pracownik obsługi reklamacji. Dane osobowe klienta przechowujemy 12 miesięcy od zamknięcia sprawy. Raz w miesiącu zestawienie zgłoszeń trafia do dyrekcji zakładu i jest omawiane na przeglądzie jakości.',
        cause: 'Treść jest poprawna, ale model przepisał prawie całą procedurę. Pracownik musi sam znaleźć w tym dwa terminy, o które pytał.',
        fix: 'Prompt: poproście o krótką odpowiedź, najpierw działanie i termin, bez powtarzania całej procedury. Pomaga też mniejsze top-k.',
      },
      en: {
        question: CASE.en,
        answer: 'Thank you for your question. Version 5 of the complaint handling procedure has been in force since 1 June 2026, and its owner is Magda Kruk. Every report gets a number in the complaints register and one category: smell or freshness, damaged can, label or code, product quality, delivery or invoice. Every complaint is answered within 14 days. A bulging can is a potential food safety hazard, whatever the category: we secure a sample, record the batch number and pass the case to the quality department within 24 hours, and we ask the customer not to throw the can away and not to eat its contents. The crushed carton is reported to the carrier within 7 days of delivery, with photos and the waybill. We can offer the customer a refund or a replacement, and a refund up to 200 zł is approved by the complaints officer. Customers’ personal data is kept for 12 months after the case is closed. Once a month a summary of reports goes to the plant management and is discussed at the quality review.',
        cause: 'The content is right, but the model copied almost the whole procedure. The employee has to dig out the two deadlines they asked about.',
        fix: 'Prompt: ask for a short answer, action and deadline first, without repeating the whole procedure. A smaller top-k helps too.',
      },
    },
  },
  {
    id: 's-short',
    citedDocIds: [],
    expected: ['tooShort', 'noSource', 'partial'],
    fix: 'prompt',
    text: {
      pl: {
        question: CASE.pl,
        answer: 'Proszę skontaktować się z działem jakości.',
        cause: 'Odpowiedź nie jest fałszywa, ale nie podaje terminów, pomija przewoźnika i nie wskazuje źródła. Nie da się jej sprawdzić ani na jej podstawie działać.',
        fix: 'Prompt: wymagajcie konkretnych kroków, terminów i odwołania do dokumentu, z którego pochodzą.',
      },
      en: {
        question: CASE.en,
        answer: 'Please contact the quality department.',
        cause: 'The answer is not false, but it gives no deadlines, skips the carrier and names no source. Nobody can check it or act on it.',
        fix: 'Prompt: require concrete steps, deadlines and a reference to the document they come from.',
      },
    },
  },
  {
    id: 's-phone',
    citedDocIds: ['rejestr-reklamacji'],
    expected: ['personalData'],
    fix: 'privacy',
    text: {
      pl: {
        question: 'Jaki jest telefon klienta, który zgłosił reklamację R-2026-311?',
        answer: 'Reklamację R-2026-311 zgłosił Jan Przykładowy, tel. 500 000 111. Sprawa dotyczy partii RYB-261031-L2 i jest teraz w dziale jakości.',
        cause: 'Rejestr reklamacji z danymi osobowymi był w bazie, więc asystent podał telefon klienta każdemu, kto zapytał. Odpowiedź zgadza się z dokumentem, a mimo to nie powinna paść.',
        fix: 'Ochrona danych: nie indeksujcie rejestru z danymi osobowymi i dodajcie do promptu zakaz podawania danych osobowych.',
      },
      en: {
        question: 'What is the phone number of the customer who filed complaint R-2026-311?',
        answer: 'Complaint R-2026-311 was filed by Jan Przykładowy, phone 500 000 111. It concerns batch RYB-261031-L2 and is now with the quality department.',
        cause: 'The complaints register with personal data was in the knowledge base, so the assistant gave the customer’s phone number to anyone who asked. The answer matches the document and still should never have been given.',
        fix: 'Data protection: do not index the register with personal data, and tell the model in the prompt never to give out personal data.',
      },
    },
  },
  {
    id: 's-idk',
    citedDocIds: ['faq-01'],
    expected: ['wrong', 'wrongDocs'],
    fix: 'retrieval',
    text: {
      pl: {
        question: 'Klient nie zna numeru partii. Co wtedy?',
        answer: 'Nie wiem. Dokumenty, które dostałem, nie opisują takiej sytuacji.',
        cause: 'Odpowiedź jest w procedurze obsługi reklamacji (zdjęcie dna puszki, dopisek „partia nieustalona”), ale do kontekstu trafiły fragmenty z pytań pracowników. Wyszukiwanie chybiło.',
        fix: 'Wyszukiwanie: zwiększcie top-k, sprawdźcie podobieństwo fragmentów w karcie „Wyszukiwanie” albo dołóżcie etykietę z nagłówkiem sekcji.',
      },
      en: {
        question: 'The customer does not know the batch number. What then?',
        answer: 'I don’t know. The documents I was given do not describe this situation.',
        cause: 'The answer is in the complaint handling procedure (a photo of the can bottom, the note "batch not established"), but the context got chunks from the employee questions. Retrieval missed.',
        fix: 'Retrieval: raise top-k, check the chunk similarity on the "Retrieval" tab, or add the label with the section heading.',
      },
    },
  },
]
