<?php

namespace Modules\Warehouses\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Warehouses\Http\Resources\WarehouseResource;
use Modules\Warehouses\Models\Warehouse;
use Modules\Warehouses\Services\FloorPlanStorage;
use Symfony\Component\HttpFoundation\Response;

class FloorPlanController extends Controller
{
    public function __construct(private readonly FloorPlanStorage $floorPlans) {}

    public function show(Warehouse $warehouse): Response
    {
        $contents = $this->floorPlans->contents($warehouse);

        abort_if($contents === null, 404);

        $mime = getimagesizefromstring($contents)['mime'] ?? 'application/octet-stream';

        return response($contents, 200, [
            'Content-Type' => $mime,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function store(Request $request, Warehouse $warehouse): WarehouseResource
    {
        $request->validate([
            'floor_plan' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp,gif', 'max:20480'],
        ]);

        $this->floorPlans->storeUpload($warehouse, $request->file('floor_plan'));

        return new WarehouseResource($warehouse->loadCount('sectors')->load('sectors'));
    }

    public function destroy(Warehouse $warehouse): WarehouseResource
    {
        $this->floorPlans->remove($warehouse);

        return new WarehouseResource($warehouse->loadCount('sectors')->load('sectors'));
    }
}
