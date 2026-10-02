<?php

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Inventory\Http\Resources\StockMovementResource;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Models\StockMovement;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;

class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $recent = StockMovement::query()
            ->with(['product', 'fromSector.warehouse', 'toSector.warehouse', 'user'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get();

        return response()->json([
            'stats' => [
                'warehouses' => Warehouse::count(),
                'sectors' => Sector::count(),
                'products' => Product::count(),
                'locations' => StockItem::count(),
                'products_without_location' => Product::doesntHave('stockItems')->count(),
            ],
            'recent_movements' => StockMovementResource::collection($recent),
        ]);
    }
}
