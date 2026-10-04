<?php

namespace Modules\Stocktaking\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Events\DomainEvent;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Stocktaking\Models\Stocktake;
use Modules\Warehouses\Models\Sector;

class StocktakeService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly WarehouseScope $scope,
    ) {}

    /** Starts counting a sector: one line per current location. */
    public function start(Sector $sector, ?string $note, ?User $user): Stocktake
    {
        $this->scope->ensure($user, $sector->warehouse_id);

        if (Stocktake::where('sector_id', $sector->id)->where('status', 'open')->exists()) {
            throw ValidationException::withMessages(['sector_id' => 'W tym sektorze trwa już inwentaryzacja.']);
        }

        return DB::transaction(function () use ($sector, $note, $user) {
            $stocktake = Stocktake::create([
                'sector_id' => $sector->id,
                'status' => 'open',
                'note' => $note,
                'created_by' => $user?->id,
            ]);

            foreach (StockItem::where('sector_id', $sector->id)->get() as $item) {
                $stocktake->lines()->create([
                    'stock_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'slot' => $item->slot,
                    'batch' => $item->batch,
                    'expires_at' => $item->expires_at,
                    'pallet_id' => $item->pallet_id,
                    'expected' => $item->quantity,
                ]);
            }

            return $stocktake;
        });
    }

    /**
     * Applies the counted quantities as one batch of corrections.
     * Lines that were not counted are left unchanged.
     *
     * @return array{changed: int, unchanged: int, skipped: int}
     */
    public function complete(Stocktake $stocktake, ?User $user): array
    {
        $this->ensureOpen($stocktake);
        $sector = $stocktake->sector;
        $reference = $stocktake->reference();
        $result = ['changed' => 0, 'unchanged' => 0, 'skipped' => 0];

        DB::transaction(function () use ($stocktake, $sector, $reference, $user, &$result) {
            foreach ($stocktake->lines()->with('product')->get() as $line) {
                if ($line->counted === null) {
                    $result['skipped']++;

                    continue;
                }

                $item = $line->stock_item_id ? StockItem::find($line->stock_item_id) : null;
                $current = $item?->quantity ?? 0.0;

                if (abs($current - $line->counted) < 0.0005) {
                    $result['unchanged']++;

                    continue;
                }

                if ($item) {
                    $this->stock->adjust($item, $line->counted, $user, "Inwentaryzacja {$reference}", false, $reference);
                } elseif ($line->counted > 0) {
                    $this->stock->receive($line->product ?? Product::findOrFail($line->product_id), $sector, $line->counted, $user, "Inwentaryzacja {$reference}", [
                        'slot' => $line->slot,
                        'batch' => $line->batch,
                        'expires_at' => $line->expires_at,
                        'pallet_id' => $line->pallet_id,
                    ], $reference);
                }
                $result['changed']++;
            }

            $stocktake->update(['status' => 'completed', 'completed_by' => $user?->id, 'completed_at' => now()]);
        });

        event(new DomainEvent('stocktake.completed', ['id' => $stocktake->id, 'sector_id' => $sector->id] + $result));

        return $result;
    }

    public function ensureOpen(Stocktake $stocktake): void
    {
        if ($stocktake->status !== 'open') {
            throw ValidationException::withMessages(['stocktake' => 'Inwentaryzacja jest już zamknięta.']);
        }
    }
}
