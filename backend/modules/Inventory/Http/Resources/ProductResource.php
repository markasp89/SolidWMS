<?php

namespace Modules\Inventory\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Inventory\Models\Product;

/** @mixin Product */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'name' => $this->name,
            'barcode' => $this->barcode,
            'unit' => $this->unit,
            'description' => $this->description,
            'total_quantity' => $this->when(
                array_key_exists('stock_items_sum_quantity', $this->getAttributes()),
                fn () => (float) $this->stock_items_sum_quantity,
            ),
            'locations_count' => $this->whenCounted('stockItems'),
            'locations' => StockItemResource::collection($this->whenLoaded('stockItems')),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
