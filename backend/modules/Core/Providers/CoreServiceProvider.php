<?php

namespace Modules\Core\Providers;

use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\Http\Middleware\EnsureUserHasRole;
use Modules\Core\Support\ModuleServiceProvider;

class CoreServiceProvider extends ModuleServiceProvider
{
    protected function bootModule(): void
    {
        $this->app['router']->aliasMiddleware('role', EnsureUserHasRole::class);

        JsonResource::withoutWrapping();
    }
}
