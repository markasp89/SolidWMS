<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;
use Tests\TestCase;

/** Documents, picking and reports. */
class ProcessesTest extends TestCase
{
    use RefreshDatabase;

    public function test_pz_and_wz_documents_with_fefo_and_pdf(): void
    {
        $worker = User::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $a = Sector::factory()->for($warehouse)->create(['code' => 'A1']);
        $b = Sector::factory()->for($warehouse)->create(['code' => 'B1']);
        $product = Product::factory()->create();

        $pz = $this->actingAs($worker)->postJson('/api/documents', [
            'type' => 'PZ', 'warehouse_id' => $warehouse->id, 'counterparty' => 'Dostawca sp. z o.o.',
            'lines' => [
                ['product_id' => $product->id, 'quantity' => 5, 'sector_id' => $a->id, 'batch' => 'OLD', 'expires_at' => now()->addDays(10)->toDateString()],
                ['product_id' => $product->id, 'quantity' => 7, 'sector_id' => $b->id, 'batch' => 'NEW', 'expires_at' => now()->addDays(90)->toDateString()],
            ],
        ])->assertCreated()->assertJsonPath('status', 'draft')->json();

        $this->assertMatchesRegularExpression('#^PZ/\d{4}/\d{2}/0001$#', $pz['number']);
        $this->actingAs($worker)->postJson("/api/documents/{$pz['id']}/post")->assertOk()->assertJsonPath('status', 'posted');
        $this->actingAs($worker)->putJson("/api/documents/{$pz['id']}", ['warehouse_id' => $warehouse->id, 'lines' => [['product_id' => $product->id, 'quantity' => 1]]])
            ->assertUnprocessable();
        $this->assertEquals(12, StockItem::where('product_id', $product->id)->sum('quantity'));

        $wz = $this->actingAs($worker)->postJson('/api/documents', [
            'type' => 'WZ', 'warehouse_id' => $warehouse->id,
            'lines' => [['product_id' => $product->id, 'quantity' => 6]],
        ])->assertCreated()->json();

        $posted = $this->actingAs($worker)->postJson("/api/documents/{$wz['id']}/post")->assertOk()->json();
        // FEFO: the 5 expiring first came from A1, the rest from B1.
        $this->assertCount(2, $posted['lines'][0]['posted_locations']);
        $this->assertEquals(6, StockItem::where('product_id', $product->id)->sum('quantity'));
        $this->assertSame(0, StockItem::where('sector_id', $a->id)->count());

        $tooMuch = $this->actingAs($worker)->postJson('/api/documents', [
            'type' => 'WZ', 'warehouse_id' => $warehouse->id, 'lines' => [['product_id' => $product->id, 'quantity' => 100]],
        ])->json('id');
        $this->actingAs($worker)->postJson("/api/documents/{$tooMuch}/post")->assertUnprocessable();
        $this->assertEquals(6, StockItem::where('product_id', $product->id)->sum('quantity'));

        $this->actingAs($worker)->get("/api/documents/{$wz['id']}/pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_pick_list_is_sorted_by_sector_and_picking_issues_stock(): void
    {
        $worker = User::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $s10 = Sector::factory()->for($warehouse)->create(['code' => 'A10']);
        $s2 = Sector::factory()->for($warehouse)->create(['code' => 'A2']);
        [$x, $y] = Product::factory()->count(2)->create();
        $stock = app(StockService::class);
        $stock->receive($x, $s10, 5, null);
        $stock->receive($y, $s2, 1, null);

        $list = $this->actingAs($worker)->postJson('/api/picking', [
            'warehouse_id' => $warehouse->id,
            'items' => [['product_id' => $x->id, 'quantity' => 3], ['product_id' => $y->id, 'quantity' => 2]],
        ])->assertCreated()->json();

        $this->assertSame(['A2', 'A10', null], array_map(fn ($l) => $l['sector']['code'] ?? null, $list['lines']));
        $this->assertSame('short', $list['lines'][2]['status']);

        foreach (array_slice($list['lines'], 0, 2) as $line) {
            $this->actingAs($worker)->postJson("/api/picking/{$list['id']}/lines/{$line['id']}/pick")->assertOk();
        }

        $this->actingAs($worker)->getJson("/api/picking/{$list['id']}")->assertJsonPath('status', 'completed');
        $this->assertEquals(2, StockItem::where('product_id', $x->id)->value('quantity'));
    }

    public function test_reports_for_managers(): void
    {
        $manager = User::factory()->create(['role' => 'manager']);
        $sector = Sector::factory()->create();
        Sector::factory()->for($sector->warehouse)->create();
        $product = Product::factory()->create();
        $item = app(StockService::class)->receive($product, $sector, 10, $manager);
        app(StockService::class)->issue($item, 4, $manager);

        $this->actingAs($manager)->getJson('/api/reports/occupancy')->assertOk()->assertJsonCount(2);
        $this->actingAs($manager)->getJson('/api/reports/rotation')->assertOk()
            ->assertJsonPath('rows.0.issued', 4)->assertJsonPath('rows.0.stock', 6);
        $this->actingAs($manager)->getJson('/api/reports/activity')->assertOk()
            ->assertJsonPath('rows.0.user_id', $manager->id)->assertJsonPath('rows.0.operations', 2);
        $this->actingAs(User::factory()->create())->getJson('/api/reports/activity')->assertForbidden();
    }
}
