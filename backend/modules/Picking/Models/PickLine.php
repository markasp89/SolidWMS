<?php

namespace Modules\Picking\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Models\Product;
use Modules\Warehouses\Models\Sector;

class PickLine extends Model
{
    protected $fillable = [
        'pick_list_id', 'sequence', 'product_id', 'stock_item_id', 'sector_id', 'slot', 'batch', 'expires_at',
        'quantity', 'picked', 'status', 'picked_by', 'picked_at',
    ];

    protected $casts = [
        'quantity' => 'float',
        'picked' => 'float',
        'expires_at' => 'date:Y-m-d',
        'picked_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function pickedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'picked_by');
    }
}
