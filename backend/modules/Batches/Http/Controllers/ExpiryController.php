<?php

namespace Modules\Batches\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Inventory\Http\Resources\StockItemResource;
use Modules\Inventory\Models\StockItem;

/**
 * Locations with goods that are expired or expire within N days (FEFO order).
 */
class ExpiryController extends Controller
{
    public function __invoke(Request $request, WarehouseScope $scope): AnonymousResourceCollection
    {
        $days = min(max($request->integer('days', 30), 0), 365);

        $items = StockItem::query()
            ->with(StockItem::$apiRelations)
            ->inWarehouses($scope->allowedWarehouseIds($request->user()))
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<=', now()->addDays($days)->toDateString())
            ->when($request->filled('warehouse_id'), fn ($q) => $q->whereHas('sector', fn ($s) => $s->where('warehouse_id', $request->integer('warehouse_id'))))
            ->orderBy('expires_at')
            ->limit(500)
            ->get();

        return StockItemResource::collection($items);
    }
}
