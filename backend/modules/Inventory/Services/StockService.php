<?php

namespace Modules\Inventory\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Inventory\Enums\MovementType;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Models\StockMovement;
use Modules\Warehouses\Models\Sector;

/**
 * All stock changes go through this service so every change is recorded
 * in the movement history.
 */
class StockService
{
    private const EPSILON = 0.0005;

    /** Puts goods into a sector (adds to an existing location if present). */
    public function receive(Product $product, Sector $sector, float $quantity, ?User $user, ?string $note = null): StockItem
    {
        return DB::transaction(function () use ($product, $sector, $quantity, $user, $note) {
            $item = $this->addToSector($product->id, $sector->id, $quantity, $user, $note);

            $this->log($product->id, MovementType::In, $quantity, null, $sector->id, $user, $note);

            return $item;
        });
    }

    /** Takes goods out of a location. Returns null if the location became empty. */
    public function issue(StockItem $item, float $quantity, ?User $user, ?string $note = null): ?StockItem
    {
        return DB::transaction(function () use ($item, $quantity, $user, $note) {
            $item = $this->lock($item);
            $this->ensureAvailable($item, $quantity);

            $productId = $item->product_id;
            $sectorId = $item->sector_id;

            $remaining = $this->setQuantity($item, $item->quantity - $quantity, $user);

            $this->log($productId, MovementType::Out, $quantity, $sectorId, null, $user, $note);

            return $remaining;
        });
    }

    /** Moves (part of) a location to another sector. Returns the target location. */
    public function move(StockItem $item, Sector $target, float $quantity, ?User $user, ?string $note = null): StockItem
    {
        if ($item->sector_id === $target->id) {
            throw ValidationException::withMessages(['to_sector_id' => 'Sektor docelowy musi być inny niż obecny.']);
        }

        return DB::transaction(function () use ($item, $target, $quantity, $user, $note) {
            $item = $this->lock($item);
            $this->ensureAvailable($item, $quantity);

            $productId = $item->product_id;
            $fromSectorId = $item->sector_id;

            $this->setQuantity($item, $item->quantity - $quantity, $user);
            $targetItem = $this->addToSector($productId, $target->id, $quantity, $user, null);

            $this->log($productId, MovementType::Move, $quantity, $fromSectorId, $target->id, $user, $note);

            return $targetItem;
        });
    }

    /** Sets the counted quantity (stocktaking correction) and/or the note. */
    public function adjust(StockItem $item, ?float $quantity, ?User $user, ?string $note = null, bool $updateNote = false): ?StockItem
    {
        return DB::transaction(function () use ($item, $quantity, $user, $note, $updateNote) {
            $item = $this->lock($item);
            $productId = $item->product_id;
            $sectorId = $item->sector_id;

            if ($updateNote) {
                $item->note = $note;
            }

            if ($quantity === null || abs($quantity - $item->quantity) < self::EPSILON) {
                $item->updated_by = $user?->id;
                $item->save();

                return $item;
            }

            $delta = $quantity - $item->quantity;
            $item = $this->setQuantity($item, $quantity, $user);

            $this->log($productId, MovementType::Adjust, $delta, $sectorId, $sectorId, $user, $note);

            return $item;
        });
    }

    private function addToSector(int $productId, int $sectorId, float $quantity, ?User $user, ?string $note): StockItem
    {
        $item = StockItem::query()
            ->where('product_id', $productId)
            ->where('sector_id', $sectorId)
            ->lockForUpdate()
            ->first();

        if ($item === null) {
            return StockItem::create([
                'product_id' => $productId,
                'sector_id' => $sectorId,
                'quantity' => $quantity,
                'note' => $note,
                'updated_by' => $user?->id,
            ]);
        }

        $item->quantity += $quantity;
        $item->updated_by = $user?->id;
        if ($note !== null && $note !== '') {
            $item->note = $note;
        }
        $item->save();

        return $item;
    }

    private function setQuantity(StockItem $item, float $quantity, ?User $user): ?StockItem
    {
        if ($quantity < self::EPSILON) {
            $item->delete();

            return null;
        }

        $item->quantity = round($quantity, 3);
        $item->updated_by = $user?->id;
        $item->save();

        return $item;
    }

    private function lock(StockItem $item): StockItem
    {
        return StockItem::query()->lockForUpdate()->findOrFail($item->id);
    }

    private function ensureAvailable(StockItem $item, float $quantity): void
    {
        if ($quantity - $item->quantity > self::EPSILON) {
            throw ValidationException::withMessages([
                'quantity' => sprintf('W tym miejscu dostępne jest tylko %s.', rtrim(rtrim(number_format($item->quantity, 3, '.', ''), '0'), '.')),
            ]);
        }
    }

    private function log(int $productId, MovementType $type, float $quantity, ?int $from, ?int $to, ?User $user, ?string $note): void
    {
        StockMovement::create([
            'product_id' => $productId,
            'type' => $type,
            'quantity' => round($quantity, 3),
            'from_sector_id' => $from,
            'to_sector_id' => $to,
            'user_id' => $user?->id,
            'note' => $note,
        ]);
    }
}
