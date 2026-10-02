<?php

use Modules\Auth\Providers\AuthServiceProvider;
use Modules\Core\Providers\CoreServiceProvider;
use Modules\Inventory\Providers\InventoryServiceProvider;
use Modules\Settings\Providers\SettingsServiceProvider;
use Modules\Users\Providers\UsersServiceProvider;
use Modules\Warehouses\Providers\WarehousesServiceProvider;

/*
|--------------------------------------------------------------------------
| SolidWMS modules
|--------------------------------------------------------------------------
|
| Every feature of the application lives in its own module under /modules.
| A module is registered by listing its service provider below. Removing a
| line disables the module (its routes and migrations are no longer loaded).
|
*/

return [
    'enabled' => [
        CoreServiceProvider::class,
        AuthServiceProvider::class,
        UsersServiceProvider::class,
        WarehousesServiceProvider::class,
        InventoryServiceProvider::class,
        SettingsServiceProvider::class,
    ],
];
