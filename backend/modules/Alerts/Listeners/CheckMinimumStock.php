<?php

namespace Modules\Alerts\Listeners;

use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Alerts\Notifications\LowStockNotification;
use Modules\Core\Enums\Role;
use Modules\Core\Events\DomainEvent;
use Modules\Core\Services\ModuleManager;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;

/**
 * Notifies administrators and managers when a product drops below its minimum.
 * Only the moment of crossing the threshold triggers a notification.
 */
class CheckMinimumStock
{
    public function __construct(private readonly ModuleManager $modules) {}

    public function handle(DomainEvent $event): void
    {
        if ($event->name !== 'stock.movement' || ($event->payload['total_delta'] ?? 0) == 0 || ! $this->modules->enabled('alerts')) {
            return;
        }

        $product = Product::find($event->payload['product_id']);
        $minimum = $product?->min_quantity;

        if ($minimum === null) {
            return;
        }

        $total = (float) StockItem::where('product_id', $product->id)->sum('quantity');
        $before = $total - (float) $event->payload['total_delta'];

        if ($total < (float) $minimum && $before >= (float) $minimum) {
            $recipients = User::query()
                ->whereIn('role', [Role::Admin->value, Role::Manager->value])
                ->where('is_active', true)
                ->get();

            Notification::send($recipients, new LowStockNotification($product, $total, (float) $minimum));
        }
    }
}
