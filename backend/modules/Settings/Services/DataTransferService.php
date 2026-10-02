<?php

namespace Modules\Settings\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Models\StockMovement;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;
use Modules\Warehouses\Services\FloorPlanStorage;

/**
 * Exports / imports the warehouse layout and inventory as a portable JSON document.
 *
 * Records are matched by their business keys (warehouse code, sector code within
 * a warehouse, product SKU), never by database ids, so a file can be moved
 * between installations.
 */
class DataTransferService
{
    public const FORMAT = 'solidwms';

    public const VERSION = 1;

    public function __construct(private readonly FloorPlanStorage $floorPlans) {}

    public function export(bool $includeImages = true): array
    {
        $warehouses = Warehouse::query()->with('sectors')->orderBy('code')->get();

        return [
            'format' => self::FORMAT,
            'version' => self::VERSION,
            'exported_at' => now()->toIso8601String(),
            'warehouses' => $warehouses->map(fn (Warehouse $w) => [
                'code' => $w->code,
                'name' => $w->name,
                'address' => $w->address,
                'description' => $w->description,
                'floor_plan' => $includeImages ? $this->exportFloorPlan($w) : null,
                'sectors' => $w->sectors->map(fn (Sector $s) => [
                    'code' => $s->code,
                    'name' => $s->name,
                    'color' => $s->color,
                    'description' => $s->description,
                    'shape' => $s->shape,
                ])->values()->all(),
            ])->values()->all(),
            'products' => Product::query()->orderBy('sku')->get()->map(fn (Product $p) => [
                'sku' => $p->sku,
                'name' => $p->name,
                'barcode' => $p->barcode,
                'unit' => $p->unit,
                'description' => $p->description,
            ])->values()->all(),
            'stock' => StockItem::query()
                ->with(['product', 'sector.warehouse'])
                ->orderBy('id')
                ->get()
                ->map(fn (StockItem $i) => [
                    'sku' => $i->product->sku,
                    'warehouse_code' => $i->sector->warehouse->code,
                    'sector_code' => $i->sector->code,
                    'quantity' => $i->quantity,
                    'note' => $i->note,
                ])->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data  already validated payload
     * @param  'merge'|'replace'  $mode
     * @return array<string, array<string, int>>
     */
    public function import(array $data, string $mode): array
    {
        $images = $this->decodeFloorPlans($data['warehouses'] ?? []);
        $summary = [
            'warehouses' => ['created' => 0, 'updated' => 0],
            'sectors' => ['created' => 0, 'updated' => 0],
            'products' => ['created' => 0, 'updated' => 0],
            'stock' => ['created' => 0, 'updated' => 0],
            'floor_plans' => ['imported' => 0],
        ];
        $obsoleteFiles = [];

        DB::transaction(function () use ($data, $mode, &$summary, &$obsoleteFiles) {
            if ($mode === 'replace') {
                $obsoleteFiles = Warehouse::query()->whereNotNull('floor_plan_path')->pluck('floor_plan_path')->all();

                StockMovement::query()->delete();
                StockItem::query()->delete();
                Product::query()->delete();
                Sector::query()->delete();
                Warehouse::query()->delete();
            }

            /** @var array<string, array<string, int>> $sectorIds warehouse code => sector code => id */
            $sectorIds = [];

            foreach ($data['warehouses'] ?? [] as $row) {
                $warehouse = Warehouse::firstOrNew(['code' => strtoupper($row['code'])]);
                $summary['warehouses'][$warehouse->exists ? 'updated' : 'created']++;
                $warehouse->fill([
                    'name' => $row['name'],
                    'address' => $row['address'] ?? null,
                    'description' => $row['description'] ?? null,
                ])->save();

                foreach ($row['sectors'] ?? [] as $sectorRow) {
                    $sector = Sector::firstOrNew([
                        'warehouse_id' => $warehouse->id,
                        'code' => strtoupper($sectorRow['code']),
                    ]);
                    $summary['sectors'][$sector->exists ? 'updated' : 'created']++;
                    $sector->fill([
                        'name' => $sectorRow['name'],
                        'color' => $sectorRow['color'] ?? '#2563eb',
                        'description' => $sectorRow['description'] ?? null,
                        'shape' => $sectorRow['shape'] ?? null,
                    ])->save();
                }
            }

            foreach (Sector::query()->with('warehouse')->get() as $sector) {
                $sectorIds[$sector->warehouse->code][$sector->code] = $sector->id;
            }

            foreach ($data['products'] ?? [] as $row) {
                $product = Product::firstOrNew(['sku' => strtoupper($row['sku'])]);
                $summary['products'][$product->exists ? 'updated' : 'created']++;
                $product->fill([
                    'name' => $row['name'],
                    'barcode' => $row['barcode'] ?? null,
                    'unit' => $row['unit'] ?? 'szt',
                    'description' => $row['description'] ?? null,
                ])->save();
            }

            $productIds = Product::query()->pluck('id', 'sku')->all();
            $errors = [];

            foreach ($data['stock'] ?? [] as $index => $row) {
                $sku = strtoupper($row['sku']);
                $warehouseCode = strtoupper($row['warehouse_code']);
                $sectorCode = strtoupper($row['sector_code']);

                $productId = $productIds[$sku] ?? null;
                $sectorId = $sectorIds[$warehouseCode][$sectorCode] ?? null;

                if ($productId === null) {
                    $errors["data.stock.$index.sku"] = "Nieznany produkt {$sku}.";

                    continue;
                }
                if ($sectorId === null) {
                    $errors["data.stock.$index.sector_code"] = "Nieznany sektor {$warehouseCode}/{$sectorCode}.";

                    continue;
                }

                if ((float) $row['quantity'] <= 0) {
                    StockItem::where(['product_id' => $productId, 'sector_id' => $sectorId])->delete();

                    continue;
                }

                $item = StockItem::firstOrNew(['product_id' => $productId, 'sector_id' => $sectorId]);
                $summary['stock'][$item->exists ? 'updated' : 'created']++;
                $item->fill([
                    'quantity' => round((float) $row['quantity'], 3),
                    'note' => $row['note'] ?? null,
                ])->save();
            }

            if ($errors !== []) {
                throw ValidationException::withMessages($errors);
            }
        });

        foreach ($obsoleteFiles as $path) {
            $this->floorPlans->deletePath($path);
        }

        foreach ($images as $code => $contents) {
            $warehouse = Warehouse::where('code', $code)->first();
            if ($warehouse) {
                $this->floorPlans->storeContents($warehouse, $contents);
                $summary['floor_plans']['imported']++;
            }
        }

        return $summary;
    }

    private function exportFloorPlan(Warehouse $warehouse): ?array
    {
        $contents = $this->floorPlans->contents($warehouse);

        if ($contents === null) {
            return null;
        }

        return [
            'width' => $warehouse->floor_plan_width,
            'height' => $warehouse->floor_plan_height,
            'mime' => getimagesizefromstring($contents)['mime'] ?? null,
            'data' => base64_encode($contents),
        ];
    }

    /**
     * Decodes and verifies all images before anything is written.
     *
     * @return array<string, string> warehouse code => binary image
     */
    private function decodeFloorPlans(array $warehouses): array
    {
        $images = [];
        $errors = [];

        foreach ($warehouses as $index => $row) {
            $encoded = $row['floor_plan']['data'] ?? null;

            if (! $encoded) {
                continue;
            }

            // Accept both raw base64 and data URIs.
            if (str_starts_with($encoded, 'data:')) {
                $encoded = substr($encoded, (int) strpos($encoded, ',') + 1);
            }

            $binary = base64_decode($encoded, true);
            $info = $binary === false ? false : @getimagesizefromstring($binary);

            if ($info === false || ! isset(FloorPlanStorage::MIME_EXTENSIONS[$info['mime']])) {
                $errors["data.warehouses.$index.floor_plan"] = 'Nieprawidłowy obraz rzutu magazynu.';

                continue;
            }

            $images[strtoupper($row['code'])] = $binary;
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $images;
    }
}
