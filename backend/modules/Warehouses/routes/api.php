<?php

use Illuminate\Support\Facades\Route;
use Modules\Warehouses\Http\Controllers\FloorPlanController;
use Modules\Warehouses\Http\Controllers\SectorController;
use Modules\Warehouses\Http\Controllers\WarehouseController;

// Image endpoint is protected by a signed URL instead of the bearer token.
Route::get('warehouses/{warehouse}/floor-plan', [FloorPlanController::class, 'show'])
    ->middleware('signed:relative')
    ->name('warehouses.floor-plan');

Route::middleware('auth:sanctum')->group(function () {
    // Read access for every authenticated user.
    Route::get('warehouses', [WarehouseController::class, 'index']);
    Route::get('warehouses/{warehouse}', [WarehouseController::class, 'show']);
    Route::get('warehouses/{warehouse}/sectors', [SectorController::class, 'index']);
    Route::get('sectors/{sector}', [SectorController::class, 'show']);

    // Layout management is reserved for administrators.
    Route::middleware('role:admin')->group(function () {
        Route::post('warehouses', [WarehouseController::class, 'store']);
        Route::match(['put', 'patch'], 'warehouses/{warehouse}', [WarehouseController::class, 'update']);
        Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy']);

        Route::post('warehouses/{warehouse}/floor-plan', [FloorPlanController::class, 'store']);
        Route::delete('warehouses/{warehouse}/floor-plan', [FloorPlanController::class, 'destroy']);

        Route::post('warehouses/{warehouse}/sectors', [SectorController::class, 'store']);
        Route::match(['put', 'patch'], 'sectors/{sector}', [SectorController::class, 'update']);
        Route::delete('sectors/{sector}', [SectorController::class, 'destroy']);
    });
});
