<?php

use Illuminate\Support\Facades\Route;
use Modules\Inventory\Http\Controllers\DashboardController;
use Modules\Inventory\Http\Controllers\MovementController;
use Modules\Inventory\Http\Controllers\ProductController;
use Modules\Inventory\Http\Controllers\SearchController;
use Modules\Inventory\Http\Controllers\StockController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('dashboard', DashboardController::class);
    Route::get('search', SearchController::class);

    // Workers and administrators manage products and stock.
    Route::get('products', [ProductController::class, 'index']);
    Route::post('products', [ProductController::class, 'store']);
    Route::get('products/{product}', [ProductController::class, 'show']);
    Route::match(['put', 'patch'], 'products/{product}', [ProductController::class, 'update']);
    Route::delete('products/{product}', [ProductController::class, 'destroy'])->middleware('role:admin');

    Route::get('stock', [StockController::class, 'index']);
    Route::get('warehouses/{warehouse}/stock-summary', [StockController::class, 'warehouseSummary']);
    Route::post('stock/receive', [StockController::class, 'receive'])->name('stock.receive');
    Route::post('stock/{item}/issue', [StockController::class, 'issue'])->name('stock.issue');
    Route::post('stock/{item}/move', [StockController::class, 'move'])->name('stock.move');
    Route::match(['put', 'patch'], 'stock/{item}', [StockController::class, 'update'])->name('stock.update');

    Route::get('movements', [MovementController::class, 'index']);
});
