<?php

use Illuminate\Support\Facades\Route;
use Modules\Pallets\Http\Controllers\PalletController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('pallets', [PalletController::class, 'index']);
    Route::post('pallets', [PalletController::class, 'store']);
    Route::get('pallets/code/{code}', [PalletController::class, 'showByCode']);
    Route::get('pallets/{pallet}', [PalletController::class, 'show']);
    Route::patch('pallets/{pallet}', [PalletController::class, 'update']);
    Route::delete('pallets/{pallet}', [PalletController::class, 'destroy']);
    Route::post('pallets/{pallet}/items', [PalletController::class, 'addItem']);
    Route::post('pallets/{pallet}/move', [PalletController::class, 'move']);
});
