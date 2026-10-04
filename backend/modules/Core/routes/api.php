<?php

use Illuminate\Support\Facades\Route;
use Modules\Core\Http\Controllers\ModuleController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('modules', [ModuleController::class, 'index']);
    Route::patch('modules/{key}', [ModuleController::class, 'update'])->middleware('role:admin');
});
