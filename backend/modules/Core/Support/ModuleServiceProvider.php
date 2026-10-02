<?php

namespace Modules\Core\Support;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use ReflectionClass;

/**
 * Base class for module service providers.
 *
 * Conventions (all optional) inside a module directory:
 *  - routes/api.php          loaded under the "api" prefix and middleware group
 *  - Database/Migrations     loaded as regular migrations
 */
abstract class ModuleServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $routes = $this->modulePath('routes/api.php');

        if (is_file($routes) && ! $this->app->routesAreCached()) {
            Route::prefix('api')->middleware('api')->group($routes);
        }

        $migrations = $this->modulePath('Database/Migrations');

        if (is_dir($migrations)) {
            $this->loadMigrationsFrom($migrations);
        }

        $this->bootModule();
    }

    /**
     * Hook for module specific boot logic.
     */
    protected function bootModule(): void
    {
        //
    }

    protected function modulePath(string $path = ''): string
    {
        $root = dirname((new ReflectionClass(static::class))->getFileName(), 2);

        return $path === '' ? $root : $root.DIRECTORY_SEPARATOR.$path;
    }
}
