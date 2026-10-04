<?php

namespace Modules\Integrations\Listeners;

use Modules\Core\Events\DomainEvent;
use Modules\Core\Services\ModuleManager;
use Modules\Integrations\Models\Webhook;
use Modules\Integrations\Services\WebhookSender;

use function Illuminate\Support\defer;

/**
 * Forwards domain events to subscribed webhooks after the response was sent,
 * so slow receivers never slow down work in the warehouse.
 */
class DispatchWebhooks
{
    public function __construct(
        private readonly ModuleManager $modules,
        private readonly WebhookSender $sender,
    ) {}

    public function handle(DomainEvent $event): void
    {
        if (! $this->modules->enabled('integrations')) {
            return;
        }

        $webhooks = Webhook::where('active', true)->get()->filter->listensTo($event->name);

        foreach ($webhooks as $webhook) {
            defer(fn () => $this->sender->send($webhook, $event->name, $event->payload));
        }
    }
}
