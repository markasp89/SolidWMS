<?php

use Illuminate\Support\Facades\Route;
use Modules\WarehouseAccess\Http\Controllers\UserWarehouseController;

Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('user-warehouses', [UserWarehouseController::class, 'index']);
    Route::get('users/{user}/warehouses', [UserWarehouseController::class, 'show']);
    Route::put('users/{user}/warehouses', [UserWarehouseController::class, 'update']);
});
