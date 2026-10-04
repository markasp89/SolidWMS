<?php

use Illuminate\Support\Facades\Route;
use Modules\Photos\Http\Controllers\PhotoController;

Route::get('photos/{photo}/file', [PhotoController::class, 'file'])->middleware('signed:relative')->name('photos.file');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('photos', [PhotoController::class, 'index']);
    Route::post('photos', [PhotoController::class, 'store']);
    Route::delete('photos/{photo}', [PhotoController::class, 'destroy']);
});
