<?php

namespace Modules\Integrations\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ApiKey extends Model
{
    protected $fillable = ['name', 'prefix', 'key_hash', 'abilities', 'last_used_at', 'revoked_at', 'created_by'];

    protected $casts = [
        'abilities' => 'array',
        'last_used_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    /** @return array{0: ApiKey, 1: string} the model and the plain key (shown once) */
    public static function generate(string $name, array $abilities, ?int $userId): array
    {
        $plain = 'swms_'.Str::random(40);

        $key = static::create([
            'name' => $name,
            'prefix' => substr($plain, 0, 12),
            'key_hash' => hash('sha256', $plain),
            'abilities' => array_values($abilities),
            'created_by' => $userId,
        ]);

        return [$key, $plain];
    }

    public static function findActive(string $plain): ?self
    {
        return static::where('key_hash', hash('sha256', $plain))->whereNull('revoked_at')->first();
    }

    public function can(string $ability): bool
    {
        return in_array($ability, $this->abilities ?? [], true);
    }
}
