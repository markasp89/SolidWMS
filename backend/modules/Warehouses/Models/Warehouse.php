<?php

namespace Modules\Warehouses\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\URL;
use Modules\Warehouses\Database\Factories\WarehouseFactory;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $floor_plan_path
 */
class Warehouse extends Model
{
    use HasFactory;

    protected $fillable = ['code', 'name', 'address', 'description'];

    protected $casts = [
        'floor_plan_width' => 'integer',
        'floor_plan_height' => 'integer',
    ];

    public function sectors(): HasMany
    {
        return $this->hasMany(Sector::class)->orderBy('code');
    }

    public function hasFloorPlan(): bool
    {
        return $this->floor_plan_path !== null;
    }

    /**
     * Relative, signed URL so the image can be used directly in an <img> tag
     * (browsers do not send the bearer token with image requests).
     */
    public function floorPlanUrl(): ?string
    {
        if (! $this->hasFloorPlan()) {
            return null;
        }

        return URL::temporarySignedRoute(
            'warehouses.floor-plan',
            now()->addHours(12),
            ['warehouse' => $this->id, 'v' => $this->updated_at?->timestamp],
            absolute: false,
        );
    }

    protected static function newFactory(): WarehouseFactory
    {
        return WarehouseFactory::new();
    }
}
