<?php

namespace Modules\Core\Providers;

use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Http\Middleware\EnsureModuleEnabled;
use Modules\Core\Http\Middleware\EnsureUserHasRole;
use Modules\Core\Http\Middleware\Idempotency;
use Modules\Core\Services\ModuleManager;
use Modules\Core\Services\UnrestrictedWarehouseScope;
use Modules\Core\Support\ModuleServiceProvider;

class CoreServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'core';

    public function register(): void
    {
        $this->app->singleton(ModuleManager::class);
        $this->app->singletonIf(WarehouseScope::class, UnrestrictedWarehouseScope::class);
    }

    protected function bootModule(): void
    {
        $router = $this->app['router'];
        $router->aliasMiddleware('role', EnsureUserHasRole::class);
        $router->aliasMiddleware('module', EnsureModuleEnabled::class);
        $router->pushMiddlewareToGroup('api', Idempotency::class);

        JsonResource::withoutWrapping();
    }
}
