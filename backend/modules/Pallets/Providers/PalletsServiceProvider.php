<?php

namespace Modules\Pallets\Providers;

use Modules\Core\Support\ModuleServiceProvider;
use Modules\Inventory\Models\StockItem;
use Modules\Pallets\Models\Pallet;

class PalletsServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'pallets';

    protected function bootModule(): void
    {
        // Stock locations know which pallet they are on.
        StockItem::resolveRelationUsing('pallet', fn (StockItem $item) => $item->belongsTo(Pallet::class, 'pallet_id'));
        if (! in_array('pallet', StockItem::$apiRelations, true)) {
            StockItem::$apiRelations[] = 'pallet';
        }
    }
}
