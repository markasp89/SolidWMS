<?php

namespace Modules\Stocktaking\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Models\Product;

class StocktakeLine extends Model
{
    protected $fillable = [
        'stocktake_id', 'stock_item_id', 'product_id', 'slot', 'batch', 'expires_at', 'pallet_id',
        'expected', 'counted', 'counted_by',
    ];

    protected $casts = [
        'expected' => 'float',
        'counted' => 'float',
        'expires_at' => 'date:Y-m-d',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
