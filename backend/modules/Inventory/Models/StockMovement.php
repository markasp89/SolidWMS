<?php

namespace Modules\Inventory\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Enums\MovementType;
use Modules\Warehouses\Models\Sector;

class StockMovement extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'product_id', 'type', 'quantity', 'from_sector_id', 'to_sector_id',
        'slot', 'batch', 'pallet_id', 'user_id', 'note', 'reference',
    ];

    protected $casts = [
        'type' => MovementType::class,
        'quantity' => 'float',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function fromSector(): BelongsTo
    {
        return $this->belongsTo(Sector::class, 'from_sector_id');
    }

    public function toSector(): BelongsTo
    {
        return $this->belongsTo(Sector::class, 'to_sector_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
