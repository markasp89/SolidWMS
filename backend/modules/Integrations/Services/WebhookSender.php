<?php

namespace Modules\Integrations\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Integrations\Models\Webhook;
use Modules\Integrations\Models\WebhookDelivery;
use Throwable;

/**
 * Sends signed JSON events:
 *   X-SolidWMS-Event: stock.movement
 *   X-SolidWMS-Signature: sha256=<hmac of the raw body with the webhook secret>
 */
class WebhookSender
{
    public function send(Webhook $webhook, string $event, array $data): WebhookDelivery
    {
        $body = json_encode([
            'id' => (string) Str::uuid(),
            'event' => $event,
            'occurred_at' => now()->toIso8601String(),
            'data' => $data,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $started = microtime(true);
        $status = null;
        $error = null;

        try {
            $response = Http::timeout(5)
                ->withHeaders([
                    'X-SolidWMS-Event' => $event,
                    'X-SolidWMS-Signature' => 'sha256='.hash_hmac('sha256', $body, $webhook->secret),
                    'User-Agent' => 'SolidWMS-Webhooks/1.0',
                ])
                ->withBody($body, 'application/json')
                ->post($webhook->url);
            $status = $response->status();
            if (! $response->successful()) {
                $error = Str::limit(trim($response->body()), 250) ?: 'HTTP '.$status;
            }
        } catch (Throwable $e) {
            $error = Str::limit($e->getMessage(), 250);
        }

        $delivery = $webhook->deliveries()->create([
            'event' => $event,
            'status_code' => $status,
            'error' => $error,
            'duration_ms' => (int) round((microtime(true) - $started) * 1000),
        ]);

        // Keep only the recent history.
        $keep = $webhook->deliveries()->limit(100)->pluck('id');
        $webhook->deliveries()->whereNotIn('id', $keep)->delete();

        return $delivery;
    }
}
