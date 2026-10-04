<?php

namespace Modules\Integrations\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\Http\Resources\StockItemResource;
use Modules\Inventory\Http\Resources\StockMovementResource;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Models\StockMovement;

/**
 * Machine-to-machine API (/api/integration/v1) for accounting systems, shops, ...
 */
class IntegrationApiController extends Controller
{
    public function products(Request $request): JsonResponse
    {
        $page = Product::query()
            ->withSum('stockItems', 'quantity')
            ->when($request->filled('updated_since'), fn ($q) => $q->where('updated_at', '>=', $request->date('updated_since')))
            ->when($request->filled('sku'), fn ($q) => $q->where('sku', mb_strtoupper($request->string('sku'))))
            ->orderBy('id')
            ->paginate(min(max($request->integer('per_page', 100), 1), 500));

        return response()->json([
            'data' => collect($page->items())->map(fn (Product $p) => [
                'id' => $p->id,
                'sku' => $p->sku,
                'name' => $p->name,
                'barcode' => $p->barcode,
                'unit' => $p->unit,
                'description' => $p->description,
                'min_quantity' => $p->min_quantity === null ? null : (float) $p->min_quantity,
                'total_quantity' => (float) $p->stock_items_sum_quantity,
                'updated_at' => $p->updated_at?->toIso8601String(),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    /** Creates or updates products by SKU (e.g. synchronisation from an ERP). */
    public function upsertProducts(Request $request): JsonResponse
    {
        $data = $request->validate([
            'products' => ['required', 'array', 'min:1', 'max:1000'],
            'products.*.sku' => ['required', 'string', 'max:64', 'distinct:ignore_case'],
            'products.*.name' => ['required', 'string', 'max:255'],
            'products.*.barcode' => ['nullable', 'string', 'max:64'],
            'products.*.unit' => ['nullable', 'string', 'max:16'],
            'products.*.description' => ['nullable', 'string', 'max:5000'],
            'products.*.min_quantity' => ['nullable', 'numeric', 'gte:0'],
        ]);

        $result = ['created' => 0, 'updated' => 0];

        DB::transaction(function () use ($data, &$result) {
            foreach ($data['products'] as $row) {
                $product = Product::firstOrNew(['sku' => mb_strtoupper(trim($row['sku']))]);
                $result[$product->exists ? 'updated' : 'created']++;
                $product->fill(array_filter([
                    'name' => $row['name'],
                    'barcode' => $row['barcode'] ?? null,
                    'unit' => $row['unit'] ?? ($product->unit ?? 'szt'),
                    'description' => $row['description'] ?? null,
                ], fn ($v) => $v !== null));
                if (array_key_exists('min_quantity', $row)) {
                    $product->forceFill(['min_quantity' => $row['min_quantity']]);
                }
                $product->save();
            }
        });

        return response()->json($result);
    }

    public function stock(Request $request): JsonResponse
    {
        $items = StockItem::query()
            ->with(StockItem::$apiRelations)
            ->when($request->filled('sku'), fn ($q) => $q->whereHas('product', fn ($p) => $p->where('sku', mb_strtoupper($request->string('sku')))))
            ->when($request->filled('warehouse'), fn ($q) => $q->whereHas('sector.warehouse', fn ($w) => $w->where('code', mb_strtoupper($request->string('warehouse')))))
            ->orderBy('id')
            ->limit(5000)
            ->get();

        return response()->json(StockItemResource::collection($items));
    }

    /** Movements after a given id - simple polling feed. */
    public function movements(Request $request): JsonResponse
    {
        $movements = StockMovement::query()
            ->with(['product', 'fromSector.warehouse', 'toSector.warehouse', 'user'])
            ->where('id', '>', $request->integer('since_id'))
            ->orderBy('id')
            ->limit(min(max($request->integer('limit', 200), 1), 1000))
            ->get();

        return response()->json([
            'data' => StockMovementResource::collection($movements),
            'last_id' => $movements->last()?->id ?? $request->integer('since_id'),
        ]);
    }
}
