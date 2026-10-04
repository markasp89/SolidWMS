<?php

namespace Modules\Picking\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Events\DomainEvent;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Picking\Models\PickLine;
use Modules\Picking\Models\PickList;
use Modules\Warehouses\Models\Warehouse;

class PickingService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly WarehouseScope $scope,
    ) {}

    /**
     * Creates a pick list: every ordered product is allocated to concrete locations
     * (oldest expiry first) and the lines are sorted in walking order (sector, slot).
     *
     * @param  list<array{product_id: int, quantity: float}>  $items
     */
    public function create(Warehouse $warehouse, array $items, ?string $note, ?User $user): PickList
    {
        $this->scope->ensure($user, $warehouse->id);

        return DB::transaction(function () use ($warehouse, $items, $note, $user) {
            $list = PickList::create([
                'number' => PickList::nextNumber(),
                'warehouse_id' => $warehouse->id,
                'note' => $note,
                'created_by' => $user?->id,
            ]);

            $lines = [];
            foreach ($items as $wanted) {
                $remaining = (float) $wanted['quantity'];
                $locations = StockItem::query()
                    ->with('sector')
                    ->where('product_id', $wanted['product_id'])
                    ->whereHas('sector', fn ($s) => $s->where('warehouse_id', $warehouse->id))
                    ->fefo()
                    ->get();

                foreach ($locations as $item) {
                    if ($remaining <= 0.0005) {
                        break;
                    }
                    $take = min($remaining, $item->quantity);
                    $lines[] = [
                        'product_id' => $item->product_id,
                        'stock_item_id' => $item->id,
                        'sector_id' => $item->sector_id,
                        'sector_code' => $item->sector->code,
                        'slot' => $item->slot,
                        'batch' => $item->batch,
                        'expires_at' => $item->expires_at,
                        'quantity' => round($take, 3),
                        'status' => 'pending',
                    ];
                    $remaining -= $take;
                }

                if ($remaining > 0.0005) {
                    // Not enough stock: keep the shortage visible on the list.
                    $lines[] = [
                        'product_id' => $wanted['product_id'],
                        'stock_item_id' => null,
                        'sector_id' => null,
                        'sector_code' => "\u{FFFF}",
                        'slot' => null,
                        'batch' => null,
                        'expires_at' => null,
                        'quantity' => round($remaining, 3),
                        'status' => 'short',
                    ];
                }
            }

            usort($lines, fn ($a, $b) => strnatcasecmp($a['sector_code'], $b['sector_code']) ?: strnatcasecmp((string) $a['slot'], (string) $b['slot']));

            foreach ($lines as $index => $line) {
                unset($line['sector_code']);
                $list->lines()->create($line + ['sequence' => $index + 1]);
            }

            return $list;
        });
    }

    public function pick(PickList $list, PickLine $line, ?float $quantity, ?User $user): PickLine
    {
        $this->ensureOpen($list);
        $this->scope->ensure($user, $list->warehouse_id);

        if ($line->status !== 'pending') {
            throw ValidationException::withMessages(['line' => 'Ta pozycja jest już zebrana.']);
        }

        $quantity ??= $line->quantity - $line->picked;
        $item = $line->stock_item_id ? StockItem::find($line->stock_item_id) : null;

        if (! $item) {
            throw ValidationException::withMessages(['line' => 'Towaru nie ma już w tym miejscu. Sprawdź wyszukiwarką, gdzie teraz leży.']);
        }

        DB::transaction(function () use ($list, $line, $item, $quantity, $user) {
            $this->stock->issue($item, $quantity, $user, "Kompletacja {$list->number}", $list->number);

            $picked = round($line->picked + $quantity, 3);
            $line->update([
                'picked' => $picked,
                'status' => $picked + 0.0005 >= $line->quantity ? 'picked' : 'pending',
                'picked_by' => $user?->id,
                'picked_at' => now(),
            ]);
        });

        $this->completeIfDone($list);

        return $line;
    }

    public function complete(PickList $list): PickList
    {
        $this->ensureOpen($list);
        $list->update(['status' => 'completed', 'completed_at' => now()]);
        event(new DomainEvent('picking.completed', ['id' => $list->id, 'number' => $list->number]));

        return $list;
    }

    public function ensureOpen(PickList $list): void
    {
        if ($list->status !== 'open') {
            throw ValidationException::withMessages(['pick_list' => 'Ta lista jest już zamknięta.']);
        }
    }

    private function completeIfDone(PickList $list): void
    {
        if (! $list->lines()->where('status', 'pending')->exists()) {
            $this->complete($list);
        }
    }
}
