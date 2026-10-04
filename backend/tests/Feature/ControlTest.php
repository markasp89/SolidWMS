<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Warehouses\Models\Sector;
use Tests\TestCase;

/** Stocktaking, alerts and photos. */
class ControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_stocktake_counts_sector_and_applies_one_correction(): void
    {
        $worker = User::factory()->create();
        $manager = User::factory()->create(['role' => 'manager']);
        $sector = Sector::factory()->create();
        [$counted, $missing, $found] = Product::factory()->count(3)->create();
        $service = app(StockService::class);
        $service->receive($counted, $sector, 10, null);
        $service->receive($missing, $sector, 3, null);

        $take = $this->actingAs($worker)->postJson('/api/stocktakes', ['sector_id' => $sector->id])
            ->assertCreated()->assertJsonCount(2, 'lines')->json();

        $this->actingAs($worker)->postJson('/api/stocktakes', ['sector_id' => $sector->id])->assertUnprocessable();

        $lines = collect($take['lines'])->keyBy('product.id');
        $this->actingAs($worker)->putJson("/api/stocktakes/{$take['id']}/lines/{$lines[$counted->id]['id']}", ['counted' => 8])
            ->assertOk()->assertJsonPath('lines.0.difference', fn ($v) => true);
        $this->actingAs($worker)->putJson("/api/stocktakes/{$take['id']}/lines/{$lines[$missing->id]['id']}", ['counted' => 0])->assertOk();
        $this->actingAs($worker)->postJson("/api/stocktakes/{$take['id']}/lines", ['product_id' => $found->id, 'counted' => 2])->assertCreated();

        $this->actingAs($worker)->postJson("/api/stocktakes/{$take['id']}/complete")->assertForbidden();
        $this->actingAs($manager)->postJson("/api/stocktakes/{$take['id']}/complete")
            ->assertOk()->assertJsonPath('status', 'completed')->assertJsonPath('result.changed', 3);

        $this->assertEquals(8, StockItem::where('product_id', $counted->id)->value('quantity'));
        $this->assertNull(StockItem::where('product_id', $missing->id)->first());
        $this->assertEquals(2, StockItem::where('product_id', $found->id)->value('quantity'));
        $this->assertDatabaseHas('stock_movements', ['reference' => 'INW/'.str_pad((string) $take['id'], 5, '0', STR_PAD_LEFT)]);
    }

    public function test_low_stock_alert_is_sent_when_crossing_the_minimum(): void
    {
        $admin = User::factory()->admin()->create();
        $worker = User::factory()->create();
        $sector = Sector::factory()->create();
        $product = Product::factory()->create();
        $item = app(StockService::class)->receive($product, $sector, 10, null);

        $this->actingAs($admin)->putJson("/api/products/{$product->id}/min-quantity", ['min_quantity' => 5])->assertOk();
        $this->actingAs($worker)->putJson("/api/products/{$product->id}/min-quantity", ['min_quantity' => 1])->assertForbidden();

        $this->actingAs($worker)->postJson("/api/stock/{$item->id}/issue", ['quantity' => 6])->assertOk();
        $this->actingAs($worker)->postJson("/api/stock/{$item->id}/issue", ['quantity' => 1])->assertOk();

        $this->actingAs($admin)->getJson('/api/notifications')
            ->assertOk()->assertJsonPath('unread', 1)->assertJsonPath('items.0.data.product_id', $product->id);
        $this->actingAs($admin)->getJson('/api/alerts/low-stock')->assertJsonCount(1)->assertJsonPath('0.total_quantity', 3);
        $this->actingAs($admin)->postJson('/api/notifications/read')->assertJsonPath('unread', 0);
        $this->assertSame(0, $worker->notifications()->count());
    }

    public function test_photos_of_products_and_locations(): void
    {
        Storage::fake('local');
        $worker = User::factory()->create();
        $product = Product::factory()->create();

        $photo = $this->actingAs($worker)->post('/api/photos', [
            'subject_type' => 'product', 'subject_id' => $product->id,
            'photo' => UploadedFile::fake()->image('a.jpg', 3000, 2000),
        ], ['Accept' => 'application/json'])->assertCreated()->json();

        if (function_exists('imagecreatefromstring')) {
            $this->assertSame(1600, $photo['width']);
        }
        $this->get($photo['url'])->assertOk();

        $this->actingAs($worker)->getJson("/api/photos?subject_type=product&subject_id={$product->id}")->assertJsonCount(1);
        $this->actingAs($worker)->post('/api/photos', [
            'subject_type' => 'stock_item', 'subject_id' => 999,
            'photo' => UploadedFile::fake()->image('b.jpg'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();

        $this->actingAs(User::factory()->create())->deleteJson("/api/photos/{$photo['id']}")->assertForbidden();
        $this->actingAs($worker)->deleteJson("/api/photos/{$photo['id']}")->assertNoContent();
        $this->assertCount(0, Storage::disk('local')->allFiles('photos'));
    }
}
