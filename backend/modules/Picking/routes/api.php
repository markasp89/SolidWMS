<?php

use Illuminate\Support\Facades\Route;
use Modules\Picking\Http\Controllers\PickListController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('picking', [PickListController::class, 'index']);
    Route::post('picking', [PickListController::class, 'store']);
    Route::get('picking/{pickList}', [PickListController::class, 'show']);
    Route::post('picking/{pickList}/lines/{line}/pick', [PickListController::class, 'pick']);
    Route::post('picking/{pickList}/complete', [PickListController::class, 'complete']);
    Route::post('picking/{pickList}/cancel', [PickListController::class, 'cancel']);
});
