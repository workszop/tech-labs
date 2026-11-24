// Polskie teksty powłoki aplikacji. Kształt musi być identyczny z en/shell.ts (typ Dict).
// Polska odmiana po liczebniku (1 token, 2 tokeny, 5 tokenów). Lokalna kopia reguły z plural() w '@/i18n':
// ten plik jest zawsze po polsku, a import z '@/i18n' tworzyłby cykl (i18n/index -> pl -> i18n/index).
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (n === 1) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

const tokeny = (n: number) => plural(n, 'token', 'tokeny', 'tokenów')

export const shell = {
  langSwitch: {
    label: 'Język',
  },

  common: {
    close: 'Zamknij',
  },

  app: {
    sections: 'Sekcje',
    tabSystems: 'Systemy',
    tabWorkspace: 'Przestrzeń agenta',
    tabChat: 'Czat',
  },

  panels: {
    systems: { title: 'Systemy firmy', empty: 'Tu pojawią się systemy firmy, z których może czytać agent.' },
    workspace: { title: 'Przestrzeń agenta', empty: 'Tu pojawią się kroki agenta i wywołania narzędzi.' },
    chat: { title: 'Czat z klientem', empty: 'Tu pojawi się rozmowa z klientem.' },
  },

  header: {
    product: 'Service Agent Lab',
    tagline: 'Zobacz, jak agent AI obsługuje klienta',
    mockTooltip: 'Serwer działa w trybie demonstracyjnym offline: odpowiedzi pochodzą z gotowego zamiennika, a nie z prawdziwego modelu AI.',
    mockBadge: 'Tryb demo offline',
    usageTooltip: (u: { requestsUsed: string; requestLimit: string; tokensUsed: string; tokenLimit: string; cost: string }) =>
      `Zapytania ${u.requestsUsed}/${u.requestLimit} · Tokeny ${u.tokensUsed}/${u.tokenLimit} · szac. ${u.cost}`,
    tokensLeft: (formatted: string, n: number) => `${plural(n, 'został', 'zostały', 'zostało')} ${formatted} ${tokeny(n)}`,
    activate: 'Aktywuj',
  },

  activation: {
    title: 'Witaj w Service Agent Lab',
    subtitle: 'Zobacz krok po kroku, jak agent AI obsługuje zgłoszenie klienta.',
    formTitle: 'Wpisz kod dostępu',
    codeLabel: 'Kod dostępu',
    codePlaceholder: 'AGT-XXXX-XXXX-XXXX-XXXX-XXXX',
    checking: 'Sprawdzam kod…',
    submit: 'Aktywuj',
    help: 'Osobisty kod dostajesz od osoby prowadzącej warsztaty. Kod odblokowuje modele AI, na których działa agent. Serwer pilnuje limitu użycia przypisanego do kodu.',
    privacyLocal: 'Dane firmy w tym laboratorium są fikcyjne. Rozmowa i wyniki narzędzi agenta trafiają do dostawcy AI przez serwer Service Agent Lab.',
    sessionNote: 'Sesja jest trzymana tylko w pamięci. Po odświeżeniu strony wpisujesz kod ponownie.',
    explore: 'Najpierw się rozejrzyj',
    exploreNote: 'Bez kodu możesz obejrzeć układ ekranu. Sam agent pozostaje zablokowany.',
    apiLabel: (url: string) => `API: ${url}`,
    rateLimited: (minutes: number | null) =>
      minutes
        ? `Za dużo prób. Odczekaj ${minutes} ${plural(minutes, 'minutę', 'minuty', 'minut')} i spróbuj ponownie.`
        : 'Za dużo prób. Odczekaj kilka minut i spróbuj ponownie.',
    errors: {
      invalid_code: 'Nie rozpoznaję tego kodu dostępu. Sprawdź, czy nie ma w nim literówek. Kod wygląda tak: AGT-XXXX-XXXX-XXXX-XXXX-XXXX.',
      expired_code: 'Ten kod dostępu wygasł. Poproś osobę prowadzącą warsztaty o nowy.',
      revoked_code: 'Ten kod dostępu został unieważniony. Poproś osobę prowadzącą warsztaty o nowy.',
      too_many_sessions: 'Ten kod działa już na maksymalnej liczbie urządzeń. Wyloguj się na innym urządzeniu albo zgłoś się do osoby prowadzącej.',
      quota_exceeded: 'Ten kod wykorzystał swój limit użycia AI. Poproś osobę prowadzącą warsztaty o podniesienie limitu.',
    } as Record<string, string>,
  },

  actions: {
    sessionExpired: 'Sesja wygasła. Wpisz kod dostępu jeszcze raz.',
    loggedOut: 'Jesteś wylogowany.',
  },

  errors: {
    byCode: {
      invalid_request: 'Serwer odrzucił zapytanie jako nieprawidłowe.',
      invalid_code: 'Ten kod dostępu jest nieprawidłowy. Sprawdź, czy nie ma w nim literówki, i spróbuj ponownie.',
      expired_code: 'Ten kod dostępu stracił ważność.',
      revoked_code: 'Administrator unieważnił lub wyłączył ten kod dostępu.',
      too_many_sessions: 'Ten kod dostępu jest już używany w maksymalnej liczbie aktywnych sesji. Wyloguj się w innym miejscu albo poproś organizatora o pomoc.',
      unauthorized: 'Brak ważnej sesji. Najpierw aktywuj kod dostępu.',
      session_expired: 'Sesja się zakończyła. Wpisz kod dostępu jeszcze raz.',
      quota_exceeded: 'Limit zapytań albo tokenów tego kodu dostępu został wyczerpany.',
      rate_limited: 'Za dużo zapytań w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.',
      payload_too_large: 'Zapytanie jest większe, niż pozwala serwer.',
      origin_not_allowed: 'Ta strona nie ma pozwolenia na korzystanie z API Service Agent Lab.',
      model_not_allowed: 'Model wybiera serwer, przeglądarka nie może go zmienić.',
      upstream_unavailable: 'Dostawca modelu AI teraz nie odpowiada. Spróbuj ponownie za chwilę.',
      upstream_timeout: 'Model AI zbyt długo nie odpowiadał. Spróbuj ponownie.',
      upstream_bad_response: 'Model AI przysłał nieoczekiwaną odpowiedź. Spróbuj ponownie.',
      run_limit_exceeded: 'Agent wykorzystał limit kroków albo tokenów dla tego pytania. Zadaj pytanie jeszcze raz w nowej wiadomości.',
      not_found: 'Nie znaleziono.',
      internal: 'Nieoczekiwany błąd serwera.',
      network: 'Nie udało się połączyć z serwerem Service Agent Lab. Sprawdź połączenie z internetem i spróbuj ponownie.',
      aborted: 'Anulowano.',
    },
    activateFirst: 'Najpierw aktywuj Service Agent Lab kodem dostępu.',
    requestFailed: (status: number) => `Zapytanie się nie powiodło (HTTP ${status}).`,
    embeddingMalformed: 'Odpowiedź z wektorami miała nieprawidłowy kształt (zła liczba wektorów albo wymiarów).',
  },
}
