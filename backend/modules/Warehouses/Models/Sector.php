<?php

namespace Modules\Warehouses\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Warehouses\Database\Factories\SectorFactory;

/**
 * @property int $id
 * @property int $warehouse_id
 * @property string $code
 * @property string $name
 * @property array<int, array{0: float, 1: float}>|null $shape
 */
class Sector extends Model
{
    use HasFactory;

    protected $fillable = ['warehouse_id', 'floor_id', 'code', 'name', 'color', 'description', 'shape'];

    protected $casts = [
        'shape' => 'array',
    ];

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    protected static function newFactory(): SectorFactory
    {
        return SectorFactory::new();
    }
}
