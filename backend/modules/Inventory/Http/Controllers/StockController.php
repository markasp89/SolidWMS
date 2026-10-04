<?php

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Inventory\Http\Requests\StockOperationRequest;
use Modules\Inventory\Http\Resources\StockItemResource;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;

class StockController extends Controller
{
    public function __construct(
        private readonly StockService $stock,
        private readonly WarehouseScope $scope,
    ) {}

    /**
     * Stock locations filtered by sector, warehouse, product and/or pallet.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'sector_id' => ['nullable', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer'],
            'pallet_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $items = StockItem::query()
            ->with(StockItem::$apiRelations)
            ->inWarehouses($this->scope->allowedWarehouseIds($request->user()))
            ->when($request->filled('sector_id'), fn ($q) => $q->where('sector_id', $request->integer('sector_id')))
            ->when($request->filled('product_id'), fn ($q) => $q->where('product_id', $request->integer('product_id')))
            ->when($request->filled('pallet_id'), fn ($q) => $q->where('pallet_id', $request->integer('pallet_id')))
            ->when($request->filled('warehouse_id'), fn ($q) => $q->whereHas(
                'sector',
                fn ($s) => $s->where('warehouse_id', $request->integer('warehouse_id'))
            ))
            ->when($request->filled('q'), fn ($q) => $q->whereHas(
                'product',
                fn ($p) => $p->search($request->string('q')->toString())
            ))
            ->join('products', 'products.id', '=', 'stock_items.product_id')
            ->orderBy('products.name')
            ->orderBy('stock_items.slot')
            ->select('stock_items.*')
            ->limit(1000)
            ->get();

        return StockItemResource::collection($items);
    }

    /**
     * Per-sector totals used to colour the warehouse map.
     */
    public function warehouseSummary(Request $request, Warehouse $warehouse): JsonResponse
    {
        $this->scope->ensure($request->user(), $warehouse->id);

        $rows = StockItem::query()
            ->join('sectors', 'sectors.id', '=', 'stock_items.sector_id')
            ->where('sectors.warehouse_id', $warehouse->id)
            ->groupBy('stock_items.sector_id')
            ->selectRaw('stock_items.sector_id, COUNT(DISTINCT stock_items.product_id) as products_count, SUM(stock_items.quantity) as total_quantity')
            ->get()
            ->map(fn ($row) => [
                'sector_id' => (int) $row->sector_id,
                'products_count' => (int) $row->products_count,
                'total_quantity' => (float) $row->total_quantity,
            ]);

        return response()->json($rows);
    }

    public function receive(StockOperationRequest $request): StockItemResource
    {
        $item = $this->stock->receive(
            Product::findOrFail($request->integer('product_id')),
            Sector::findOrFail($request->integer('sector_id')),
            (float) $request->input('quantity'),
            $request->user(),
            $request->input('note'),
            $request->only(['slot', 'batch', 'expires_at']),
        );

        return $this->resource($item);
    }

    public function issue(StockOperationRequest $request, StockItem $item): JsonResponse|StockItemResource
    {
        $remaining = $this->stock->issue($item, (float) $request->input('quantity'), $request->user(), $request->input('note'));

        return $remaining ? $this->resource($remaining) : response()->json(['deleted' => true]);
    }

    public function move(StockOperationRequest $request, StockItem $item): StockItemResource
    {
        $target = $this->stock->move(
            $item,
            Sector::findOrFail($request->integer('to_sector_id')),
            (float) $request->input('quantity'),
            $request->user(),
            $request->input('note'),
            ['slot' => $request->input('to_slot')],
        );

        return $this->resource($target);
    }

    public function update(StockOperationRequest $request, StockItem $item): JsonResponse|StockItemResource
    {
        $result = $this->stock->adjust(
            $item,
            $request->has('quantity') ? (float) $request->input('quantity') : null,
            $request->user(),
            $request->input('note'),
            $request->exists('note'),
        );

        return $result ? $this->resource($result) : response()->json(['deleted' => true]);
    }

    private function resource(StockItem $item): StockItemResource
    {
        return new StockItemResource($item->fresh(StockItem::$apiRelations));
    }
}
