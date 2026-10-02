<?php

namespace Modules\Inventory\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Modules\Core\Support\ModuleServiceProvider;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Warehouses\Models\Sector;

class InventoryServiceProvider extends ModuleServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(StockService::class);
    }

    protected function bootModule(): void
    {
        Route::model('item', StockItem::class);

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
