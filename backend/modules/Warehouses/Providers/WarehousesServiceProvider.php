<?php

namespace Modules\Warehouses\Providers;

use Modules\Core\Support\ModuleServiceProvider;
use Modules\Warehouses\Services\FloorPlanStorage;

class WarehousesServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'warehouses';

    public function register(): void
    {
        $this->app->singleton(FloorPlanStorage::class);
    }
}
