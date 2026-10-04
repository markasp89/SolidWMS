<?php

/*
|--------------------------------------------------------------------------
| SolidWMS modules
|--------------------------------------------------------------------------
|
| Every feature lives in its own module. A module is described by:
|  - provider:    service provider in /modules (null for frontend-only modules)
|  - required:   core modules that cannot be switched off
|  - default:    initial state of optional modules
|  - depends:    modules that must be enabled for this one to work
|
| Optional modules are switched on/off at runtime by the administrator
| (Settings -> Modules). The state is stored in the "module_states" table.
| Remove an entry here to remove a module from the installation entirely.
|
*/

use Modules\Alerts\Providers\AlertsServiceProvider;
use Modules\Auth\Providers\AuthServiceProvider;
use Modules\Batches\Providers\BatchesServiceProvider;
use Modules\Core\Providers\CoreServiceProvider;
use Modules\Documents\Providers\DocumentsServiceProvider;
use Modules\Floors\Providers\FloorsServiceProvider;
use Modules\Integrations\Providers\IntegrationsServiceProvider;
use Modules\Inventory\Providers\InventoryServiceProvider;
use Modules\Pallets\Providers\PalletsServiceProvider;
use Modules\Photos\Providers\PhotosServiceProvider;
use Modules\Picking\Providers\PickingServiceProvider;
use Modules\Reports\Providers\ReportsServiceProvider;
use Modules\Settings\Providers\SettingsServiceProvider;
use Modules\Stocktaking\Providers\StocktakingServiceProvider;
use Modules\Suggestions\Providers\SuggestionsServiceProvider;
use Modules\Users\Providers\UsersServiceProvider;
use Modules\WarehouseAccess\Providers\WarehouseAccessServiceProvider;
use Modules\Warehouses\Providers\WarehousesServiceProvider;

return [
    'modules' => [
        // Core ----------------------------------------------------------------
        'core' => [
            'name' => 'Rdzeń',
            'description' => 'Rejestr modułów, role, wspólne mechanizmy.',
            'provider' => CoreServiceProvider::class,
            'required' => true,
        ],
        'auth' => [
            'name' => 'Logowanie',
            'description' => 'Logowanie i sesje (tokeny API).',
            'provider' => AuthServiceProvider::class,
            'required' => true,
        ],
        'users' => [
            'name' => 'Użytkownicy',
            'description' => 'Konta użytkowników i role.',
            'provider' => UsersServiceProvider::class,
            'required' => true,
        ],
        'warehouses' => [
            'name' => 'Magazyny',
            'description' => 'Magazyny, rzuty z góry i sektory.',
            'provider' => WarehousesServiceProvider::class,
            'required' => true,
        ],
        'inventory' => [
            'name' => 'Produkty i stany',
            'description' => 'Produkty, lokalizacje, wyszukiwarka „Gdzie jest?” i historia operacji.',
            'provider' => InventoryServiceProvider::class,
            'required' => true,
        ],
        'settings' => [
            'name' => 'Ustawienia',
            'description' => 'Moduły, eksport i import danych.',
            'provider' => SettingsServiceProvider::class,
            'required' => true,
        ],

        // Optional --------------------------------------------------------------
        'scanning' => [
            'name' => 'Skanowanie kodów',
            'description' => 'Skanowanie kodów kreskowych i QR aparatem telefonu.',
            'group' => 'Hala',
        ],
        'labels' => [
            'name' => 'Etykiety QR',
            'description' => 'Drukowanie etykiet QR dla sektorów, palet i produktów.',
            'group' => 'Hala',
        ],
        'pallets' => [
            'name' => 'Palety',
            'description' => 'Palety z numerem i zawartością, przenoszone jednym ruchem.',
            'provider' => PalletsServiceProvider::class,
            'group' => 'Hala',
        ],
        'offline' => [
            'name' => 'Aplikacja i tryb offline',
            'description' => 'Instalacja na telefonie (PWA) i kolejka operacji przy braku sieci.',
            'group' => 'Hala',
        ],
        'slots' => [
            'name' => 'Miejsca w sektorze',
            'description' => 'Półka, poziom i gniazdo w sektorze (np. A1-03-2).',
            'group' => 'Lokalizacja',
        ],
        'floors' => [
            'name' => 'Piętra i hale',
            'description' => 'Kilka rzutów w jednym magazynie z przełącznikiem pięter.',
            'provider' => FloorsServiceProvider::class,
            'group' => 'Lokalizacja',
        ],
        'suggestions' => [
            'name' => 'Podpowiedzi lokalizacji',
            'description' => 'Przy przyjęciu podpowiada sektor, w którym produkt już leży.',
            'provider' => SuggestionsServiceProvider::class,
            'group' => 'Lokalizacja',
        ],
        'stocktaking' => [
            'name' => 'Inwentaryzacja',
            'description' => 'Przeliczanie sektora na telefonie i zbiorcza korekta.',
            'provider' => StocktakingServiceProvider::class,
            'group' => 'Kontrola',
        ],
        'batches' => [
            'name' => 'Partie i daty ważności',
            'description' => 'Numery partii, daty przydatności, FEFO i ostrzeżenia.',
            'provider' => BatchesServiceProvider::class,
            'group' => 'Kontrola',
        ],
        'alerts' => [
            'name' => 'Stany minimalne i alerty',
            'description' => 'Powiadomienia w aplikacji i e-mailem przy niskim stanie.',
            'provider' => AlertsServiceProvider::class,
            'group' => 'Kontrola',
        ],
        'photos' => [
            'name' => 'Zdjęcia',
            'description' => 'Zdjęcia produktów i miejsc odłożenia towaru.',
            'provider' => PhotosServiceProvider::class,
            'group' => 'Kontrola',
        ],
        'documents' => [
            'name' => 'Dokumenty PZ/WZ',
            'description' => 'Przyjęcia i wydania wielu pozycji z wydrukiem PDF.',
            'provider' => DocumentsServiceProvider::class,
            'group' => 'Procesy',
        ],
        'picking' => [
            'name' => 'Kompletacja zamówień',
            'description' => 'Listy zbierania posortowane po sektorach.',
            'provider' => PickingServiceProvider::class,
            'group' => 'Procesy',
        ],
        'reports' => [
            'name' => 'Raporty',
            'description' => 'Zajętość sektorów, rotacja towaru, aktywność pracowników, eksport CSV.',
            'provider' => ReportsServiceProvider::class,
            'group' => 'Procesy',
        ],
        'warehouse_access' => [
            'name' => 'Dostęp do magazynów',
            'description' => 'Ograniczenie pracowników do wybranych magazynów.',
            'provider' => WarehouseAccessServiceProvider::class,
            'group' => 'Organizacja',
        ],
        'integrations' => [
            'name' => 'Integracje',
            'description' => 'Klucze API i webhooki dla systemów zewnętrznych.',
            'provider' => IntegrationsServiceProvider::class,
            'group' => 'Organizacja',
        ],
    ],
];
