<?php

use Illuminate\Support\Facades\Route;
use Modules\Stocktaking\Http\Controllers\StocktakeController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('stocktakes', [StocktakeController::class, 'index']);
    Route::post('stocktakes', [StocktakeController::class, 'store']);
    Route::get('stocktakes/{stocktake}', [StocktakeController::class, 'show']);
    Route::put('stocktakes/{stocktake}/lines/{line}', [StocktakeController::class, 'count']);
    Route::post('stocktakes/{stocktake}/lines', [StocktakeController::class, 'addLine']);
    // Applying corrections requires a shift manager or an administrator.
    Route::post('stocktakes/{stocktake}/complete', [StocktakeController::class, 'complete'])->middleware('role:admin,manager');
    Route::post('stocktakes/{stocktake}/cancel', [StocktakeController::class, 'cancel'])->middleware('role:admin,manager');
});
