<?php

namespace Modules\Stocktaking\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Warehouses\Models\Sector;

class Stocktake extends Model
{
    protected $fillable = ['sector_id', 'status', 'note', 'created_by', 'completed_by', 'completed_at'];

    protected $casts = ['completed_at' => 'datetime'];

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(StocktakeLine::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function reference(): string
    {
        return sprintf('INW/%05d', $this->id);
    }
}
