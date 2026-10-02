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
| **Administrator** | Tworzy magazyny, wgrywa rzut z góry (PNG/JPG/WEBP/GIF), rysuje na nim sektory (prostokąt lub wielokąt, przesuwanie, edycja wierzchołków), zarządza użytkownikami, eksportuje i importuje dane (JSON). Ma też wszystkie uprawnienia pracownika. |
| **Pracownik** | Dodaje i edytuje produkty, przyjmuje towar do sektora, wydaje go, przenosi między sektorami, koryguje ilości i dopisuje uwagi (np. „paleta przy bramie 2”). |

- **„Gdzie jest?”**: wyszukiwarka po nazwie, SKU lub kodzie kreskowym. Pokazuje lokalizacje i mapę
  z podświetlonymi sektorami.
- **Mapa magazynu**: kliknięcie sektora pokazuje towar w nim. Na mapie widać liczbę produktów
  w każdym sektorze.
- **Historia operacji**: kto, kiedy i skąd/dokąd przeniósł towar (przyjęcie, wydanie, przesunięcie,
  korekta).
- **Ustawienia → Eksport/Import**: eksport zapisuje plik JSON na dysk (opcjonalnie z obrazami
  rzutów). Import otwiera okno, w którym można przesłać plik lub wkleić JSON. Są dwa tryby:
  *scal* (upsert po kodach) i *zastąp*.
- Interfejs działa na telefonie i tablecie.

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

W produkcji zbuduj frontend (`npm run build`) i serwuj `frontend/dist` (np. przez nginx)
z przekierowaniem `/api` do Laravela. Jeśli API stoi pod inną domeną, ustaw `VITE_API_URL`.
Zamiast SQLite można użyć MySQL lub PostgreSQL (zmienne `DB_*` w `backend/.env`).

> Import dużego pliku z obrazami rzutów wymaga odpowiednio wysokich `post_max_size` /
> `upload_max_filesize` w PHP.

Testy i kontrola jakości:

```bash
cd backend && php artisan test && vendor/bin/pint --test
cd frontend && npm run build && npm run lint
```

## Architektura modułowa

### Backend: `backend/modules/<Moduł>`

Moduły włącza się w `backend/config/modules.php` (lista service providerów).
Każdy moduł dziedziczy po `Modules\Core\Support\ModuleServiceProvider`, który automatycznie ładuje:

- `routes/api.php` (prefiks `/api`),
- `Database/Migrations`.

| Moduł | Zawartość |
| --- | --- |
| `Core` | bazowy provider modułów, enum `Role`, middleware `role:admin` |
| `Auth` | logowanie i wylogowanie, tokeny Sanctum, blokada kont nieaktywnych |
| `Users` | CRUD użytkowników (admin) |
| `Warehouses` | magazyny, rzuty (prywatny dysk + podpisany URL), sektory jako wielokąty |
| `Inventory` | produkty, lokalizacje (`stock_items`), historia (`stock_movements`), wyszukiwarka, pulpit |
| `Settings` | eksport i import danych JSON |

Zależności idą w jedną stronę: `Inventory → Warehouses`, `Settings → Inventory, Warehouses`.
`Warehouses` nie zna `Inventory`. Blokadę usuwania sektora z towarem `Inventory` rejestruje przez
event modelu `Sector::deleting`.

### Frontend: `frontend/src/modules/<moduł>`

Każdy moduł eksportuje obiekt `AppModule` (trasy, pozycje menu, role, rozszerzenia). Lista włączonych
modułów jest w `src/app/modules.ts`. Moduły nie importują nawzajem swoich stron. Dokładają UI do
innych modułów przez **punkty rozszerzeń**:

- `warehouse.sectorPanel`: panel wybranego sektora (Inventory pokazuje tu towar),
- `warehouse.mapOverlay`: dodatkowa warstwa SVG na mapie (Inventory rysuje liczniki produktów).

`src/core` zawiera wspólne elementy: klient API, autoryzację, layout, formularze, modale i powiadomienia.

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

### Format pliku eksportu

```json
{
  "format": "solidwms",
  "version": 1,
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

Rekordy są dopasowywane po kluczach biznesowych (kod magazynu, kod sektora w magazynie, SKU), a nie
po ID. Dzięki temu plik można przenosić między instalacjami. Import działa w jednej transakcji:
jeśli plik jest błędny, nic się nie zmienia.
