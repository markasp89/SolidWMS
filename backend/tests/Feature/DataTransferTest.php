<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DemoWarehouseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Warehouses\Models\Warehouse;
use Tests\TestCase;

class DataTransferTest extends TestCase
{
    use RefreshDatabase;

    public function test_export_and_replace_import_round_trip(): void
    {
        Storage::fake('local');
        $admin = User::factory()->admin()->create();
        $this->seed(DemoWarehouseSeeder::class);

        $export = $this->actingAs($admin)->get('/api/settings/export')
            ->assertOk()
            ->assertHeader('Content-Disposition')
            ->json();

        $this->assertSame('solidwms', $export['format']);
        $this->assertNotEmpty($export['warehouses'][0]['floor_plan']['data']);
        $stockCount = StockItem::count();

        // Change data, then restore from the export.
        Product::query()->first()->update(['name' => 'Zmieniona']);
        Warehouse::create(['code' => 'TMP', 'name' => 'Tymczasowy']);

        $this->actingAs($admin)->postJson('/api/settings/import', ['mode' => 'replace', 'data' => $export])
            ->assertOk()
            ->assertJsonPath('summary.warehouses.created', 1)
            ->assertJsonPath('summary.floor_plans.imported', 1);

        $this->assertDatabaseMissing('warehouses', ['code' => 'TMP']);
        $this->assertDatabaseMissing('products', ['name' => 'Zmieniona']);
        $this->assertSame($stockCount, StockItem::count());
        $this->assertNotNull(Warehouse::first()->floor_plan_path);
        $this->assertCount(1, Storage::disk('local')->allFiles('floor-plans'));
    }

    public function test_merge_import_upserts_by_business_keys(): void
    {
        $admin = User::factory()->admin()->create();
        Product::factory()->create(['sku' => 'P1', 'name' => 'Stara nazwa']);

        $data = [
            'format' => 'solidwms',
            'version' => 1,
            'warehouses' => [[
                'code' => 'm2', 'name' => 'Magazyn 2',
                'sectors' => [['code' => 's1', 'name' => 'Sektor 1', 'shape' => [[0, 0], [0.5, 0], [0.5, 0.5]]]],
            ]],
            'products' => [['sku' => 'P1', 'name' => 'Nowa nazwa'], ['sku' => 'P2', 'name' => 'Drugi']],
            'stock' => [['sku' => 'p2', 'warehouse_code' => 'M2', 'sector_code' => 'S1', 'quantity' => 3]],
        ];

        $this->actingAs($admin)->postJson('/api/settings/import', ['mode' => 'merge', 'data' => $data])
            ->assertOk()
            ->assertJsonPath('summary.products.updated', 1)
            ->assertJsonPath('summary.products.created', 1)
            ->assertJsonPath('summary.stock.created', 1);

        $this->assertDatabaseHas('products', ['sku' => 'P1', 'name' => 'Nowa nazwa']);
        $this->assertDatabaseHas('sectors', ['code' => 'S1']);
    }

    public function test_invalid_import_changes_nothing(): void
    {
        $admin = User::factory()->admin()->create();

        $data = [
            'version' => 1,
            'warehouses' => [['code' => 'M1', 'name' => 'M1', 'sectors' => []]],
            'products' => [['sku' => 'P1', 'name' => 'P']],
            'stock' => [['sku' => 'P1', 'warehouse_code' => 'M1', 'sector_code' => 'NOPE', 'quantity' => 1]],
        ];

        $this->actingAs($admin)->postJson('/api/settings/import', ['mode' => 'merge', 'data' => $data])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('data.stock.0.sector_code');

        $this->assertDatabaseCount('warehouses', 0);
        $this->assertDatabaseCount('products', 0);

        $this->actingAs($admin)->postJson('/api/settings/import', ['mode' => 'merge', 'data' => ['version' => 99]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('data.version');
    }

    public function test_worker_cannot_export(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/settings/export')->assertForbidden();
    }
}
