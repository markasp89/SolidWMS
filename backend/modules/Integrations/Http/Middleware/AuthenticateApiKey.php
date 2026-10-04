<?php

namespace Modules\Integrations\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Integrations\Models\ApiKey;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates external systems with "X-Api-Key: swms_..." (or Bearer swms_...).
 * Keys with the "write" ability may use non-GET endpoints.
 */
class AuthenticateApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = $request->header('X-Api-Key') ?: $request->bearerToken();
        $key = $plain && str_starts_with($plain, 'swms_') ? ApiKey::findActive($plain) : null;

        if (! $key) {
            return response()->json(['message' => 'Nieprawidłowy klucz API.'], 401);
        }

        if (! $request->isMethodSafe() && ! $key->can('write')) {
            return response()->json(['message' => 'Ten klucz API pozwala tylko na odczyt.'], 403);
        }

        if (! $key->last_used_at || $key->last_used_at->lt(now()->subMinute())) {
            $key->forceFill(['last_used_at' => now()])->saveQuietly();
        }

        $request->attributes->set('api_key', $key);

        return $next($request);
    }
}
