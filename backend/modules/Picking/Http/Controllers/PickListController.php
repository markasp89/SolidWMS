<?php

namespace Modules\Picking\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Inventory\Http\Resources\SectorSummary;
use Modules\Picking\Models\PickLine;
use Modules\Picking\Models\PickList;
use Modules\Picking\Services\PickingService;
use Modules\Warehouses\Models\Warehouse;

class PickListController extends Controller
{
    public function __construct(
        private readonly PickingService $picking,
        private readonly WarehouseScope $scope,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $allowed = $this->scope->allowedWarehouseIds($request->user());

        $lists = PickList::query()
            ->with(['warehouse', 'createdBy'])
            ->withCount(['lines', 'lines as pending_count' => fn ($q) => $q->where('status', 'pending')])
            ->when($allowed !== null, fn ($q) => $q->whereIn('warehouse_id', $allowed))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->toString()))
            ->latest('id')
            ->limit(100)
            ->get();

        return response()->json($lists->map(fn (PickList $l) => $this->summary($l)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'note' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1', 'max:300'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:999999999'],
        ], ['items.required' => 'Dodaj co najmniej jeden produkt.']);

        $list = $this->picking->create(Warehouse::findOrFail($data['warehouse_id']), $data['items'], $data['note'] ?? null, $request->user());

        return response()->json($this->detail($list), 201);
    }

    public function show(Request $request, PickList $pickList): JsonResponse
    {
        $this->scope->ensure($request->user(), $pickList->warehouse_id);

        return response()->json($this->detail($pickList));
    }

    public function pick(Request $request, PickList $pickList, PickLine $line): JsonResponse
    {
        abort_unless($line->pick_list_id === $pickList->id, 404);
        $data = $request->validate(['quantity' => ['nullable', 'numeric', 'gt:0', 'max:999999999']]);

        $this->picking->pick($pickList, $line, isset($data['quantity']) ? (float) $data['quantity'] : null, $request->user());

        return response()->json($this->detail($pickList->refresh()));
    }

    public function complete(Request $request, PickList $pickList): JsonResponse
    {
        $this->scope->ensure($request->user(), $pickList->warehouse_id);
        $this->picking->complete($pickList);

        return response()->json($this->detail($pickList));
    }

    public function cancel(Request $request, PickList $pickList): JsonResponse
    {
        $this->scope->ensure($request->user(), $pickList->warehouse_id);
        $this->picking->ensureOpen($pickList);
        $pickList->update(['status' => 'cancelled', 'completed_at' => now()]);

        return response()->json($this->detail($pickList));
    }

    private function summary(PickList $l): array
    {
        $l->loadMissing(['warehouse', 'createdBy']);

        return [
            'id' => $l->id,
            'number' => $l->number,
            'status' => $l->status,
            'note' => $l->note,
            'warehouse' => $l->warehouse?->only(['id', 'code', 'name']),
            'lines_count' => $l->lines_count ?? $l->lines()->count(),
            'pending_count' => $l->pending_count ?? $l->lines()->where('status', 'pending')->count(),
            'created_by' => $l->createdBy?->only(['id', 'name']),
            'created_at' => $l->created_at?->toIso8601String(),
            'completed_at' => $l->completed_at?->toIso8601String(),
        ];
    }

    private function detail(PickList $l): array
    {
        $l->load(['lines.product', 'lines.sector.warehouse', 'lines.pickedBy']);

        return $this->summary($l) + [
            'lines' => $l->lines->map(fn (PickLine $line) => [
                'id' => $line->id,
                'sequence' => $line->sequence,
                'product' => $line->product?->only(['id', 'sku', 'name', 'unit', 'barcode']),
                'sector' => SectorSummary::from($line->sector),
                'slot' => $line->slot,
                'batch' => $line->batch,
                'expires_at' => $line->expires_at?->toDateString(),
                'quantity' => $line->quantity,
                'picked' => $line->picked,
                'status' => $line->status,
                'picked_by' => $line->pickedBy?->only(['id', 'name']),
                'picked_at' => $line->picked_at?->toIso8601String(),
            ]),
        ];
    }
}
