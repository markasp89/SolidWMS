<?php

namespace Modules\Floors\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Floors\Http\Resources\FloorResource;
use Modules\Floors\Models\Floor;
use Modules\Warehouses\Models\Warehouse;
use Modules\Warehouses\Services\FloorPlanStorage;
use Symfony\Component\HttpFoundation\Response as BaseResponse;

class FloorController extends Controller
{
    public function __construct(
        private readonly FloorPlanStorage $plans,
        private readonly WarehouseScope $scope,
    ) {}

    public function index(Request $request, Warehouse $warehouse): AnonymousResourceCollection
    {
        $this->scope->ensure($request->user(), $warehouse->id);

        return FloorResource::collection(
            Floor::where('warehouse_id', $warehouse->id)->withCount('sectors')->orderBy('level')->orderBy('id')->get()
        );
    }

    public function store(Request $request, Warehouse $warehouse): FloorResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'level' => ['nullable', 'integer', 'between:-10,200'],
        ]);

        $floor = Floor::create([
            'warehouse_id' => $warehouse->id,
            'name' => $data['name'],
            'level' => $data['level'] ?? (int) Floor::where('warehouse_id', $warehouse->id)->max('level') + 1,
        ]);

        return new FloorResource($floor->loadCount('sectors'));
    }

    public function update(Request $request, Floor $floor): FloorResource
    {
        $floor->update($request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'level' => ['sometimes', 'integer', 'between:-10,200'],
        ]));

        return new FloorResource($floor->loadCount('sectors'));
    }

    public function destroy(Floor $floor): Response
    {
        if ($floor->sectors()->exists()) {
            throw ValidationException::withMessages(['floor' => 'Najpierw usuń sektory z tego piętra.']);
        }

        $this->plans->deleteFile($floor);
        $floor->delete();

        return response()->noContent();
    }

    public function uploadPlan(Request $request, Floor $floor): FloorResource
    {
        $request->validate([
            'floor_plan' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp,gif', 'max:20480'],
        ]);

        $this->plans->storeUpload($floor, $request->file('floor_plan'));

        return new FloorResource($floor->loadCount('sectors'));
    }

    public function removePlan(Floor $floor): FloorResource
    {
        $this->plans->remove($floor);

        return new FloorResource($floor->loadCount('sectors'));
    }

    public function plan(Floor $floor): BaseResponse
    {
        $contents = $this->plans->contents($floor);
        abort_if($contents === null, 404);

        return response($contents, 200, [
            'Content-Type' => getimagesizefromstring($contents)['mime'] ?? 'application/octet-stream',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
