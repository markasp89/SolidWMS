<?php

namespace Modules\Inventory\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Warehouses\Models\Sector;

/**
 * @property int $id
 * @property int $product_id
 * @property int $sector_id
 * @property float $quantity
 */
class StockItem extends Model
{
    protected $fillable = ['product_id', 'sector_id', 'quantity', 'note', 'updated_by'];

    protected $casts = [
        'quantity' => 'float',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
