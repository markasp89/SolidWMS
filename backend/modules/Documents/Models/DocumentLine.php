<?php

namespace Modules\Documents\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Models\Product;
use Modules\Warehouses\Models\Sector;

class DocumentLine extends Model
{
    protected $fillable = [
        'document_id', 'position', 'product_id', 'quantity', 'sector_id', 'stock_item_id',
        'slot', 'batch', 'expires_at', 'note', 'posted_locations',
    ];

    protected $casts = [
        'quantity' => 'float',
        'expires_at' => 'date:Y-m-d',
        'posted_locations' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }
}
