<?php

namespace Modules\Pallets\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Inventory\Models\StockItem;
use Modules\Warehouses\Models\Sector;

/**
 * @property int $id
 * @property string $code
 * @property int|null $sector_id
 * @property string|null $slot
 */
class Pallet extends Model
{
    protected $fillable = ['code', 'sector_id', 'slot', 'note', 'created_by', 'moved_by', 'moved_at'];

    protected $casts = ['moved_at' => 'datetime'];

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockItem::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function movedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'moved_by');
    }

    /** Next free code like "P-00042". */
    public static function nextCode(): string
    {
        $next = (int) static::query()->max('id') + 1;
        do {
            $code = sprintf('P-%05d', $next++);
        } while (static::where('code', $code)->exists());

        return $code;
    }
}
