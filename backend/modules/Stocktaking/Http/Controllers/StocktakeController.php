<?php

namespace Modules\Stocktaking\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Inventory\Http\Requests\StockOperationRequest;
use Modules\Inventory\Http\Resources\SectorSummary;
use Modules\Inventory\Services\StockService;
use Modules\Stocktaking\Models\Stocktake;
use Modules\Stocktaking\Models\StocktakeLine;
use Modules\Stocktaking\Services\StocktakeService;
use Modules\Warehouses\Models\Sector;

class StocktakeController extends Controller
{
    public function __construct(
        private readonly StocktakeService $service,
        private readonly WarehouseScope $scope,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $allowed = $this->scope->allowedWarehouseIds($request->user());

        $list = Stocktake::query()
            ->with(['sector.warehouse', 'createdBy', 'completedBy'])
            ->withCount('lines')
            ->when($allowed !== null, fn ($q) => $q->whereHas('sector', fn ($s) => $s->whereIn('warehouse_id', $allowed)))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->toString()))
            ->when($request->filled('sector_id'), fn ($q) => $q->where('sector_id', $request->integer('sector_id')))
            ->latest()
            ->limit(100)
            ->get();

        return response()->json($list->map(fn (Stocktake $s) => $this->summary($s)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sector_id' => ['required', 'integer', 'exists:sectors,id'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $stocktake = $this->service->start(Sector::findOrFail($data['sector_id']), $data['note'] ?? null, $request->user());

        return response()->json($this->detail($stocktake), 201);
    }

    public function show(Request $request, Stocktake $stocktake): JsonResponse
    {
        $this->scope->ensure($request->user(), $stocktake->sector->warehouse_id);

        return response()->json($this->detail($stocktake));
    }

    public function count(Request $request, Stocktake $stocktake, StocktakeLine $line): JsonResponse
    {
        abort_unless($line->stocktake_id === $stocktake->id, 404);
        $this->scope->ensure($request->user(), $stocktake->sector->warehouse_id);
        $this->service->ensureOpen($stocktake);

        $data = $request->validate(['counted' => ['present', 'nullable', 'numeric', 'gte:0', 'max:999999999']]);
        $line->update(['counted' => $data['counted'], 'counted_by' => $request->user()->id]);

        return response()->json($this->detail($stocktake));
    }

    /** Adds a product that was found in the sector but is not in the system. */
    public function addLine(Request $request, Stocktake $stocktake): JsonResponse
    {
        $this->scope->ensure($request->user(), $stocktake->sector->warehouse_id);
        $this->service->ensureOpen($stocktake);

        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'counted' => ['required', 'numeric', 'gt:0', 'max:999999999'],
            ...StockOperationRequest::dimensionRules(),
        ]);

        $stocktake->lines()->create([
            ...StockService::normalize($data),
            'pallet_id' => null,
            'product_id' => $data['product_id'],
            'expected' => 0,
            'counted' => $data['counted'],
            'counted_by' => $request->user()->id,
        ]);

        return response()->json($this->detail($stocktake), 201);
    }

    public function complete(Request $request, Stocktake $stocktake): JsonResponse
    {
        $this->scope->ensure($request->user(), $stocktake->sector->warehouse_id);
        $result = $this->service->complete($stocktake, $request->user());

        return response()->json(['result' => $result] + $this->detail($stocktake->refresh()));
    }

    public function cancel(Request $request, Stocktake $stocktake): JsonResponse
    {
        $this->scope->ensure($request->user(), $stocktake->sector->warehouse_id);
        $this->service->ensureOpen($stocktake);
        $stocktake->update(['status' => 'cancelled', 'completed_by' => $request->user()->id, 'completed_at' => now()]);

        return response()->json($this->detail($stocktake));
    }

    private function summary(Stocktake $s): array
    {
        $s->loadMissing(['sector.warehouse', 'createdBy', 'completedBy']);

        return [
            'id' => $s->id,
            'reference' => $s->reference(),
            'status' => $s->status,
            'note' => $s->note,
            'sector' => SectorSummary::from($s->sector),
            'lines_count' => $s->lines_count ?? $s->lines()->count(),
            'created_by' => $s->createdBy?->only(['id', 'name']),
            'completed_by' => $s->completedBy?->only(['id', 'name']),
            'created_at' => $s->created_at?->toIso8601String(),
            'completed_at' => $s->completed_at?->toIso8601String(),
        ];
    }

    private function detail(Stocktake $s): array
    {
        $lines = $s->lines()->with('product')->get()->sortBy(fn ($l) => [$l->slot ?? '', $l->product?->name ?? ''])->values();

        return $this->summary($s) + [
            'lines' => $lines->map(fn (StocktakeLine $l) => [
                'id' => $l->id,
                'product' => $l->product?->only(['id', 'sku', 'name', 'unit', 'barcode']),
                'slot' => $l->slot,
                'batch' => $l->batch,
                'expires_at' => $l->expires_at?->toDateString(),
                'pallet_id' => $l->pallet_id,
                'expected' => $l->expected,
                'counted' => $l->counted,
                'difference' => $l->counted === null ? null : round($l->counted - $l->expected, 3),
            ]),
        ];
    }
}
