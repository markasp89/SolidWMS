<?php

namespace Modules\Integrations\Providers;

use Illuminate\Support\Facades\Event;
use Modules\Core\Events\DomainEvent;
use Modules\Core\Support\ModuleServiceProvider;
use Modules\Integrations\Listeners\DispatchWebhooks;

class IntegrationsServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'integrations';

    protected function bootModule(): void
    {
        Event::listen(DomainEvent::class, DispatchWebhooks::class);
    }
}
