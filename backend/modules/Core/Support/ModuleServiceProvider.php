<?php

namespace Modules\Core\Support;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Modules\Core\Services\ModuleManager;
use ReflectionClass;

/**
 * Base class for module service providers.
 *
 * Conventions (all optional) inside a module directory:
 *  - routes/api.php          loaded under the "api" prefix; for optional modules
 *                            wrapped in the "module:<key>" middleware so the
 *                            routes answer 404 while the module is switched off
 *  - Database/Migrations     loaded as regular migrations (schema exists even
 *                            when the module is off, so it can be switched on
 *                            at any time without data loss)
 */
abstract class ModuleServiceProvider extends ServiceProvider
{
    /** Module key as defined in config/modules.php. */
    protected string $module;

    public function boot(): void
    {
        $routes = $this->modulePath('routes/api.php');

        if (is_file($routes) && ! $this->app->routesAreCached()) {
            $middleware = ['api'];
            if (! app(ModuleManager::class)->isRequired($this->module)) {
                $middleware[] = 'module:'.$this->module;
            }
            Route::prefix('api')->middleware($middleware)->group($routes);
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

    /** Whether this module is currently switched on. */
    protected function moduleEnabled(): bool
    {
        return app(ModuleManager::class)->enabled($this->module);
    }

    protected function modulePath(string $path = ''): string
    {
        $root = dirname((new ReflectionClass(static::class))->getFileName(), 2);

        return $path === '' ? $root : $root.DIRECTORY_SEPARATOR.$path;
    }
}
