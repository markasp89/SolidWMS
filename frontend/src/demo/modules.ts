/**
 * Module registry (config/modules.php + ModuleManager).
 */
import { db } from './db'
import { invalid } from './http'

interface ModuleDefinition {
  key: string
  name: string
  description: string
  group?: string
  required?: boolean
  depends?: string[]
}

export const MODULES: ModuleDefinition[] = [
  { key: 'core', name: 'Rdzeń', description: 'Rejestr modułów, role, wspólne mechanizmy.', required: true },
  { key: 'auth', name: 'Logowanie', description: 'Logowanie i sesje (tokeny API).', required: true },
  { key: 'users', name: 'Użytkownicy', description: 'Konta użytkowników i role.', required: true },
  { key: 'warehouses', name: 'Magazyny', description: 'Magazyny, rzuty z góry i sektory.', required: true },
  {
    key: 'inventory',
    name: 'Produkty i stany',
    description: 'Produkty, lokalizacje, wyszukiwarka „Gdzie jest?” i historia operacji.',
    required: true,
  },
  { key: 'settings', name: 'Ustawienia', description: 'Moduły, eksport i import danych.', required: true },
  { key: 'scanning', name: 'Skanowanie kodów', description: 'Skanowanie kodów kreskowych i QR aparatem telefonu.', group: 'Hala' },
  { key: 'labels', name: 'Etykiety QR', description: 'Drukowanie etykiet QR dla sektorów, palet i produktów.', group: 'Hala' },
  { key: 'pallets', name: 'Palety', description: 'Palety z numerem i zawartością, przenoszone jednym ruchem.', group: 'Hala' },
  {
    key: 'offline',
    name: 'Aplikacja i tryb offline',
    description: 'Instalacja na telefonie (PWA) i kolejka operacji przy braku sieci.',
    group: 'Hala',
  },
  { key: 'slots', name: 'Miejsca w sektorze', description: 'Półka, poziom i gniazdo w sektorze (np. A1-03-2).', group: 'Lokalizacja' },
  { key: 'floors', name: 'Piętra i hale', description: 'Kilka rzutów w jednym magazynie z przełącznikiem pięter.', group: 'Lokalizacja' },
  {
    key: 'suggestions',
    name: 'Podpowiedzi lokalizacji',
    description: 'Przy przyjęciu podpowiada sektor, w którym produkt już leży.',
    group: 'Lokalizacja',
  },
  { key: 'stocktaking', name: 'Inwentaryzacja', description: 'Przeliczanie sektora na telefonie i zbiorcza korekta.', group: 'Kontrola' },
  { key: 'batches', name: 'Partie i daty ważności', description: 'Numery partii, daty przydatności, FEFO i ostrzeżenia.', group: 'Kontrola' },
  { key: 'alerts', name: 'Stany minimalne i alerty', description: 'Powiadomienia w aplikacji i e-mailem przy niskim stanie.', group: 'Kontrola' },
  { key: 'photos', name: 'Zdjęcia', description: 'Zdjęcia produktów i miejsc odłożenia towaru.', group: 'Kontrola' },
  { key: 'documents', name: 'Dokumenty PZ/WZ', description: 'Przyjęcia i wydania wielu pozycji z wydrukiem PDF.', group: 'Procesy' },
  { key: 'picking', name: 'Kompletacja zamówień', description: 'Listy zbierania posortowane po sektorach.', group: 'Procesy' },
  {
    key: 'reports',
    name: 'Raporty',
    description: 'Zajętość sektorów, rotacja towaru, aktywność pracowników, eksport CSV.',
    group: 'Procesy',
  },
  { key: 'warehouse_access', name: 'Dostęp do magazynów', description: 'Ograniczenie pracowników do wybranych magazynów.', group: 'Organizacja' },
  { key: 'integrations', name: 'Integracje', description: 'Klucze API i webhooki dla systemów zewnętrznych.', group: 'Organizacja' },
]

const definition = (key: string) => MODULES.find((m) => m.key === key)

const dependencies = (key: string): string[] => definition(key)?.depends ?? []

const dependents = (key: string): string[] => MODULES.filter((m) => (m.depends ?? []).includes(key)).map((m) => m.key)

const moduleName = (key: string): string => definition(key)?.name ?? key

export function moduleEnabled(key: string): boolean {
  const def = definition(key)
  if (!def) return false
  if (def.required) return true
  const enabled = db().modules[key] ?? true
  return enabled && dependencies(key).every(moduleEnabled)
}

export function listModules() {
  return MODULES.map((m) => ({
    key: m.key,
    name: m.name,
    description: m.description ?? null,
    group: m.group ?? 'Podstawowe',
    required: Boolean(m.required),
    depends: dependencies(m.key),
    enabled: moduleEnabled(m.key),
  }))
}

export function setModule(key: string, enabled: boolean): void {
  const def = definition(key)
  if (!def) invalid('module', `Nieznany moduł ${key}.`)
  if (def.required) invalid('module', 'Tego modułu nie można wyłączyć.')
  if (enabled) {
    const missing = dependencies(key).filter((d) => !moduleEnabled(d))
    if (missing.length) invalid('module', `Najpierw włącz: ${missing.map(moduleName).join(', ')}.`)
  } else {
    const active = dependents(key).filter(moduleEnabled)
    if (active.length) invalid('module', `Najpierw wyłącz: ${active.map(moduleName).join(', ')}.`)
  }
  db().modules[key] = enabled
}
