<?php

namespace Modules\Reports\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Core\Contracts\WarehouseScope;

class ReportController extends Controller
{
    public function __construct(private readonly WarehouseScope $scope) {}

    /** How full every sector is. */
    public function occupancy(Request $request): JsonResponse
    {
        $allowed = $this->scope->allowedWarehouseIds($request->user());

        $rows = DB::table('sectors')
            ->join('warehouses', 'warehouses.id', '=', 'sectors.warehouse_id')
            ->leftJoin('stock_items', 'stock_items.sector_id', '=', 'sectors.id')
            ->when($allowed !== null, fn ($q) => $q->whereIn('warehouses.id', $allowed))
            ->when($request->filled('warehouse_id'), fn ($q) => $q->where('warehouses.id', $request->integer('warehouse_id')))
            ->groupBy('sectors.id', 'sectors.code', 'sectors.name', 'warehouses.code', 'warehouses.name')
            ->selectRaw('sectors.id, sectors.code, sectors.name, warehouses.code as warehouse_code, warehouses.name as warehouse_name,
                COUNT(DISTINCT stock_items.product_id) as products_count,
                COUNT(stock_items.id) as locations_count,
                COALESCE(SUM(stock_items.quantity), 0) as total_quantity,
                MAX(stock_items.updated_at) as last_change')
            ->orderBy('warehouses.code')
            ->orderBy('sectors.code')
            ->get()
            ->map(fn ($r) => [
                'sector_id' => $r->id,
                'warehouse' => $r->warehouse_code,
                'warehouse_name' => $r->warehouse_name,
                'sector' => $r->code,
                'sector_name' => $r->name,
                'products_count' => (int) $r->products_count,
                'locations_count' => (int) $r->locations_count,
                'total_quantity' => (float) $r->total_quantity,
                'last_change' => $r->last_change,
            ]);

        return response()->json($rows);
    }

    /** What moves and what does not: received / issued per product in a period. */
    public function rotation(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        $movements = DB::table('stock_movements')
            ->whereBetween('stock_movements.created_at', [$from, $to])
            ->groupBy('product_id')
            ->selectRaw("product_id,
                SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) as received,
                SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) as issued,
                SUM(CASE WHEN type = 'move' THEN 1 ELSE 0 END) as moves,
                COUNT(*) as operations,
                MAX(created_at) as last_movement");

        $rows = DB::table('products')
            ->leftJoinSub($movements, 'm', 'm.product_id', '=', 'products.id')
            ->leftJoinSub(
                DB::table('stock_items')->groupBy('product_id')->selectRaw('product_id, SUM(quantity) as stock'),
                's',
                's.product_id',
                '=',
                'products.id'
            )
            ->select('products.id', 'products.sku', 'products.name', 'products.unit', 'm.received', 'm.issued', 'm.moves', 'm.operations', 'm.last_movement', 's.stock')
            ->orderByRaw('COALESCE(m.issued, 0) DESC')
            ->orderBy('products.name')
            ->get()
            ->map(fn ($r) => [
                'product_id' => $r->id,
                'sku' => $r->sku,
                'name' => $r->name,
                'unit' => $r->unit,
                'received' => (float) $r->received,
                'issued' => (float) $r->issued,
                'moves' => (int) $r->moves,
                'operations' => (int) $r->operations,
                'stock' => (float) $r->stock,
                'last_movement' => $r->last_movement,
            ]);

        return response()->json(['from' => $from->toDateString(), 'to' => $to->toDateString(), 'rows' => $rows]);
    }

    /** Who did how much in a period. */
    public function activity(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        $rows = DB::table('stock_movements')
            ->leftJoin('users', 'users.id', '=', 'stock_movements.user_id')
            ->whereBetween('stock_movements.created_at', [$from, $to])
            ->groupBy('stock_movements.user_id', 'users.name')
            ->selectRaw("stock_movements.user_id, users.name,
                SUM(CASE WHEN type = 'in' THEN 1 ELSE 0 END) as receipts,
                SUM(CASE WHEN type = 'out' THEN 1 ELSE 0 END) as issues,
                SUM(CASE WHEN type = 'move' THEN 1 ELSE 0 END) as moves,
                SUM(CASE WHEN type = 'adjust' THEN 1 ELSE 0 END) as adjustments,
                COUNT(*) as operations,
                MAX(stock_movements.created_at) as last_activity")
            ->orderByDesc('operations')
            ->get()
            ->map(fn ($r) => [
                'user_id' => $r->user_id,
                'name' => $r->name ?? 'System / usunięty użytkownik',
                'receipts' => (int) $r->receipts,
                'issues' => (int) $r->issues,
                'moves' => (int) $r->moves,
                'adjustments' => (int) $r->adjustments,
                'operations' => (int) $r->operations,
                'last_activity' => $r->last_activity,
            ]);

        return response()->json(['from' => $from->toDateString(), 'to' => $to->toDateString(), 'rows' => $rows]);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function period(Request $request): array
    {
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);

        return [
            $request->filled('from') ? Carbon::parse($request->input('from'))->startOfDay() : now()->subDays(30)->startOfDay(),
            $request->filled('to') ? Carbon::parse($request->input('to'))->endOfDay() : now()->endOfDay(),
        ];
    }
}
