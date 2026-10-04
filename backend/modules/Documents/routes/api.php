<?php

use Illuminate\Support\Facades\Route;
use Modules\Documents\Http\Controllers\DocumentController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('documents', [DocumentController::class, 'index']);
    Route::post('documents', [DocumentController::class, 'store']);
    Route::get('documents/{document}', [DocumentController::class, 'show']);
    Route::put('documents/{document}', [DocumentController::class, 'update']);
    Route::delete('documents/{document}', [DocumentController::class, 'destroy']);
    Route::post('documents/{document}/post', [DocumentController::class, 'post']);
    Route::get('documents/{document}/pdf', [DocumentController::class, 'pdf']);
});
