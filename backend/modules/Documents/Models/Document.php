<?php

namespace Modules\Documents\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Warehouses\Models\Warehouse;

class Document extends Model
{
    public const TYPES = ['PZ' => 'Przyjęcie zewnętrzne', 'WZ' => 'Wydanie zewnętrzne'];

    protected $fillable = ['type', 'number', 'status', 'warehouse_id', 'counterparty', 'note', 'created_by', 'posted_by', 'posted_at'];

    protected $casts = ['posted_at' => 'datetime'];

    public function lines(): HasMany
    {
        return $this->hasMany(DocumentLine::class)->orderBy('position');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function postedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    public static function nextNumber(string $type): string
    {
        $prefix = $type.'/'.now()->format('Y/m').'/';
        $last = static::where('number', 'like', $prefix.'%')->orderByDesc('number')->value('number');
        $next = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
