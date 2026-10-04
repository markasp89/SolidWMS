<?php

namespace Modules\Warehouses\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Warehouses\Models\Warehouse;

/** @mixin Warehouse */
class WarehouseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'address' => $this->address,
            'description' => $this->description,
            'floor_plan' => $this->hasFloorPlan() ? [
                'url' => $this->floorPlanUrl(),
                'width' => $this->floor_plan_width,
                'height' => $this->floor_plan_height,
            ] : null,
            'sectors_count' => $this->whenCounted('sectors'),
            'sectors' => SectorResource::collection($this->whenLoaded('sectors')),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
