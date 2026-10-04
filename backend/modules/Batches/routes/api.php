<?php

use Illuminate\Support\Facades\Route;
use Modules\Batches\Http\Controllers\ExpiryController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('batches/expiring', ExpiryController::class);
});
