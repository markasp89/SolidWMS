<?php

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Inventory\Http\Resources\StockMovementResource;
use Modules\Inventory\Models\StockMovement;
use Modules\Warehouses\Models\Sector;

class MovementController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = min(max((int) $request->integer('per_page', 30), 1), 100);

        $sectorFilter = function ($q, array $sectorIds) {
            $q->whereIn('from_sector_id', $sectorIds)->orWhereIn('to_sector_id', $sectorIds);
        };

        $movements = StockMovement::query()
            ->with(['product', 'fromSector.warehouse', 'toSector.warehouse', 'user'])
            ->when($request->filled('product_id'), fn ($q) => $q->where('product_id', $request->integer('product_id')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')->toString()))
            ->when($request->filled('sector_id'), fn ($q) => $q->where(
                fn ($w) => $sectorFilter($w, [$request->integer('sector_id')])
            ))
            ->when($request->filled('warehouse_id'), fn ($q) => $q->where(
                fn ($w) => $sectorFilter($w, Sector::where('warehouse_id', $request->integer('warehouse_id'))->pluck('id')->all())
            ))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return StockMovementResource::collection($movements);
    }
}
