<?php

use Illuminate\Support\Facades\Route;
use Modules\Suggestions\Http\Controllers\SuggestionController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('products/{product}/suggested-locations', SuggestionController::class);
});
