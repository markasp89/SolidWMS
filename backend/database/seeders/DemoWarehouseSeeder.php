<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Services\StockService;
use Modules\Pallets\Models\Pallet;
use Modules\Warehouses\Models\Warehouse;
use Modules\Warehouses\Services\FloorPlanStorage;

/**
 * Example warehouse with a floor plan, sectors and some stock.
 */
class DemoWarehouseSeeder extends Seeder
{
    public function run(FloorPlanStorage $floorPlans, StockService $stock): void
    {
        if (Warehouse::where('code', 'MAG1')->exists()) {
            return;
        }

        $warehouse = Warehouse::create([
            'code' => 'MAG1',
            'name' => 'Magazyn główny',
            'address' => 'ul. Przykładowa 1, Poznań',
            'description' => 'Magazyn demonstracyjny.',
        ]);

        $floorPlans->storeContents($warehouse, file_get_contents(__DIR__.'/assets/demo-floor-plan.png'));

        // Pixel rectangles on the 1600x1000 demo image.
        $px = fn (int $x1, int $y1, int $x2, int $y2) => [
            [$x1 / 1600, $y1 / 1000], [$x2 / 1600, $y1 / 1000],
            [$x2 / 1600, $y2 / 1000], [$x1 / 1600, $y2 / 1000],
        ];

        $sectors = [];
        $colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c'];
        foreach (['A', 'B', 'C', 'D'] as $i => $row) {
            $y = 90 + $i * 150;
            $sectors[$row.'1'] = $warehouse->sectors()->create([
                'code' => $row.'1', 'name' => "Regał {$row} - lewa strona", 'color' => $colors[$i],
                'shape' => $px(80, $y, 540, $y + 70),
            ]);
            $sectors[$row.'2'] = $warehouse->sectors()->create([
                'code' => $row.'2', 'name' => "Regał {$row} - prawa strona", 'color' => $colors[$i],
                'shape' => $px(540, $y, 1000, $y + 70),
            ]);
        }
        $sectors['BLOK'] = $warehouse->sectors()->create([
            'code' => 'BLOK', 'name' => 'Składowanie blokowe', 'color' => '#ca8a04',
            'shape' => $px(1150, 80, 1540, 560),
        ]);
        $sectors['ROZ'] = $warehouse->sectors()->create([
            'code' => 'ROZ', 'name' => 'Strefa rozładunku', 'color' => '#16a34a',
            'shape' => $px(560, 720, 1250, 940),
        ]);

        $worker = User::where('role', 'worker')->first();

        // [sku, name, unit, min quantity, [[sector, qty, slot, batch, expires in days]]]
        $products = [
            ['PAL-EUR', 'Paleta EUR 1200x800', 'szt', 20, [['ROZ', 24], ['BLOK', 60]]],
            ['KART-40', 'Karton 400x300x300', 'szt', 100, [['A1', 350, '01-1']]],
            ['FOL-STR', 'Folia stretch 23µm', 'rol', 10, [['A2', 48, '02-3']]],
            ['TAS-48', 'Taśma pakowa 48mm', 'szt', 50, [['B1', 220, '01-2']]],
            ['SRB-M8', 'Śruba M8x40 (opak. 100)', 'opak', null, [['C1', 35, '03-1'], ['C2', 12, '01-1']]],
            ['RKW-L', 'Rękawice robocze L', 'para', 30, [['D1', 80]]],
            ['CEM-25', 'Cement 25kg', 'worek', null, [['BLOK', 40, null, 'C-2405', 20], ['BLOK', 80, null, 'C-2409', 150]]],
        ];

        $created = [];
        foreach ($products as [$sku, $name, $unit, $min, $locations]) {
            $product = Product::create(['sku' => $sku, 'name' => $name, 'unit' => $unit]);
            $product->forceFill(['min_quantity' => $min])->save();
            $created[$sku] = $product;
            foreach ($locations as $location) {
                [$code, $qty] = $location;
                $stock->receive($product, $sectors[$code], $qty, $worker, 'Stan początkowy', [
                    'slot' => $location[2] ?? null,
                    'batch' => $location[3] ?? null,
                    'expires_at' => isset($location[4]) ? now()->addDays($location[4])->toDateString() : null,
                ]);
            }
        }

        // A mixed pallet waiting in the unloading zone.
        $pallet = Pallet::create(['code' => 'P-00001', 'sector_id' => $sectors['ROZ']->id, 'note' => 'Dostawa od Pakmar', 'created_by' => $worker?->id]);
        foreach ([['TAS-48', 36], ['FOL-STR', 12]] as [$sku, $qty]) {
            $stock->receive($created[$sku], $sectors['ROZ'], $qty, $worker, null, ['pallet_id' => $pallet->id], $pallet->code);
        }
    }
}
