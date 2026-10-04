<?php

namespace Modules\Suggestions\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Inventory\Http\Resources\SectorSummary;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Warehouses\Models\Sector;

/**
 * Where should this product go? Suggests sectors where it already lies,
 * then sectors where it was put most often in the last 90 days.
 */
class SuggestionController extends Controller
{
    public function __invoke(Request $request, Product $product, WarehouseScope $scope): JsonResponse
    {
        $allowed = $scope->allowedWarehouseIds($request->user());
        $suggestions = [];

        $current = StockItem::query()
            ->with('sector.warehouse')
            ->where('product_id', $product->id)
            ->inWarehouses($allowed)
            ->orderByDesc('quantity')
            ->limit(5)
            ->get();

        foreach ($current as $item) {
            $key = $item->sector_id.'|'.$item->slot;
            $suggestions[$key] ??= [
                'sector' => SectorSummary::from($item->sector),
                'slot' => $item->slot,
                'quantity' => $item->quantity,
                'reason' => 'stored',
                'label' => 'Już tu leży',
            ];
        }

        $history = DB::table('stock_movements')
            ->where('product_id', $product->id)
            ->whereIn('type', ['in', 'move'])
            ->whereNotNull('to_sector_id')
            ->where('created_at', '>=', now()->subDays(90))
            ->groupBy('to_sector_id', 'slot')
            ->selectRaw('to_sector_id, slot, COUNT(*) as times')
            ->orderByDesc('times')
            ->limit(10)
            ->get();

        $sectors = Sector::with('warehouse')->whereIn('id', $history->pluck('to_sector_id'))->get()->keyBy('id');

        foreach ($history as $row) {
            $sector = $sectors[$row->to_sector_id] ?? null;
            if (! $sector || ($allowed !== null && ! in_array($sector->warehouse_id, $allowed, true))) {
                continue;
            }
            $key = $sector->id.'|'.$row->slot;
            $suggestions[$key] ??= [
                'sector' => SectorSummary::from($sector),
                'slot' => $row->slot,
                'quantity' => 0,
                'reason' => 'history',
                'label' => "Odkładany tu {$row->times}×",
            ];
        }

        return response()->json(array_slice(array_values($suggestions), 0, 5));
    }
}
