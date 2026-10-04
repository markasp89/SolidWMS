<?php

namespace Modules\Pallets\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Inventory\Http\Requests\StockOperationRequest;
use Modules\Inventory\Http\Resources\StockItemResource;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Pallets\Http\Resources\PalletResource;
use Modules\Pallets\Models\Pallet;
use Modules\Pallets\Services\PalletService;
use Modules\Warehouses\Models\Sector;

class PalletController extends Controller
{
    public function __construct(
        private readonly PalletService $pallets,
        private readonly WarehouseScope $scope,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $allowed = $this->scope->allowedWarehouseIds($request->user());
        $term = trim($request->string('q')->toString());

        $pallets = Pallet::query()
            ->with(['sector.warehouse'])
            ->withCount('items')
            ->when($allowed !== null, fn ($q) => $q->whereHas('sector', fn ($s) => $s->whereIn('warehouse_id', $allowed)))
            ->when($request->filled('sector_id'), fn ($q) => $q->where('sector_id', $request->integer('sector_id')))
            ->when($request->filled('warehouse_id'), fn ($q) => $q->whereHas('sector', fn ($s) => $s->where('warehouse_id', $request->integer('warehouse_id'))))
            ->when($term !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('code', 'like', '%'.mb_strtoupper($term).'%')
                ->orWhereHas('items.product', fn ($p) => $p->search($term))))
            ->orderByDesc('updated_at')
            ->paginate(min(max($request->integer('per_page', 30), 1), 100))
            ->withQueryString();

        return PalletResource::collection($pallets);
    }

    public function store(Request $request): PalletResource
    {
        $data = $request->validate([
            'sector_id' => ['required', 'integer', 'exists:sectors,id'],
            'slot' => ['nullable', 'string', 'max:32'],
            'code' => ['nullable', 'string', 'max:32', 'regex:/^[A-Za-z0-9_.\-]+$/', Rule::unique('pallets', 'code')],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $pallet = $this->pallets->create(
            Sector::findOrFail($data['sector_id']),
            $data['slot'] ?? null,
            $data['code'] ?? null,
            $data['note'] ?? null,
            $request->user(),
        );

        return $this->resource($pallet);
    }

    public function show(Request $request, Pallet $pallet): PalletResource
    {
        $this->authorizeAccess($request, $pallet);

        return $this->resource($pallet);
    }

    public function showByCode(Request $request, string $code): PalletResource
    {
        $pallet = Pallet::where('code', mb_strtoupper($code))->firstOrFail();

        return $this->show($request, $pallet);
    }

    public function update(Request $request, Pallet $pallet): PalletResource
    {
        $this->authorizeAccess($request, $pallet);

        $pallet->update($request->validate([
            'code' => ['sometimes', 'string', 'max:32', 'regex:/^[A-Za-z0-9_.\-]+$/', Rule::unique('pallets', 'code')->ignore($pallet)],
            'note' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]));

        return $this->resource($pallet);
    }

    public function destroy(Request $request, Pallet $pallet): Response
    {
        $this->authorizeAccess($request, $pallet);
        $this->pallets->delete($pallet);

        return response()->noContent();
    }

    public function addItem(Request $request, Pallet $pallet): StockItemResource
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:999999999'],
            'note' => ['nullable', 'string', 'max:255'],
            ...StockOperationRequest::dimensionRules(),
        ]);

        $item = $this->pallets->addItem(
            $pallet,
            Product::findOrFail($data['product_id']),
            (float) $data['quantity'],
            $data,
            $data['note'] ?? null,
            $request->user(),
        );

        return new StockItemResource($item->fresh(StockItem::$apiRelations));
    }

    public function move(Request $request, Pallet $pallet): PalletResource
    {
        $data = $request->validate([
            'to_sector_id' => ['required', 'integer', 'exists:sectors,id'],
            'to_slot' => ['nullable', 'string', 'max:32'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $this->pallets->move(
            $pallet,
            Sector::findOrFail($data['to_sector_id']),
            $data['to_slot'] ?? null,
            $data['note'] ?? null,
            $request->user(),
        );

        return $this->resource($pallet->refresh());
    }

    private function authorizeAccess(Request $request, Pallet $pallet): void
    {
        if ($pallet->sector) {
            $this->scope->ensure($request->user(), $pallet->sector->warehouse_id);
        }
    }

    private function resource(Pallet $pallet): PalletResource
    {
        return new PalletResource($pallet->load([
            'sector.warehouse',
            'createdBy',
            'movedBy',
            'items' => fn ($q) => $q->with(StockItem::$apiRelations)->fefo(),
        ])->loadCount('items'));
    }
}
