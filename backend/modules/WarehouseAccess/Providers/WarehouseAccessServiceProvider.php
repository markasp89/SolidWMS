<?php

namespace Modules\WarehouseAccess\Providers;

use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Support\ModuleServiceProvider;
use Modules\WarehouseAccess\Services\AssignedWarehouseScope;

class WarehouseAccessServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'warehouse_access';

    public function register(): void
    {
        // Checks the module state itself, so it is safe to bind even when switched off.
        $this->app->singleton(WarehouseScope::class, AssignedWarehouseScope::class);
    }
}
