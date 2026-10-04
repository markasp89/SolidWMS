<?php

namespace Modules\Core\Contracts;

use App\Models\User;

/**
 * Decides which warehouses a user may see and work in.
 * The default implementation allows everything; the "warehouse_access"
 * module replaces it with per-user assignments.
 */
interface WarehouseScope
{
    /** @return list<int>|null null = no restriction */
    public function allowedWarehouseIds(?User $user): ?array;

    public function canAccess(?User $user, int $warehouseId): bool;

    /** Throws 403 when the user may not work in the warehouse. */
    public function ensure(?User $user, int $warehouseId): void;
}
