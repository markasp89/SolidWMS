<?php

use Illuminate\Support\Facades\Route;
use Modules\Alerts\Http\Controllers\AlertController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('alerts/low-stock', [AlertController::class, 'lowStock']);
    Route::get('products/{product}/min-quantity', [AlertController::class, 'getMinimum']);
    Route::put('products/{product}/min-quantity', [AlertController::class, 'setMinimum'])->middleware('role:admin,manager');
    Route::get('notifications', [AlertController::class, 'notifications']);
    Route::post('notifications/read', [AlertController::class, 'markRead']);
});
