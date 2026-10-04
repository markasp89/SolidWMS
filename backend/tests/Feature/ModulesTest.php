<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_switches_optional_modules_and_routes_follow(): void
    {
        $admin = User::factory()->admin()->create();

        $modules = collect($this->actingAs($admin)->getJson('/api/modules')->assertOk()->json());
        $this->assertTrue($modules->firstWhere('key', 'pallets')['enabled']);
        $this->assertTrue($modules->firstWhere('key', 'inventory')['required']);

        $this->actingAs($admin)->getJson('/api/pallets')->assertOk();

        $this->actingAs($admin)->patchJson('/api/modules/pallets', ['enabled' => false])->assertOk();
        $this->actingAs($admin)->getJson('/api/pallets')->assertNotFound();

        $this->actingAs($admin)->patchJson('/api/modules/pallets', ['enabled' => true])->assertOk();
        $this->actingAs($admin)->getJson('/api/pallets')->assertOk();
    }

    public function test_required_modules_cannot_be_disabled_and_workers_cannot_toggle(): void
    {
        $this->actingAs(User::factory()->admin()->create())
            ->patchJson('/api/modules/inventory', ['enabled' => false])
            ->assertUnprocessable();

        $this->actingAs(User::factory()->create())
            ->patchJson('/api/modules/pallets', ['enabled' => false])
            ->assertForbidden();
    }

    public function test_dependencies_are_respected(): void
    {
        config()->set('modules.modules.labels.depends', ['scanning']);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->patchJson('/api/modules/scanning', ['enabled' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('module');

        $this->actingAs($admin)->patchJson('/api/modules/labels', ['enabled' => false])->assertOk();
        $this->actingAs($admin)->patchJson('/api/modules/scanning', ['enabled' => false])->assertOk();
        $this->actingAs($admin)->patchJson('/api/modules/labels', ['enabled' => true])->assertUnprocessable();
    }

    public function test_idempotency_key_prevents_double_execution(): void
    {
        $user = User::factory()->create();
        $payload = ['sku' => 'X-1', 'name' => 'Raz'];

        $this->actingAs($user)->postJson('/api/products', $payload, ['Idempotency-Key' => 'abc-123'])->assertCreated();
        $this->actingAs($user)->postJson('/api/products', $payload, ['Idempotency-Key' => 'abc-123'])
            ->assertCreated()
            ->assertHeader('Idempotent-Replay', 'true');

        $this->assertDatabaseCount('products', 1);
    }
}
