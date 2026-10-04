<?php

namespace Modules\Settings\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Floors\Models\Floor;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Pallets\Models\Pallet;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;
use Modules\Warehouses\Services\FloorPlanStorage;

/**
 * Exports / imports the warehouse layout and inventory as a portable JSON document.
 *
 * Records are matched by their business keys (warehouse code, floor name,
 * sector code within a warehouse, product SKU, pallet code), never by database
 * ids, so a file can be moved between installations.
 *
 * Version 2 added floors, pallets, slots, batches, expiry dates and minimum
 * quantities. Version 1 files can still be imported.
 */
class DataTransferService
{
    public const FORMAT = 'solidwms';

    public const VERSION = 2;

    public const SUPPORTED_VERSIONS = [1, 2];

    public function __construct(private readonly FloorPlanStorage $floorPlans) {}

    public function export(bool $includeImages = true): array
    {
        $warehouses = Warehouse::query()->with('sectors')->orderBy('code')->get();
        $floors = Floor::query()->orderBy('level')->get()->groupBy('warehouse_id');
        $floorNames = Floor::query()->pluck('name', 'id');

        return [
            'format' => self::FORMAT,
            'version' => self::VERSION,
            'exported_at' => now()->toIso8601String(),
            'warehouses' => $warehouses->map(fn (Warehouse $w) => [
                'code' => $w->code,
                'name' => $w->name,
                'address' => $w->address,
                'description' => $w->description,
                'floor_plan' => $includeImages ? $this->exportImage($w) : null,
                'floors' => ($floors[$w->id] ?? collect())->map(fn (Floor $f) => [
                    'name' => $f->name,
                    'level' => $f->level,
                    'floor_plan' => $includeImages ? $this->exportImage($f) : null,
                ])->values()->all(),
                'sectors' => $w->sectors->map(fn (Sector $s) => [
                    'code' => $s->code,
                    'name' => $s->name,
                    'color' => $s->color,
                    'description' => $s->description,
                    'floor' => $s->floor_id ? ($floorNames[$s->floor_id] ?? null) : null,
                    'shape' => $s->shape,
                ])->values()->all(),
            ])->values()->all(),
            'products' => Product::query()->orderBy('sku')->get()->map(fn (Product $p) => [
                'sku' => $p->sku,
                'name' => $p->name,
                'barcode' => $p->barcode,
                'unit' => $p->unit,
                'min_quantity' => $p->min_quantity === null ? null : (float) $p->min_quantity,
                'description' => $p->description,
            ])->values()->all(),
            'pallets' => Pallet::query()->with('sector.warehouse')->orderBy('code')->get()->map(fn (Pallet $p) => [
                'code' => $p->code,
                'warehouse_code' => $p->sector?->warehouse?->code,
                'sector_code' => $p->sector?->code,
                'slot' => $p->slot,
                'note' => $p->note,
            ])->values()->all(),
            'stock' => StockItem::query()
                ->with(['product', 'sector.warehouse'])
                ->orderBy('id')
                ->get()
                ->map(fn (StockItem $i) => [
                    'sku' => $i->product->sku,
                    'warehouse_code' => $i->sector->warehouse->code,
                    'sector_code' => $i->sector->code,
                    'slot' => $i->slot,
                    'batch' => $i->batch,
                    'expires_at' => $i->expires_at?->toDateString(),
                    'pallet' => $i->pallet_id ? Pallet::whereKey($i->pallet_id)->value('code') : null,
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
        $images = $this->decodeImages($data['warehouses'] ?? []);
        $summary = [
            'warehouses' => ['created' => 0, 'updated' => 0],
            'floors' => ['created' => 0, 'updated' => 0],
            'sectors' => ['created' => 0, 'updated' => 0],
            'products' => ['created' => 0, 'updated' => 0],
            'pallets' => ['created' => 0, 'updated' => 0],
            'stock' => ['created' => 0, 'updated' => 0],
            'floor_plans' => ['imported' => 0],
        ];
        $obsoleteFiles = [];

        DB::transaction(function () use ($data, $mode, &$summary, &$obsoleteFiles) {
            if ($mode === 'replace') {
                $obsoleteFiles = array_merge(
                    Warehouse::query()->whereNotNull('floor_plan_path')->pluck('floor_plan_path')->all(),
                    Floor::query()->whereNotNull('floor_plan_path')->pluck('floor_plan_path')->all(),
                    DB::table('photos')->pluck('path')->all(),
                );

                // Everything that refers to warehouses or products goes too.
                foreach ([
                    'pick_lines', 'pick_lists', 'document_lines', 'documents', 'stocktake_lines', 'stocktakes',
                    'photos', 'stock_movements', 'stock_items', 'pallets', 'products', 'sectors', 'floors',
                    'user_warehouse', 'warehouses',
                ] as $table) {
                    DB::table($table)->delete();
                }
            }

            foreach ($data['warehouses'] ?? [] as $row) {
                $warehouse = Warehouse::firstOrNew(['code' => mb_strtoupper($row['code'])]);
                $summary['warehouses'][$warehouse->exists ? 'updated' : 'created']++;
                $warehouse->fill([
                    'name' => $row['name'],
                    'address' => $row['address'] ?? null,
                    'description' => $row['description'] ?? null,
                ])->save();

                $floorIds = [];
                foreach ($row['floors'] ?? [] as $floorRow) {
                    $floor = Floor::firstOrNew(['warehouse_id' => $warehouse->id, 'name' => $floorRow['name']]);
                    $summary['floors'][$floor->exists ? 'updated' : 'created']++;
                    $floor->fill(['level' => $floorRow['level'] ?? 1])->save();
                    $floorIds[$floorRow['name']] = $floor->id;
                }

                foreach ($row['sectors'] ?? [] as $sectorRow) {
                    $sector = Sector::firstOrNew([
                        'warehouse_id' => $warehouse->id,
                        'code' => mb_strtoupper($sectorRow['code']),
                    ]);
                    $summary['sectors'][$sector->exists ? 'updated' : 'created']++;
                    $floorName = $sectorRow['floor'] ?? null;
                    $sector->fill([
                        'name' => $sectorRow['name'],
                        'color' => $sectorRow['color'] ?? '#2563eb',
                        'description' => $sectorRow['description'] ?? null,
                        'shape' => $sectorRow['shape'] ?? null,
                        'floor_id' => $floorName ? ($floorIds[$floorName] ?? Floor::where('warehouse_id', $warehouse->id)->where('name', $floorName)->value('id')) : null,
                    ])->save();
                }
            }

            $sectorIds = [];
            foreach (Sector::query()->with('warehouse')->get() as $sector) {
                $sectorIds[$sector->warehouse->code][$sector->code] = $sector->id;
            }
            $errors = [];

            foreach ($data['products'] ?? [] as $row) {
                $product = Product::firstOrNew(['sku' => mb_strtoupper($row['sku'])]);
                $summary['products'][$product->exists ? 'updated' : 'created']++;
                $product->fill([
                    'name' => $row['name'],
                    'barcode' => $row['barcode'] ?? null,
                    'unit' => $row['unit'] ?? 'szt',
                    'description' => $row['description'] ?? null,
                ]);
                if (array_key_exists('min_quantity', $row)) {
                    $product->forceFill(['min_quantity' => $row['min_quantity']]);
                }
                $product->save();
            }

            foreach ($data['pallets'] ?? [] as $index => $row) {
                $sectorId = ($row['warehouse_code'] ?? null)
                    ? ($sectorIds[mb_strtoupper($row['warehouse_code'])][mb_strtoupper($row['sector_code'] ?? '')] ?? null)
                    : null;
                if (($row['warehouse_code'] ?? null) && $sectorId === null) {
                    $errors["data.pallets.$index.sector_code"] = "Nieznany sektor palety {$row['code']}.";

                    continue;
                }
                $pallet = Pallet::firstOrNew(['code' => mb_strtoupper($row['code'])]);
                $summary['pallets'][$pallet->exists ? 'updated' : 'created']++;
                $pallet->fill([
                    'sector_id' => $sectorId,
                    'slot' => $row['slot'] ?? null,
                    'note' => $row['note'] ?? null,
                ])->save();
            }

            $productIds = Product::query()->pluck('id', 'sku')->all();
            $palletIds = Pallet::query()->pluck('id', 'code')->all();

            foreach ($data['stock'] ?? [] as $index => $row) {
                $sku = mb_strtoupper($row['sku']);
                $warehouseCode = mb_strtoupper($row['warehouse_code']);
                $sectorCode = mb_strtoupper($row['sector_code']);
                $productId = $productIds[$sku] ?? null;
                $sectorId = $sectorIds[$warehouseCode][$sectorCode] ?? null;
                $palletCode = ($row['pallet'] ?? null) ? mb_strtoupper($row['pallet']) : null;

                if ($productId === null) {
                    $errors["data.stock.$index.sku"] = "Nieznany produkt {$sku}.";

                    continue;
                }
                if ($sectorId === null) {
                    $errors["data.stock.$index.sector_code"] = "Nieznany sektor {$warehouseCode}/{$sectorCode}.";

                    continue;
                }
                if ($palletCode && ! isset($palletIds[$palletCode])) {
                    $errors["data.stock.$index.pallet"] = "Nieznana paleta {$palletCode}.";

                    continue;
                }

                $dimensions = StockService::normalize([
                    'slot' => $row['slot'] ?? null,
                    'batch' => $row['batch'] ?? null,
                    'expires_at' => $row['expires_at'] ?? null,
                    'pallet_id' => $palletCode ? $palletIds[$palletCode] : null,
                ]);
                $existing = StockItem::query()->atLocation($productId, $sectorId, $dimensions)->first();

                if ((float) $row['quantity'] <= 0) {
                    $existing?->delete();

                    continue;
                }

                $item = $existing ?? new StockItem(['product_id' => $productId, 'sector_id' => $sectorId, ...$dimensions]);
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

        foreach ($images as [$warehouseCode, $floorName, $contents]) {
            $warehouse = Warehouse::where('code', $warehouseCode)->first();
            $target = $floorName === null ? $warehouse : Floor::where('warehouse_id', $warehouse?->id)->where('name', $floorName)->first();
            if ($target) {
                $this->floorPlans->storeContents($target, $contents);
                $summary['floor_plans']['imported']++;
            }
        }

        return $summary;
    }

    private function exportImage($model): ?array
    {
        $contents = $this->floorPlans->contents($model);

        if ($contents === null) {
            return null;
        }

        return [
            'width' => $model->floor_plan_width,
            'height' => $model->floor_plan_height,
            'mime' => getimagesizefromstring($contents)['mime'] ?? null,
            'data' => base64_encode($contents),
        ];
    }

    /**
     * Decodes and verifies all images before anything is written.
     *
     * @return list<array{0: string, 1: ?string, 2: string}> [warehouse code, floor name|null, binary]
     */
    private function decodeImages(array $warehouses): array
    {
        $images = [];
        $errors = [];

        $decode = function (?string $encoded, string $errorKey) use (&$errors): ?string {
            if (! $encoded) {
                return null;
            }
            if (str_starts_with($encoded, 'data:')) {
                $encoded = substr($encoded, (int) strpos($encoded, ',') + 1);
            }
            $binary = base64_decode($encoded, true);
            $info = $binary === false ? false : @getimagesizefromstring($binary);
            if ($info === false || ! isset(FloorPlanStorage::MIME_EXTENSIONS[$info['mime']])) {
                $errors[$errorKey] = 'Nieprawidłowy obraz rzutu.';

                return null;
            }

            return $binary;
        };

        foreach ($warehouses as $w => $row) {
            $code = mb_strtoupper($row['code']);
            if ($binary = $decode($row['floor_plan']['data'] ?? null, "data.warehouses.$w.floor_plan")) {
                $images[] = [$code, null, $binary];
            }
            foreach ($row['floors'] ?? [] as $f => $floor) {
                if ($binary = $decode($floor['floor_plan']['data'] ?? null, "data.warehouses.$w.floors.$f.floor_plan")) {
                    $images[] = [$code, $floor['name'], $binary];
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $images;
    }
}
