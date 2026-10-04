<?php

namespace Modules\Pallets\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Events\DomainEvent;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;
use Modules\Pallets\Models\Pallet;
use Modules\Warehouses\Models\Sector;

class PalletService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly WarehouseScope $scope,
    ) {}

    public function create(Sector $sector, ?string $slot, ?string $code, ?string $note, ?User $user): Pallet
    {
        $this->scope->ensure($user, $sector->warehouse_id);

        return Pallet::create([
            'code' => $code ? mb_strtoupper(trim($code)) : Pallet::nextCode(),
            'sector_id' => $sector->id,
            'slot' => StockService::normalize(['slot' => $slot])['slot'],
            'note' => $note,
            'created_by' => $user?->id,
        ]);
    }

    /** Puts goods onto the pallet (in the pallet's current place). */
    public function addItem(Pallet $pallet, Product $product, float $quantity, array $dimensions, ?string $note, ?User $user): StockItem
    {
        $sector = $this->sectorOf($pallet);

        return $this->stock->receive($product, $sector, $quantity, $user, $note, [
            'slot' => $pallet->slot,
            'batch' => $dimensions['batch'] ?? null,
            'expires_at' => $dimensions['expires_at'] ?? null,
            'pallet_id' => $pallet->id,
        ], $pallet->code);
    }

    /** Moves the whole pallet with its contents to another place. */
    public function move(Pallet $pallet, Sector $target, ?string $slot, ?string $note, ?User $user): Pallet
    {
        $this->scope->ensure($user, $target->warehouse_id);
        if ($pallet->sector_id) {
            $this->scope->ensure($user, $this->sectorOf($pallet)->warehouse_id);
        }

        $slot = StockService::normalize(['slot' => $slot])['slot'];

        if ($pallet->sector_id === $target->id && $pallet->slot === $slot) {
            throw ValidationException::withMessages(['to_sector_id' => 'Paleta już stoi w tym miejscu.']);
        }

        DB::transaction(function () use ($pallet, $target, $slot, $note, $user) {
            $from = $pallet->sector_id;

            foreach ($pallet->items()->get() as $item) {
                $this->stock->move($item, $target, $item->quantity, $user, $note ?? "Paleta {$pallet->code}", [
                    'slot' => $slot,
                    'pallet_id' => $pallet->id,
                ], $pallet->code);
            }

            $pallet->update([
                'sector_id' => $target->id,
                'slot' => $slot,
                'moved_by' => $user?->id,
                'moved_at' => now(),
            ]);

            event(new DomainEvent('pallet.moved', [
                'pallet_id' => $pallet->id,
                'code' => $pallet->code,
                'from_sector_id' => $from,
                'to_sector_id' => $target->id,
                'slot' => $slot,
                'user_id' => $user?->id,
            ]));
        });

        return $pallet;
    }

    public function delete(Pallet $pallet): void
    {
        if ($pallet->items()->exists()) {
            throw ValidationException::withMessages(['pallet' => 'Paleta nie jest pusta. Wydaj lub przenieś towar przed usunięciem.']);
        }

        $pallet->delete();
    }

    private function sectorOf(Pallet $pallet): Sector
    {
        if (! $pallet->sector) {
            throw ValidationException::withMessages(['pallet' => 'Paleta nie ma przypisanego miejsca.']);
        }

        return $pallet->sector;
    }
}
