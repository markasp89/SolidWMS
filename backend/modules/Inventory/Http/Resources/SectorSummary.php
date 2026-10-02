<?php

namespace Modules\Inventory\Http\Resources;

use Modules\Warehouses\Models\Sector;

/**
 * Compact "where is it" description of a sector used across inventory responses.
 */
final class SectorSummary
{
    public static function from(?Sector $sector): ?array
    {
        if ($sector === null) {
            return null;
        }

        return [
            'id' => $sector->id,
            'code' => $sector->code,
            'name' => $sector->name,
            'color' => $sector->color,
            'warehouse' => $sector->relationLoaded('warehouse') ? [
                'id' => $sector->warehouse->id,
                'code' => $sector->warehouse->code,
                'name' => $sector->warehouse->name,
            ] : null,
        ];
    }
}
