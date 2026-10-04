# SolidWMS

Prosty system do zarządzania miejscami składowania w magazynach. Odpowiada na pytanie
**„gdzie leży ten towar?”**: pracownik wpisuje nazwę, SKU albo kod kreskowy i od razu widzi,
w którym magazynie i sektorze go szukać. Sektor jest podświetlony na rzucie magazynu.

- **Backend:** Laravel 13 (REST API, Sanctum tokens), w katalogu `backend/`
- **Frontend:** React 19 + TypeScript + Vite, w katalogu `frontend/`
- Obie części są podzielone na **moduły**.

## Funkcje

| Rola | Co może |
| --- | --- |
| **Administrator** | Wszystko: magazyny, rzuty i sektory (rysowanie prostokątów i wielokątów), piętra, użytkownicy, dostęp do magazynów, moduły, eksport/import, integracje. |
| **Kierownik zmiany** | Wszystko, co pracownik, a do tego zatwierdzanie inwentaryzacji, raporty, stany minimalne i usuwanie produktów. Dostaje powiadomienia o niskim stanie. |
| **Pracownik** | Produkty, przyjęcia, wydania, przesunięcia, korekty, palety, dokumenty PZ/WZ, kompletacja, liczenie inwentaryzacji, zdjęcia. |

Podstawa (zawsze włączona):

- **„Gdzie jest?”**: wyszukiwarka po nazwie, SKU lub kodzie kreskowym, z mapą i podświetlonymi sektorami.
- **Mapa magazynu**: rzut z góry, sektory z liczbą produktów, towar w wybranym sektorze.
- **Historia operacji**: kto, kiedy i skąd/dokąd przeniósł towar.
- **Ustawienia**: włączanie i wyłączanie modułów, eksport i import JSON.

## Moduły opcjonalne

Administrator włącza je i wyłącza w **Ustawienia → Moduły**, bez restartu i bez utraty danych.
Wyłączony moduł znika z menu i ekranów, a jego endpointy API zwracają 404.

| Grupa | Moduł (`klucz`) | Co daje |
| --- | --- | --- |
| Hala | Skanowanie kodów (`scanning`) | Przycisk skanera w górnym pasku i przy wyborze sektora/produktu. Działa aparatem telefonu (`@zxing/browser`) lub czytnikiem USB/Bluetooth. |
| Hala | Etykiety QR (`labels`) | Druk etykiet dla sektorów, palet i produktów (`SWMS:S:<id>`, `SWMS:P:<kod>`, `SWMS:I:<sku>`). |
| Hala | Palety (`pallets`) | Paleta z numerem (P-00001) i zawartością. Przeniesienie całej palety jednym ruchem, historia „kto przestawił paletę”. |
| Hala | Aplikacja i offline (`offline`) | PWA do zainstalowania na telefonie. Ostatnio widziane dane są dostępne bez sieci, operacje trafiają do kolejki i wysyłają się po powrocie zasięgu (z kluczem idempotencji). |
| Lokalizacja | Miejsca w sektorze (`slots`) | Półka/poziom/gniazdo, np. `A1-03-2`. |
| Lokalizacja | Piętra i hale (`floors`) | Kilka rzutów w jednym magazynie, przełącznik pięter. |
| Lokalizacja | Podpowiedzi (`suggestions`) | Przy przyjęciu podpowiada, gdzie produkt już leży albo gdzie odkładano go najczęściej. |
| Kontrola | Inwentaryzacja (`stocktaking`) | Liczenie sektora na telefonie, porównanie z systemem, jedna zbiorcza korekta (kierownik). |
| Kontrola | Partie i daty (`batches`) | Partia i data ważności, kolejność FEFO, lista kończących się terminów. |
| Kontrola | Stany minimalne (`alerts`) | Powiadomienia w aplikacji i opcjonalnie e-mailem (`ALERTS_MAIL=true`). |
| Kontrola | Zdjęcia (`photos`) | Zdjęcia produktu, palety i miejsca odłożenia towaru. Zdjęcia z telefonu są zmniejszane do 1600 px. |
| Procesy | Dokumenty PZ/WZ (`documents`) | Wiele pozycji na jednym dokumencie. WZ pobiera towar automatycznie wg FEFO. PDF do druku. |
| Procesy | Kompletacja (`picking`) | Lista zbierania posortowana po sektorach, zbieranie na telefonie. |
| Procesy | Raporty (`reports`) | Zajętość sektorów, rotacja towaru, aktywność pracowników, eksport CSV (Excel). |
| Organizacja | Dostęp do magazynów (`warehouse_access`) | Ograniczenie użytkownika do wybranych magazynów. |
| Organizacja | Integracje (`integrations`) | Klucze API (`/api/integration/v1`) i podpisane webhooki (HMAC-SHA256), np. do synchronizacji z Subiektem GT lub sklepem. |

## Uruchomienie (dev)

Wymagania: PHP 8.3+ (pdo_sqlite), Composer, Node 20+.

```bash
# API
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed      # konta demo + przykładowy magazyn z rzutem
php artisan serve               # http://127.0.0.1:8000

# Frontend (w drugim terminalu)
cd frontend
npm install
npm run dev                     # http://localhost:5173  (proxy /api -> :8000)
```

Konta demo (hasło `password`):

- `admin@solidwms.local`: administrator
- `pracownik@solidwms.local`: pracownik

Dane demo zawierają magazyn z rzutem i sektorami, produkty z miejscami, partiami i stanami
minimalnymi oraz paletę P-00001.

W produkcji zbuduj frontend (`npm run build`) i serwuj `frontend/dist` (np. przez nginx)
z przekierowaniem `/api` do Laravela. Jeśli API stoi pod inną domeną, ustaw `VITE_API_URL`.
Zamiast SQLite można użyć MySQL lub PostgreSQL (zmienne `DB_*` w `backend/.env`).

> Skanowanie aparatem i instalacja aplikacji na telefonie wymagają HTTPS (poza `localhost`).
> Import dużego pliku z obrazami rzutów wymaga odpowiednio wysokich `post_max_size` /
> `upload_max_filesize` w PHP.

Testy i kontrola jakości:

```bash
cd backend && php artisan test && vendor/bin/pint --test
cd frontend && npm run build && npm run lint
```

## Wersja demo (bez serwera)

`npm run build:demo` w katalogu `frontend/` buduje jeden plik `dist-demo/solidwms-demo.html` z całą aplikacją.
API odpowiada wtedy w przeglądarce (`frontend/src/demo/`), dane przykładowe zapisują się tylko na danym
urządzeniu, a routing działa przez `#/…`. Plik nadaje się do pokazania aplikacji na telefonie bez instalowania
Laravela. Aparat, druk etykiet i PDF działają tylko w pełnej wersji.

## Architektura modułowa

### Backend: `backend/modules/<Moduł>`

Lista modułów, ich zależności i domyślny stan są w `backend/config/modules.php`. Stan włączenia
zapisuje `Modules\Core\Services\ModuleManager` w tabeli `module_states`.

Każdy moduł ma service provider dziedziczący po `Modules\Core\Support\ModuleServiceProvider`, który:

- ładuje `routes/api.php` (prefiks `/api`). Trasy modułów opcjonalnych dostają middleware
  `module:<klucz>`, więc po wyłączeniu modułu zwracają 404.
- ładuje `Database/Migrations`. Tabele istnieją zawsze, dzięki czemu moduł można włączyć w każdej chwili.

Moduły nie wołają się nawzajem bezpośrednio:

- **Zdarzenia**: `Modules\Core\Events\DomainEvent` (`stock.movement`, `product.saved`,
  `pallet.moved`, `document.posted`, …). Słuchają ich np. alerty i webhooki.
- **Kontrakty**: `Modules\Core\Contracts\WarehouseScope` decyduje, które magazyny widzi użytkownik.
  Moduł `warehouse_access` podmienia domyślną implementację.
- **Jedno miejsce zmian stanów**: wszystkie zmiany idą przez `Inventory\Services\StockService`
  (dostęp, historia, zdarzenia). Lokalizacja to produkt + sektor + opcjonalnie miejsce, partia,
  data ważności i paleta.
- **Idempotencja**: żądania z nagłówkiem `Idempotency-Key` wykonują się tylko raz. Korzysta z tego
  kolejka offline.

### Frontend: `frontend/src/modules/<moduł>`

Każdy moduł eksportuje `AppModule` (`key` zgodny z backendem, trasy, menu, role, rozszerzenia,
`activate`/`deactivate`). Lista jest w `src/app/modules.ts`, a stan włączenia przychodzi z `GET /api/modules`.
Moduły dokładają UI do innych modułów przez **punkty rozszerzeń** (`<Extension name="…">`):

| Punkt | Kto korzysta |
| --- | --- |
| `topbar.actions` | skaner, kolejka offline, powiadomienia |
| `dashboard.widgets` | niski stan, kończące się terminy |
| `warehouse.sectorPanel`, `warehouse.mapOverlay`, `sector.actions` | towar i palety w sektorze, liczniki na mapie, etykieta QR, inwentaryzacja |
| `product.sidebar`, `pallet.sidebar`, `location.actions` | stan minimalny, zdjęcia |
| `user.actions` | dostęp do magazynów |

### Formularze w oknach modalnych

`useForm` + `<Form>` + `<FormModal>` (`src/core/ui/form.tsx`):

- `<Form showSubmit={false}>` ukrywa własny przycisk formularza, gdy ten jest osadzony w kontenerze
  z własnymi przyciskami (np. w modalu).
- Przycisk „Zapisz” w stopce modala jest prawdziwym `type="submit"` powiązanym z formularzem
  atrybutem `form="<id>"`. Kliknięcie go albo Enter w polu uruchamia **ten sam** proces:
  walidację po stronie klienta, a potem wysyłkę. Błędy 422 z API są mapowane na pola.

## API (skrót)

Wszystkie endpointy poza logowaniem wymagają nagłówka `Authorization: Bearer <token>`.

| Metoda i ścieżka | Opis | Rola |
| --- | --- | --- |
| `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | sesja | – |
| `GET /api/warehouses`, `GET /api/warehouses/{id}` | magazyny z sektorami | wszyscy |
| `POST/PATCH/DELETE /api/warehouses[/{id}]` | zarządzanie magazynami | admin |
| `POST/DELETE /api/warehouses/{id}/floor-plan` | rzut magazynu | admin |
| `POST /api/warehouses/{id}/sectors`, `PATCH/DELETE /api/sectors/{id}` | sektory (`shape`: `[[x,y],…]`, wartości 0..1) | admin |
| `GET /api/search?q=` | produkty z lokalizacjami | wszyscy |
| `GET/POST/PATCH /api/products[/{id}]` | produkty (`initial_stock` przy tworzeniu) | wszyscy |
| `DELETE /api/products/{id}` | usunięcie produktu | admin |
| `GET /api/stock?sector_id=&warehouse_id=&product_id=` | lokalizacje | wszyscy |
| `POST /api/stock/receive` | przyjęcie do sektora | wszyscy |
| `POST /api/stock/{id}/issue`, `POST /api/stock/{id}/move`, `PATCH /api/stock/{id}` | wydanie, przesunięcie, korekta/uwagi | wszyscy |
| `GET /api/movements` | historia | wszyscy |
| `GET /api/settings/export?include_images=1`, `POST /api/settings/import` | eksport i import JSON | admin |

Moduły opcjonalne mają własne endpointy: `pallets`, `floors`, `stocktakes`, `documents`, `picking`,
`reports/*`, `batches/expiring`, `alerts/low-stock`, `notifications`, `photos`, `products/{id}/suggested-locations`,
`users/{id}/warehouses`, `integrations/*`, `modules`. Pełną listę wypisze `php artisan route:list --path=api`.

### Format pliku eksportu

```json
{
  "format": "solidwms",
  "version": 2,
  "exported_at": "2026-10-02T12:00:00+00:00",
  "warehouses": [
    {
      "code": "MAG1", "name": "Magazyn główny", "address": null, "description": null,
      "floor_plan": { "width": 1600, "height": 1000, "mime": "image/png", "data": "<base64>" },
      "sectors": [
        { "code": "A1", "name": "Regał A", "color": "#2563eb", "description": null,
          "shape": [[0.05, 0.09], [0.33, 0.09], [0.33, 0.16], [0.05, 0.16]] }
      ]
    }
  ],
  "products": [{ "sku": "KART-40", "name": "Karton", "barcode": null, "unit": "szt", "description": null }],
  "stock": [{ "sku": "KART-40", "warehouse_code": "MAG1", "sector_code": "A1", "quantity": 350, "note": null }]
}
```

Wersja 2 dodaje `floors` (w magazynie), `floor` (w sektorze), `pallets`, `min_quantity` oraz w `stock` pola
`slot`, `batch`, `expires_at` i `pallet`. Pliki w wersji 1 nadal się importują.

Rekordy są dopasowywane po kluczach biznesowych (kod magazynu, nazwa piętra, kod sektora w magazynie, SKU, numer palety), a nie
po ID. Dzięki temu plik można przenosić między instalacjami. Import działa w jednej transakcji:
jeśli plik jest błędny, nic się nie zmienia.
