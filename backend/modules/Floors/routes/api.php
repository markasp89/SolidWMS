<?php

use Illuminate\Support\Facades\Route;
use Modules\Floors\Http\Controllers\FloorController;

Route::get('floors/{floor}/plan', [FloorController::class, 'plan'])->middleware('signed:relative')->name('floors.plan');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('warehouses/{warehouse}/floors', [FloorController::class, 'index']);

    Route::middleware('role:admin')->group(function () {
        Route::post('warehouses/{warehouse}/floors', [FloorController::class, 'store']);
        Route::patch('floors/{floor}', [FloorController::class, 'update']);
        Route::delete('floors/{floor}', [FloorController::class, 'destroy']);
        Route::post('floors/{floor}/plan', [FloorController::class, 'uploadPlan']);
        Route::delete('floors/{floor}/plan', [FloorController::class, 'removePlan']);
    });
});
