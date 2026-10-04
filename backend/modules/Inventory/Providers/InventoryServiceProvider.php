<?php

namespace Modules\Inventory\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Modules\Core\Events\DomainEvent;
use Modules\Core\Support\ModuleServiceProvider;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Warehouses\Models\Sector;

class InventoryServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'inventory';

    public function register(): void
    {
        $this->app->singleton(StockService::class);
    }

    protected function bootModule(): void
    {
        Route::model('item', StockItem::class);

        // Product changes are published for other modules (webhooks, ...).
        Product::saved(fn (Product $p) => event(new DomainEvent('product.saved', $p->only(['id', 'sku', 'name', 'barcode', 'unit']))));

        // A sector that still holds goods cannot disappear from the map.
        Sector::deleting(function (Sector $sector) {
            $count = StockItem::where('sector_id', $sector->id)->count();

            if ($count > 0) {
                throw ValidationException::withMessages([
                    'sector' => "Sektor {$sector->code} zawiera {$count} pozycji. Przenieś lub wydaj towar przed usunięciem.",
                ]);
            }
        });
    }
}
