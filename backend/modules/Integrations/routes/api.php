<?php

use Illuminate\Support\Facades\Route;
use Modules\Integrations\Http\Controllers\IntegrationAdminController;
use Modules\Integrations\Http\Controllers\IntegrationApiController;
use Modules\Integrations\Http\Middleware\AuthenticateApiKey;

// External systems (API key).
Route::prefix('integration/v1')->middleware([AuthenticateApiKey::class, 'throttle:120,1'])->group(function () {
    Route::get('products', [IntegrationApiController::class, 'products']);
    Route::post('products', [IntegrationApiController::class, 'upsertProducts']);
    Route::get('stock', [IntegrationApiController::class, 'stock']);
    Route::get('movements', [IntegrationApiController::class, 'movements']);
});

// Administration.
Route::middleware(['auth:sanctum', 'role:admin'])->prefix('integrations')->group(function () {
    Route::get('events', [IntegrationAdminController::class, 'events']);
    Route::get('api-keys', [IntegrationAdminController::class, 'keys']);
    Route::post('api-keys', [IntegrationAdminController::class, 'createKey']);
    Route::delete('api-keys/{apiKey}', [IntegrationAdminController::class, 'revokeKey']);
    Route::get('webhooks', [IntegrationAdminController::class, 'webhooks']);
    Route::post('webhooks', [IntegrationAdminController::class, 'storeWebhook']);
    Route::put('webhooks/{webhook}', [IntegrationAdminController::class, 'updateWebhook']);
    Route::delete('webhooks/{webhook}', [IntegrationAdminController::class, 'destroyWebhook']);
    Route::post('webhooks/{webhook}/test', [IntegrationAdminController::class, 'testWebhook']);
    Route::get('webhooks/{webhook}/deliveries', [IntegrationAdminController::class, 'deliveries']);
    Route::get('webhooks/{webhook}/secret', [IntegrationAdminController::class, 'secret']);
});
