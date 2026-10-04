<?php

namespace Modules\WarehouseAccess\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Services\ModuleManager;

/**
 * Users (other than administrators) with assigned warehouses can only see and
 * work in those warehouses. A user without assignments is not restricted.
 */
class AssignedWarehouseScope implements WarehouseScope
{
    /** @var array<int, list<int>|null> */
    private array $cache = [];

    public function __construct(private readonly ModuleManager $modules) {}

    public function allowedWarehouseIds(?User $user): ?array
    {
        if ($user === null || $user->isAdmin() || ! $this->modules->enabled('warehouse_access')) {
            return null;
        }

        if (! array_key_exists($user->id, $this->cache)) {
            $ids = DB::table('user_warehouse')->where('user_id', $user->id)->pluck('warehouse_id')->map(fn ($id) => (int) $id)->all();
            $this->cache[$user->id] = $ids === [] ? null : $ids;
        }

        return $this->cache[$user->id];
    }

    public function canAccess(?User $user, int $warehouseId): bool
    {
        $allowed = $this->allowedWarehouseIds($user);

        return $allowed === null || in_array($warehouseId, $allowed, true);
    }

    public function ensure(?User $user, int $warehouseId): void
    {
        if (! $this->canAccess($user, $warehouseId)) {
            abort(403, 'Nie masz dostępu do tego magazynu.');
        }
    }

    public function forget(int $userId): void
    {
        unset($this->cache[$userId]);
    }
}
