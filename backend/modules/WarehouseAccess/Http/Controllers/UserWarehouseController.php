<?php

namespace Modules\WarehouseAccess\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Core\Contracts\WarehouseScope;

class UserWarehouseController extends Controller
{
    public function index(): JsonResponse
    {
        // user_id => [warehouse ids] for the users list
        $map = DB::table('user_warehouse')->get()->groupBy('user_id')
            ->map(fn ($rows) => $rows->pluck('warehouse_id')->map(fn ($id) => (int) $id)->values());

        return response()->json($map);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json([
            'warehouse_ids' => DB::table('user_warehouse')->where('user_id', $user->id)->pluck('warehouse_id')->map(fn ($id) => (int) $id),
        ]);
    }

    public function update(Request $request, User $user, WarehouseScope $scope): JsonResponse
    {
        $data = $request->validate([
            'warehouse_ids' => ['present', 'array'],
            'warehouse_ids.*' => ['integer', 'distinct', 'exists:warehouses,id'],
        ]);

        DB::transaction(function () use ($user, $data) {
            DB::table('user_warehouse')->where('user_id', $user->id)->delete();
            DB::table('user_warehouse')->insert(
                array_map(fn ($id) => ['user_id' => $user->id, 'warehouse_id' => $id], $data['warehouse_ids'])
            );
        });

        if (method_exists($scope, 'forget')) {
            $scope->forget($user->id);
        }

        return $this->show($user);
    }
}
