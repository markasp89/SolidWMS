<?php

namespace Modules\Inventory\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Inventory\Models\StockItem;

/** @mixin StockItem */
class StockItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'sector_id' => $this->sector_id,
            'quantity' => $this->quantity,
            'note' => $this->note,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'unit' => $this->product->unit,
                'barcode' => $this->product->barcode,
            ]),
            'sector' => $this->whenLoaded('sector', fn () => SectorSummary::from($this->sector)),
            'updated_by' => $this->whenLoaded('updatedBy', fn () => $this->updatedBy ? [
                'id' => $this->updatedBy->id,
                'name' => $this->updatedBy->name,
            ] : null),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
