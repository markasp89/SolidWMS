<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;
use Tests\TestCase;

class PalletsTest extends TestCase
{
    use RefreshDatabase;

    public function test_pallet_is_loaded_and_moved_in_one_step(): void
    {
        $worker = User::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $a = Sector::factory()->for($warehouse)->create(['code' => 'ROZ']);
        $b = Sector::factory()->for($warehouse)->create(['code' => 'B2']);
        [$p1, $p2] = Product::factory()->count(2)->create();

        $pallet = $this->actingAs($worker)->postJson('/api/pallets', ['sector_id' => $a->id])
            ->assertCreated()->assertJsonPath('code', 'P-00001')->json();

        $this->actingAs($worker)->postJson("/api/pallets/{$pallet['id']}/items", ['product_id' => $p1->id, 'quantity' => 10])->assertOk();
        $this->actingAs($worker)->postJson("/api/pallets/{$pallet['id']}/items", ['product_id' => $p2->id, 'quantity' => 4])->assertOk();

        $this->actingAs($worker)->postJson("/api/pallets/{$pallet['id']}/move", ['to_sector_id' => $b->id, 'to_slot' => '02'])
            ->assertOk()
            ->assertJsonPath('sector.code', 'B2')
            ->assertJsonPath('slot', '02')
            ->assertJsonPath('moved_by.id', $worker->id)
            ->assertJsonCount(2, 'items');

        $this->assertSame(0, StockItem::where('sector_id', $a->id)->count());
        $this->assertSame(2, StockItem::where('sector_id', $b->id)->where('pallet_id', $pallet['id'])->count());

        $this->actingAs($worker)->getJson('/api/pallets/code/p-00001')->assertOk()->assertJsonPath('id', $pallet['id']);
        $this->actingAs($worker)->getJson("/api/movements?pallet_id={$pallet['id']}")
            ->assertOk()->assertJsonCount(4, 'data')->assertJsonPath('data.0.reference', 'P-00001');
        $this->actingAs($worker)->getJson('/api/pallets?q='.$p2->name)->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($worker)->deleteJson("/api/pallets/{$pallet['id']}")->assertUnprocessable();
    }
}
