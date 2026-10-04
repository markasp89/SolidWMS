<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Services\StockService;
use Modules\Warehouses\Models\Sector;
use Tests\TestCase;

class IntegrationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_keys_give_access_to_the_integration_api(): void
    {
        $admin = User::factory()->admin()->create();
        $readKey = $this->actingAs($admin)->postJson('/api/integrations/api-keys', ['name' => 'Sklep', 'abilities' => ['read']])
            ->assertCreated()->json('key');
        $writeKey = $this->actingAs($admin)->postJson('/api/integrations/api-keys', ['name' => 'ERP', 'abilities' => ['read', 'write']])
            ->json('key');
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/integration/v1/products')->assertUnauthorized();
        $this->postJson('/api/integration/v1/products', ['products' => [['sku' => 'a', 'name' => 'A']]], ['X-Api-Key' => $readKey])
            ->assertForbidden();
        $this->postJson('/api/integration/v1/products', ['products' => [['sku' => 'a', 'name' => 'A', 'min_quantity' => 2]]], ['X-Api-Key' => $writeKey])
            ->assertOk()->assertJsonPath('created', 1);
        $this->getJson('/api/integration/v1/products?sku=A', ['X-Api-Key' => $readKey])
            ->assertOk()->assertJsonPath('data.0.min_quantity', 2);

        $id = $this->actingAs($admin)->getJson('/api/integrations/api-keys')->json('0.id');
        $this->actingAs($admin)->deleteJson("/api/integrations/api-keys/{$id}")->assertNoContent();
    }

    public function test_webhooks_receive_signed_events(): void
    {
        Http::fake(['hooks.example.com/*' => Http::response('ok')]);
        $this->withoutDefer();
        $admin = User::factory()->admin()->create();

        $hook = $this->actingAs($admin)->postJson('/api/integrations/webhooks', [
            'name' => 'ERP', 'url' => 'https://hooks.example.com/wms', 'events' => ['stock.movement'],
        ])->assertCreated()->json();

        app(StockService::class)->receive(Product::factory()->create(), Sector::factory()->create(), 3, null);

        Http::assertSent(function ($request) use ($hook) {
            $signature = 'sha256='.hash_hmac('sha256', $request->body(), $hook['secret']);

            return $request->header('X-SolidWMS-Event')[0] === 'stock.movement'
                && $request->header('X-SolidWMS-Signature')[0] === $signature
                && $request['data']['quantity'] == 3;
        });

        $this->actingAs($admin)->getJson("/api/integrations/webhooks/{$hook['id']}/deliveries")
            ->assertOk()->assertJsonPath('0.status_code', 200);

        // Disabled module: no more deliveries.
        $this->actingAs($admin)->patchJson('/api/modules/integrations', ['enabled' => false]);
        app(StockService::class)->receive(Product::factory()->create(), Sector::factory()->create(), 1, null);
        Http::assertSentCount(1);
    }
}
