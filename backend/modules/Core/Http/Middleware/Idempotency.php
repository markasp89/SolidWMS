<?php

namespace Modules\Core\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Makes write requests safe to retry: a request carrying an "Idempotency-Key"
 * header is executed once, repeated calls get the stored response. Used by the
 * offline queue of the mobile app.
 */
class Idempotency
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('Idempotency-Key');

        if (! $key || $request->isMethodSafe() || strlen($key) > 100) {
            return $next($request);
        }

        $cacheKey = 'idempotency:'.sha1($key.'|'.$request->bearerToken());

        if ($stored = Cache::get($cacheKey)) {
            return response($stored['body'], $stored['status'], ['Content-Type' => 'application/json', 'Idempotent-Replay' => 'true']);
        }

        $response = $next($request);

        if ($response->getStatusCode() < 500) {
            Cache::put($cacheKey, ['status' => $response->getStatusCode(), 'body' => $response->getContent()], now()->addDay());
        }

        return $response;
    }
}
