<?php

use Illuminate\Support\Facades\Route;
use Modules\Settings\Http\Controllers\DataTransferController;

Route::middleware(['auth:sanctum', 'role:admin'])->prefix('settings')->group(function () {
    Route::get('export', [DataTransferController::class, 'export']);
    Route::post('import', [DataTransferController::class, 'import']);
});
