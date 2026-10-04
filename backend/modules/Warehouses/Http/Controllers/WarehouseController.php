<?php

namespace Modules\Warehouses\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Events\DomainEvent;
use Modules\Warehouses\Http\Requests\WarehouseRequest;
use Modules\Warehouses\Http\Resources\WarehouseResource;
use Modules\Warehouses\Models\Warehouse;
use Modules\Warehouses\Services\FloorPlanStorage;

class WarehouseController extends Controller
{
    public function __construct(private readonly WarehouseScope $scope) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $allowed = $this->scope->allowedWarehouseIds($request->user());

        return WarehouseResource::collection(
            Warehouse::query()
                ->when($allowed !== null, fn ($q) => $q->whereIn('id', $allowed))
                ->withCount('sectors')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(WarehouseRequest $request): WarehouseResource
    {
        $warehouse = Warehouse::create($request->validated());

        return new WarehouseResource($warehouse->loadCount('sectors')->load('sectors'));
    }

    public function show(Request $request, Warehouse $warehouse): WarehouseResource
    {
        $this->scope->ensure($request->user(), $warehouse->id);

        return new WarehouseResource($warehouse->loadCount('sectors')->load('sectors'));
    }

    public function update(WarehouseRequest $request, Warehouse $warehouse): WarehouseResource
    {
        $warehouse->update($request->validated());

        return new WarehouseResource($warehouse->loadCount('sectors')->load('sectors'));
    }

    public function destroy(Warehouse $warehouse, FloorPlanStorage $floorPlans): Response
    {
        DB::transaction(function () use ($warehouse, $floorPlans) {
            // Delete sectors one by one so other modules can react (e.g. stock guard).
            $warehouse->sectors->each->delete();
            $warehouse->delete();
            $floorPlans->deleteFile($warehouse);
            event(new DomainEvent('warehouse.deleted', ['id' => $warehouse->id]));
        });

        return response()->noContent();
    }
}
