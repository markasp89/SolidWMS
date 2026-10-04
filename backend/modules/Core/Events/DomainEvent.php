<?php

namespace Modules\Core\Events;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * Generic business event shared between modules, e.g. "stock.movement",
 * "product.saved", "pallet.moved", "document.posted". Modules publish events
 * without knowing who listens (alerts, webhooks, ...).
 */
class DomainEvent
{
    use Dispatchable;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public readonly string $name,
        public readonly array $payload = [],
    ) {}
}
