<?php

namespace Modules\Inventory\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Modules\Warehouses\Models\Sector;

/**
 * Quantity of a product at one location.
 *
 * @property int $id
 * @property int $product_id
 * @property int $sector_id
 * @property string|null $slot
 * @property string|null $batch
 * @property Carbon|null $expires_at
 * @property int|null $pallet_id
 * @property float $quantity
 */
class StockItem extends Model
{
    /** Columns that, together with product and sector, identify a location. */
    public const DIMENSIONS = ['slot', 'batch', 'expires_at', 'pallet_id'];

    /** Relations eager loaded in API responses. Other modules may append to it. */
    public static array $apiRelations = ['product', 'sector.warehouse', 'updatedBy'];

    protected $fillable = ['product_id', 'sector_id', 'slot', 'batch', 'expires_at', 'pallet_id', 'quantity', 'note', 'updated_by'];

    protected $casts = [
        'quantity' => 'float',
        'expires_at' => 'date:Y-m-d',
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

    /** Matches a location by its dimensions (null-safe). */
    public function scopeAtLocation(Builder $query, int $productId, int $sectorId, array $dimensions): Builder
    {
        $query->where('product_id', $productId)->where('sector_id', $sectorId);

        foreach (self::DIMENSIONS as $column) {
            $value = $dimensions[$column] ?? null;
            $value === null || $value === '' ? $query->whereNull($column) : $query->where($column, $value);
        }

        return $query;
    }

    /** Restricts to the given warehouses (null = no restriction). */
    public function scopeInWarehouses(Builder $query, ?array $warehouseIds): Builder
    {
        if ($warehouseIds === null) {
            return $query;
        }

        return $query->whereHas('sector', fn ($s) => $s->whereIn('warehouse_id', $warehouseIds));
    }

    /** First expiring first (FEFO), then the biggest quantities. */
    public function scopeFefo(Builder $query): Builder
    {
        return $query->orderByRaw('CASE WHEN stock_items.expires_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('stock_items.expires_at')
            ->orderByDesc('stock_items.quantity');
    }

    /** "A1 / 03-2" style label used in notes and documents. */
    public function locationLabel(): string
    {
        $sector = $this->sector;
        $label = ($sector?->warehouse?->code ? $sector->warehouse->code.'/' : '').($sector?->code ?? '?');

        return $this->slot ? "{$label}-{$this->slot}" : $label;
    }
}
