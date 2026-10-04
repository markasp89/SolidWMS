<?php

namespace Modules\Integrations\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Modules\Integrations\Models\ApiKey;
use Modules\Integrations\Models\Webhook;
use Modules\Integrations\Services\WebhookSender;

class IntegrationAdminController extends Controller
{
    public function events(): JsonResponse
    {
        return response()->json(collect(Webhook::EVENTS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values());
    }

    public function keys(): JsonResponse
    {
        return response()->json(ApiKey::whereNull('revoked_at')->latest()->get()->map(fn (ApiKey $k) => [
            'id' => $k->id,
            'name' => $k->name,
            'prefix' => $k->prefix,
            'abilities' => $k->abilities,
            'last_used_at' => $k->last_used_at?->toIso8601String(),
            'created_at' => $k->created_at?->toIso8601String(),
        ]));
    }

    public function createKey(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'abilities' => ['required', 'array', 'min:1'],
            'abilities.*' => [Rule::in(['read', 'write'])],
        ]);

        [$key, $plain] = ApiKey::generate($data['name'], array_unique($data['abilities']), $request->user()->id);

        return response()->json(['id' => $key->id, 'name' => $key->name, 'key' => $plain], 201);
    }

    public function revokeKey(ApiKey $apiKey): Response
    {
        $apiKey->forceFill(['revoked_at' => now()])->save();

        return response()->noContent();
    }

    public function webhooks(): JsonResponse
    {
        return response()->json(Webhook::with(['deliveries' => fn ($q) => $q->limit(1)])->latest()->get()->map(fn (Webhook $w) => $this->presentWebhook($w)));
    }

    public function storeWebhook(Request $request): JsonResponse
    {
        $webhook = Webhook::create($this->validatedWebhook($request) + ['secret' => Str::random(40)]);

        return response()->json($this->presentWebhook($webhook, withSecret: true), 201);
    }

    public function updateWebhook(Request $request, Webhook $webhook): JsonResponse
    {
        $webhook->update($this->validatedWebhook($request));

        return response()->json($this->presentWebhook($webhook));
    }

    public function destroyWebhook(Webhook $webhook): Response
    {
        $webhook->delete();

        return response()->noContent();
    }

    public function testWebhook(Webhook $webhook, WebhookSender $sender): JsonResponse
    {
        $delivery = $sender->send($webhook, 'ping', ['message' => 'Test połączenia z SolidWMS']);

        return response()->json($delivery);
    }

    public function deliveries(Webhook $webhook): JsonResponse
    {
        return response()->json($webhook->deliveries()->limit(50)->get());
    }

    public function secret(Webhook $webhook): JsonResponse
    {
        return response()->json(['secret' => $webhook->secret]);
    }

    private function validatedWebhook(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'url' => ['required', 'url:http,https', 'max:2048'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => [Rule::in([...array_keys(Webhook::EVENTS), '*'])],
            'active' => ['sometimes', 'boolean'],
        ], ['events.required' => 'Wybierz co najmniej jedno zdarzenie.']);
    }

    private function presentWebhook(Webhook $w, bool $withSecret = false): array
    {
        $last = $w->relationLoaded('deliveries') ? $w->deliveries->first() : null;

        return [
            'id' => $w->id,
            'name' => $w->name,
            'url' => $w->url,
            'events' => $w->events,
            'active' => $w->active,
            'secret' => $withSecret ? $w->secret : null,
            'last_delivery' => $last,
            'created_at' => $w->created_at?->toIso8601String(),
        ];
    }
}
