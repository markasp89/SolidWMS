<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

/**
 * Registers the service provider of every module listed in config/modules.php.
 * Optional modules are always registered; whether they are active is decided
 * at runtime by Modules\Core\Services\ModuleManager.
 */
class ModulesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        foreach (config('modules.modules', []) as $module) {
            if (! empty($module['provider'])) {
                $this->app->register($module['provider']);
            }
        }
    }
}
