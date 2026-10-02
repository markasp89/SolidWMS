<?php

namespace Modules\Auth\Providers;

use Laravel\Sanctum\Sanctum;
use Modules\Core\Support\ModuleServiceProvider;

class AuthServiceProvider extends ModuleServiceProvider
{
    protected function bootModule(): void
    {
        // Tokens of deactivated accounts stop working immediately.
        Sanctum::authenticateAccessTokensUsing(
            fn ($token, bool $isValid) => $isValid && (bool) $token->tokenable?->is_active
        );
    }
}
