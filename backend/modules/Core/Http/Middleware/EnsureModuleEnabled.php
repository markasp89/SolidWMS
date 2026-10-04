<?php

namespace Modules\Core\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Core\Services\ModuleManager;
use Symfony\Component\HttpFoundation\Response;

/**
 * Routes of a switched-off module answer 404 ("module:pallets").
 */
class EnsureModuleEnabled
{
    public function __construct(private readonly ModuleManager $modules) {}

    public function handle(Request $request, Closure $next, string $module): Response
    {
        if (! $this->modules->enabled($module)) {
            abort(404, 'Moduł jest wyłączony.');
        }

        return $next($request);
    }
}
