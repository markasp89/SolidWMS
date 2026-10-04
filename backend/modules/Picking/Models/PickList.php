<?php

namespace Modules\Picking\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Warehouses\Models\Warehouse;

class PickList extends Model
{
    protected $fillable = ['number', 'warehouse_id', 'status', 'note', 'created_by', 'completed_at'];

    protected $casts = ['completed_at' => 'datetime'];

    public function lines(): HasMany
    {
        return $this->hasMany(PickLine::class)->orderBy('sequence');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function nextNumber(): string
    {
        $prefix = 'KOM/'.now()->format('Y/m').'/';
        $last = static::where('number', 'like', $prefix.'%')->orderByDesc('number')->value('number');

        return $prefix.str_pad((string) (($last ? (int) substr($last, strlen($prefix)) : 0) + 1), 4, '0', STR_PAD_LEFT);
    }
}
