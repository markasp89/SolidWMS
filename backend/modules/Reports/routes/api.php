<?php

use Illuminate\Support\Facades\Route;
use Modules\Reports\Http\Controllers\ReportController;

Route::middleware(['auth:sanctum', 'role:admin,manager'])->prefix('reports')->group(function () {
    Route::get('occupancy', [ReportController::class, 'occupancy']);
    Route::get('rotation', [ReportController::class, 'rotation']);
    Route::get('activity', [ReportController::class, 'activity']);
});
