<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;
use Tests\TestCase;

class InventoryTest extends TestCase
{
    use RefreshDatabase;

    private User $worker;

    private Sector $a1;

    private Sector $b1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->worker = User::factory()->create();
        $warehouse = Warehouse::factory()->create(['code' => 'MAG1']);
        $this->a1 = Sector::factory()->for($warehouse)->create(['code' => 'A1']);
        $this->b1 = Sector::factory()->for($warehouse)->create(['code' => 'B1']);
    }

    public function test_worker_creates_product_with_initial_location_and_finds_it(): void
    {
        $this->actingAs($this->worker)->postJson('/api/products', [
            'sku' => 'pal-1',
            'name' => 'Paleta z kartonami',
            'initial_stock' => ['sector_id' => $this->a1->id, 'quantity' => 5],
        ])->assertCreated()
            ->assertJsonPath('sku', 'PAL-1')
            ->assertJsonPath('total_quantity', 5)
            ->assertJsonPath('locations.0.sector.code', 'A1')
            ->assertJsonPath('locations.0.sector.warehouse.code', 'MAG1');

        $this->actingAs($this->worker)->getJson('/api/search?q=kartonami')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.locations.0.sector.code', 'A1')
            ->assertJsonPath('0.locations.0.updated_by.id', $this->worker->id);
    }

    public function test_receive_issue_move_and_adjust_keep_history(): void
    {
        $product = Product::factory()->create();
        $this->actingAs($this->worker);

        $itemId = $this->postJson('/api/stock/receive', [
            'product_id' => $product->id, 'sector_id' => $this->a1->id, 'quantity' => 10,
        ])->assertOk()->json('id');

        // Receiving again into the same sector adds to the same location.
        $this->postJson('/api/stock/receive', [
            'product_id' => $product->id, 'sector_id' => $this->a1->id, 'quantity' => 2.5,
        ])->assertOk()->assertJsonPath('quantity', 12.5);

        $this->postJson("/api/stock/{$itemId}/issue", ['quantity' => 20])
            ->assertUnprocessable()->assertJsonValidationErrors('quantity');

        $this->postJson("/api/stock/{$itemId}/issue", ['quantity' => 2.5])->assertOk()->assertJsonPath('quantity', 10);

        $this->postJson("/api/stock/{$itemId}/move", ['to_sector_id' => $this->a1->id, 'quantity' => 1])
            ->assertUnprocessable();

        $this->postJson("/api/stock/{$itemId}/move", ['to_sector_id' => $this->b1->id, 'quantity' => 4])
            ->assertOk()->assertJsonPath('sector.code', 'B1')->assertJsonPath('quantity', 4);

        $this->patchJson("/api/stock/{$itemId}", ['quantity' => 7, 'note' => 'Inwentaryzacja'])
            ->assertOk()->assertJsonPath('quantity', 7)->assertJsonPath('note', 'Inwentaryzacja');

        // Moving everything empties the source location.
        $this->postJson("/api/stock/{$itemId}/move", ['to_sector_id' => $this->b1->id, 'quantity' => 7])->assertOk();
        $this->assertDatabaseMissing('stock_items', ['id' => $itemId]);
        $this->assertSame(11.0, StockItem::where('sector_id', $this->b1->id)->value('quantity'));

        $this->getJson("/api/movements?product_id={$product->id}")
            ->assertOk()
            ->assertJsonCount(6, 'data')
            ->assertJsonPath('data.0.type', 'move')
            ->assertJsonPath('data.0.from_sector.code', 'A1')
            ->assertJsonPath('data.0.to_sector.code', 'B1')
            ->assertJsonPath('data.0.user.id', $this->worker->id);

        $this->getJson("/api/warehouses/{$this->a1->warehouse_id}/stock-summary")
            ->assertOk()
            ->assertExactJson([['sector_id' => $this->b1->id, 'products_count' => 1, 'total_quantity' => 11]]);
    }

    public function test_sector_with_stock_cannot_be_deleted(): void
    {
        $admin = User::factory()->admin()->create();
        StockItem::create(['product_id' => Product::factory()->create()->id, 'sector_id' => $this->a1->id, 'quantity' => 1]);

        $this->actingAs($admin)->deleteJson("/api/sectors/{$this->a1->id}")
            ->assertUnprocessable()->assertJsonValidationErrors('sector');
        $this->actingAs($admin)->deleteJson("/api/warehouses/{$this->a1->warehouse_id}")
            ->assertUnprocessable();
        $this->actingAs($admin)->deleteJson("/api/sectors/{$this->b1->id}")->assertNoContent();
    }

    public function test_only_admin_deletes_products(): void
    {
        $product = Product::factory()->create();

        $this->actingAs($this->worker)->deleteJson("/api/products/{$product->id}")->assertForbidden();
        $this->actingAs($this->worker)->patchJson("/api/products/{$product->id}", ['name' => 'Nowa nazwa'])
            ->assertOk()->assertJsonPath('name', 'Nowa nazwa');
        $this->actingAs(User::factory()->admin()->create())->deleteJson("/api/products/{$product->id}")->assertNoContent();
    }

    public function test_product_list_is_searchable_and_paginated(): void
    {
        Product::factory()->create(['name' => 'Śruba M8', 'sku' => 'S-1']);
        Product::factory()->create(['name' => 'Nakrętka', 'sku' => 'N-1']);

        $this->actingAs($this->worker)->getJson('/api/products?q=m8')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.sku', 'S-1')
            ->assertJsonPath('meta.total', 1);
    }
}
