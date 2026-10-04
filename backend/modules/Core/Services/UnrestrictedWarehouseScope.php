<?php

namespace Modules\Core\Services;

use App\Models\User;
use Modules\Core\Contracts\WarehouseScope;

class UnrestrictedWarehouseScope implements WarehouseScope
{
    public function allowedWarehouseIds(?User $user): ?array
    {
        return null;
    }

    public function canAccess(?User $user, int $warehouseId): bool
    {
        return true;
    }

    public function ensure(?User $user, int $warehouseId): void {}
}
