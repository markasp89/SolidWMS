<?php

namespace Modules\Floors\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\URL;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;

class Floor extends Model
{
    protected $fillable = ['warehouse_id', 'name', 'level'];

    protected $casts = [
        'level' => 'integer',
        'floor_plan_width' => 'integer',
        'floor_plan_height' => 'integer',
    ];

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function sectors(): HasMany
    {
        return $this->hasMany(Sector::class);
    }

    public function floorPlanUrl(): ?string
    {
        if (! $this->floor_plan_path) {
            return null;
        }

        return URL::temporarySignedRoute(
            'floors.plan',
            now()->addHours(12),
            ['floor' => $this->id, 'v' => $this->updated_at?->timestamp],
            absolute: false,
        );
    }
}
