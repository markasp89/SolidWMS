<?php

namespace Modules\Warehouses\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Warehouses\Http\Requests\SectorRequest;
use Modules\Warehouses\Http\Resources\SectorResource;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;

class SectorController extends Controller
{
    public function __construct(private readonly WarehouseScope $scope) {}

    public function index(Request $request, Warehouse $warehouse): AnonymousResourceCollection
    {
        $this->scope->ensure($request->user(), $warehouse->id);

        return SectorResource::collection($warehouse->sectors);
    }

    public function store(SectorRequest $request, Warehouse $warehouse): SectorResource
    {
        $sector = $warehouse->sectors()->create($request->validated());

        return new SectorResource($sector->load('warehouse'));
    }

    public function show(Request $request, Sector $sector): SectorResource
    {
        $this->scope->ensure($request->user(), $sector->warehouse_id);

        return new SectorResource($sector->load('warehouse'));
    }

    public function update(SectorRequest $request, Sector $sector): SectorResource
    {
        $sector->update($request->validated());

        return new SectorResource($sector->load('warehouse'));
    }

    public function destroy(Sector $sector): Response
    {
        $sector->delete();

        return response()->noContent();
    }
}
