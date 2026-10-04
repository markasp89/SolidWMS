<?php

namespace Modules\Photos\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\URL;

class Photo extends Model
{
    public const SUBJECTS = [
        'product' => 'products',
        'stock_item' => 'stock_items',
        'pallet' => 'pallets',
    ];

    protected $fillable = ['subject_type', 'subject_id', 'path', 'width', 'height', 'caption', 'user_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function url(): string
    {
        return URL::temporarySignedRoute('photos.file', now()->addHours(12), ['photo' => $this->id], absolute: false);
    }
}
