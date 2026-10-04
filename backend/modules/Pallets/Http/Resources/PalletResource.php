<?php

namespace Modules\Pallets\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Inventory\Http\Resources\SectorSummary;
use Modules\Inventory\Http\Resources\StockItemResource;
use Modules\Pallets\Models\Pallet;

/** @mixin Pallet */
class PalletResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'sector_id' => $this->sector_id,
            'slot' => $this->slot,
            'note' => $this->note,
            'sector' => $this->whenLoaded('sector', fn () => SectorSummary::from($this->sector)),
            'items_count' => $this->whenCounted('items'),
            'items' => StockItemResource::collection($this->whenLoaded('items')),
            'created_by' => $this->whenLoaded('createdBy', fn () => $this->createdBy?->only(['id', 'name'])),
            'moved_by' => $this->whenLoaded('movedBy', fn () => $this->movedBy?->only(['id', 'name'])),
            'moved_at' => $this->moved_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
