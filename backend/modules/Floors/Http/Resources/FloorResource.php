<?php

namespace Modules\Floors\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Floors\Models\Floor;

/** @mixin Floor */
class FloorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'warehouse_id' => $this->warehouse_id,
            'name' => $this->name,
            'level' => $this->level,
            'floor_plan' => $this->floor_plan_path ? [
                'url' => $this->floorPlanUrl(),
                'width' => $this->floor_plan_width,
                'height' => $this->floor_plan_height,
            ] : null,
            'sectors_count' => $this->whenCounted('sectors'),
        ];
    }
}
