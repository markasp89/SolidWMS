<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;
use Tests\TestCase;

class WarehouseTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_creates_warehouse_with_floor_plan_and_sectors(): void
    {
        Storage::fake('local');
        $admin = User::factory()->admin()->create();

        $id = $this->actingAs($admin)->postJson('/api/warehouses', ['code' => 'mag-1', 'name' => 'Magazyn 1'])
            ->assertCreated()
            ->assertJsonPath('code', 'MAG-1')
            ->json('id');

        $response = $this->actingAs($admin)->post("/api/warehouses/{$id}/floor-plan", [
            'floor_plan' => UploadedFile::fake()->image('plan.png', 800, 500),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('floor_plan.width', 800)
            ->assertJsonPath('floor_plan.height', 500);

        // The signed URL works without a token, a tampered one does not.
        $url = $response->json('floor_plan.url');
        $this->app['auth']->forgetGuards();
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->get($url.'x')->assertForbidden();

        $this->actingAs($admin)->postJson("/api/warehouses/{$id}/sectors", [
            'code' => 'a1',
            'name' => 'Regał A',
            'color' => '#ff0000',
            'shape' => [[0.1, 0.1], [0.3, 0.1], [0.3, 0.2], [0.1, 0.2]],
        ])->assertCreated()->assertJsonPath('code', 'A1');

        $this->actingAs($admin)->postJson("/api/warehouses/{$id}/sectors", ['code' => 'A1', 'name' => 'Dup'])
            ->assertUnprocessable()->assertJsonValidationErrors('code');

        $this->actingAs($admin)->postJson("/api/warehouses/{$id}/sectors", [
            'code' => 'X', 'name' => 'Poza planem', 'shape' => [[0, 0], [2, 0], [1, 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('shape.1.0');

        $this->actingAs($admin)->getJson("/api/warehouses/{$id}")->assertOk()->assertJsonCount(1, 'sectors');
    }

    public function test_worker_can_read_but_not_change_layout(): void
    {
        $worker = User::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $sector = Sector::factory()->for($warehouse)->create();

        $this->actingAs($worker)->getJson('/api/warehouses')->assertOk()->assertJsonCount(1);
        $this->actingAs($worker)->getJson("/api/warehouses/{$warehouse->id}")->assertOk();
        $this->actingAs($worker)->postJson('/api/warehouses', ['code' => 'X', 'name' => 'X'])->assertForbidden();
        $this->actingAs($worker)->patchJson("/api/sectors/{$sector->id}", ['name' => 'X'])->assertForbidden();
        $this->actingAs($worker)->deleteJson("/api/sectors/{$sector->id}")->assertForbidden();
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/warehouses')->assertUnauthorized();
    }
}
