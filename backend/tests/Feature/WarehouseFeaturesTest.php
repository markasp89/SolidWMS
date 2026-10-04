<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Services\StockService;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;
use Tests\TestCase;

/** Warehouse access, floors, slots, batches and suggestions. */
class WarehouseFeaturesTest extends TestCase
{
    use RefreshDatabase;

    public function test_worker_restricted_to_assigned_warehouses(): void
    {
        $admin = User::factory()->admin()->create();
        $worker = User::factory()->create();
        $mine = Warehouse::factory()->create();
        $other = Warehouse::factory()->create();
        $otherSector = Sector::factory()->for($other)->create();
        $product = Product::factory()->create();
        app(StockService::class)->receive($product, $otherSector, 5, null);

        $this->actingAs($admin)->putJson("/api/users/{$worker->id}/warehouses", ['warehouse_ids' => [$mine->id]])
            ->assertOk()->assertJsonPath('warehouse_ids', [$mine->id]);

        $this->actingAs($worker)->getJson('/api/warehouses')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $mine->id);
        $this->actingAs($worker)->getJson("/api/warehouses/{$other->id}")->assertForbidden();
        $this->actingAs($worker)->postJson('/api/stock/receive', [
            'product_id' => $product->id, 'sector_id' => $otherSector->id, 'quantity' => 1,
        ])->assertForbidden();
        $this->actingAs($worker)->getJson('/api/search?q='.$product->sku)->assertOk()->assertJsonCount(0, '0.locations');

        // Switching the module off lifts the restriction.
        $this->actingAs($admin)->patchJson('/api/modules/warehouse_access', ['enabled' => false])->assertOk();
        $this->actingAs($worker)->getJson('/api/warehouses')->assertJsonCount(2);
    }

    public function test_floors_have_their_own_plans_and_sectors(): void
    {
        Storage::fake('local');
        $admin = User::factory()->admin()->create();
        $warehouse = Warehouse::factory()->create();

        $floorId = $this->actingAs($admin)->postJson("/api/warehouses/{$warehouse->id}/floors", ['name' => 'Antresola'])
            ->assertCreated()->assertJsonPath('level', 1)->json('id');

        $url = $this->actingAs($admin)->post("/api/floors/{$floorId}/plan", [
            'floor_plan' => UploadedFile::fake()->image('p.png', 400, 300),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('floor_plan.width', 400)->json('floor_plan.url');
        $this->get($url)->assertOk();

        $this->actingAs($admin)->postJson("/api/warehouses/{$warehouse->id}/sectors", [
            'code' => 'M1', 'name' => 'Antresola 1', 'floor_id' => $floorId,
        ])->assertCreated()->assertJsonPath('floor_id', $floorId);

        $this->actingAs($admin)->deleteJson("/api/floors/{$floorId}")->assertUnprocessable();
    }

    public function test_slots_batches_fefo_and_suggestions(): void
    {
        $worker = User::factory()->create();
        $sector = Sector::factory()->create(['code' => 'A1']);
        $product = Product::factory()->create();

        $late = $this->actingAs($worker)->postJson('/api/stock/receive', [
            'product_id' => $product->id, 'sector_id' => $sector->id, 'quantity' => 5,
            'slot' => '03-2', 'batch' => 'L2', 'expires_at' => now()->addMonths(6)->toDateString(),
        ])->assertOk()->assertJsonPath('slot', '03-2')->json('id');

        $this->actingAs($worker)->postJson('/api/stock/receive', [
            'product_id' => $product->id, 'sector_id' => $sector->id, 'quantity' => 3,
            'slot' => '03-2', 'batch' => 'L1', 'expires_at' => now()->addDays(5)->toDateString(),
        ])->assertOk();

        // Same place, different batch = separate locations, FEFO order.
        $this->actingAs($worker)->getJson("/api/products/{$product->id}")
            ->assertJsonCount(2, 'locations')
            ->assertJsonPath('locations.0.batch', 'L1')
            ->assertJsonPath('total_quantity', 8);

        $this->actingAs($worker)->getJson('/api/batches/expiring?days=30')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.batch', 'L1');

        $this->actingAs($worker)->postJson("/api/stock/{$late}/move", ['to_sector_id' => $sector->id, 'to_slot' => '01-1', 'quantity' => 2])
            ->assertOk()->assertJsonPath('slot', '01-1')->assertJsonPath('batch', 'L2');

        $this->actingAs($worker)->getJson("/api/products/{$product->id}/suggested-locations")
            ->assertOk()->assertJsonPath('0.sector.code', 'A1')->assertJsonPath('0.reason', 'stored');
    }
}
