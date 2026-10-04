<?php

namespace Modules\Alerts\Providers;

use Illuminate\Support\Facades\Event;
use Modules\Alerts\Listeners\CheckMinimumStock;
use Modules\Core\Events\DomainEvent;
use Modules\Core\Support\ModuleServiceProvider;

class AlertsServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'alerts';

    public function register(): void
    {
        $this->app['config']->set('alerts', [
            // Also send low stock alerts by e-mail (requires MAIL_* configuration).
            'mail' => (bool) env('ALERTS_MAIL', false),
            'frontend_url' => env('FRONTEND_URL', env('APP_URL')),
        ]);
    }

    protected function bootModule(): void
    {
        Event::listen(DomainEvent::class, CheckMinimumStock::class);
    }
}
