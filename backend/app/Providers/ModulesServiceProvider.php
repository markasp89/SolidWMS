<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

/**
 * Registers every module listed in config/modules.php.
 */
class ModulesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        foreach (config('modules.enabled', []) as $provider) {
            $this->app->register($provider);
        }
    }
}
