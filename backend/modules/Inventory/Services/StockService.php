<?php

namespace Modules\Inventory\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Events\DomainEvent;
use Modules\Inventory\Enums\MovementType;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Models\StockMovement;
use Modules\Warehouses\Models\Sector;

/**
 * All stock changes go through this service so every change is checked
 * against warehouse access and recorded in the movement history.
 *
 * A location is identified by product + sector + optional dimensions
 * (slot, batch, expires_at, pallet_id - see StockItem::DIMENSIONS).
 */
class StockService
{
    private const EPSILON = 0.0005;

    public function __construct(private readonly WarehouseScope $scope) {}

    /**
     * Puts goods into a sector (adds to an existing identical location if present).
     *
     * @param  array{slot?: ?string, batch?: ?string, expires_at?: mixed, pallet_id?: ?int}  $dimensions
     */
    public function receive(
        Product $product,
        Sector $sector,
        float $quantity,
        ?User $user,
        ?string $note = null,
        array $dimensions = [],
        ?string $reference = null,
    ): StockItem {
        $this->scope->ensure($user, $sector->warehouse_id);
        $dimensions = self::normalize($dimensions);

        return DB::transaction(function () use ($product, $sector, $quantity, $user, $note, $dimensions, $reference) {
            $item = $this->addTo($product->id, $sector->id, $dimensions, $quantity, $user, $note);

            $this->log($product->id, MovementType::In, $quantity, null, $sector->id, $dimensions, $user, $note, $reference);

            return $item;
        });
    }

    /** Takes goods out of a location. Returns null if the location became empty. */
    public function issue(StockItem $item, float $quantity, ?User $user, ?string $note = null, ?string $reference = null): ?StockItem
    {
        $this->ensureAccess($item, $user);

        return DB::transaction(function () use ($item, $quantity, $user, $note, $reference) {
            $item = $this->lock($item);
            $this->ensureAvailable($item, $quantity);
            $dimensions = $this->dimensionsOf($item);
            [$productId, $sectorId] = [$item->product_id, $item->sector_id];

            $remaining = $this->setQuantity($item, $item->quantity - $quantity, $user);

            $this->log($productId, MovementType::Out, $quantity, $sectorId, null, $dimensions, $user, $note, $reference);

            return $remaining;
        });
    }

    /**
     * Moves (part of) a location to another sector/slot. Batch and expiry date travel
     * with the goods; the pallet is left unless $target['pallet_id'] says otherwise.
     *
     * @param  array{slot?: ?string, pallet_id?: ?int}  $target
     */
    public function move(
        StockItem $item,
        Sector $sector,
        float $quantity,
        ?User $user,
        ?string $note = null,
        array $target = [],
        ?string $reference = null,
    ): StockItem {
        $this->ensureAccess($item, $user);
        $this->scope->ensure($user, $sector->warehouse_id);

        return DB::transaction(function () use ($item, $sector, $quantity, $user, $note, $target, $reference) {
            $item = $this->lock($item);
            $this->ensureAvailable($item, $quantity);

            $source = $this->dimensionsOf($item);
            $dimensions = self::normalize([
                'slot' => array_key_exists('slot', $target) ? $target['slot'] : null,
                'batch' => $source['batch'],
                'expires_at' => $source['expires_at'],
                'pallet_id' => $target['pallet_id'] ?? null,
            ]);

            if ($item->sector_id === $sector->id && $source === $dimensions) {
                throw ValidationException::withMessages(['to_sector_id' => 'Miejsce docelowe musi być inne niż obecne.']);
            }

            [$productId, $fromSectorId] = [$item->product_id, $item->sector_id];

            $this->setQuantity($item, $item->quantity - $quantity, $user);
            $targetItem = $this->addTo($productId, $sector->id, $dimensions, $quantity, $user, null);

            $this->log($productId, MovementType::Move, $quantity, $fromSectorId, $sector->id, array_merge($dimensions, ['pallet_id' => $dimensions['pallet_id'] ?? $source['pallet_id']]), $user, $note, $reference);

            return $targetItem;
        });
    }

    /** Sets the counted quantity (stocktaking correction) and/or the note. */
    public function adjust(
        StockItem $item,
        ?float $quantity,
        ?User $user,
        ?string $note = null,
        bool $updateNote = false,
        ?string $reference = null,
    ): ?StockItem {
        $this->ensureAccess($item, $user);

        return DB::transaction(function () use ($item, $quantity, $user, $note, $updateNote, $reference) {
            $item = $this->lock($item);
            $dimensions = $this->dimensionsOf($item);
            [$productId, $sectorId] = [$item->product_id, $item->sector_id];

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

            $this->log($productId, MovementType::Adjust, $delta, $sectorId, $sectorId, $dimensions, $user, $note, $reference);

            return $item;
        });
    }

    /**
     * Normalises location dimensions (empty strings to null, upper-case slot, Y-m-d dates).
     *
     * @return array{slot: ?string, batch: ?string, expires_at: ?string, pallet_id: ?int}
     */
    public static function normalize(array $dimensions): array
    {
        $text = fn ($v) => ($v === null || trim((string) $v) === '') ? null : trim((string) $v);
        $expires = $dimensions['expires_at'] ?? null;

        return [
            'slot' => ($slot = $text($dimensions['slot'] ?? null)) ? mb_strtoupper($slot) : null,
            'batch' => $text($dimensions['batch'] ?? null),
            'expires_at' => $expires ? Carbon::parse($expires)->toDateString() : null,
            'pallet_id' => ($dimensions['pallet_id'] ?? null) ? (int) $dimensions['pallet_id'] : null,
        ];
    }

    /** @return array{slot: ?string, batch: ?string, expires_at: ?string, pallet_id: ?int} */
    private function dimensionsOf(StockItem $item): array
    {
        return self::normalize([
            'slot' => $item->slot,
            'batch' => $item->batch,
            'expires_at' => $item->expires_at,
            'pallet_id' => $item->pallet_id,
        ]);
    }

    private function addTo(int $productId, int $sectorId, array $dimensions, float $quantity, ?User $user, ?string $note): StockItem
    {
        $item = StockItem::query()->atLocation($productId, $sectorId, $dimensions)->lockForUpdate()->first();

        if ($item === null) {
            return StockItem::create([
                'product_id' => $productId,
                'sector_id' => $sectorId,
                ...$dimensions,
                'quantity' => round($quantity, 3),
                'note' => $note,
                'updated_by' => $user?->id,
            ]);
        }

        $item->quantity = round($item->quantity + $quantity, 3);
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

    private function ensureAccess(StockItem $item, ?User $user): void
    {
        $warehouseId = $item->sector?->warehouse_id ?? Sector::whereKey($item->sector_id)->value('warehouse_id');
        $this->scope->ensure($user, (int) $warehouseId);
    }

    private function ensureAvailable(StockItem $item, float $quantity): void
    {
        if ($quantity - $item->quantity > self::EPSILON) {
            throw ValidationException::withMessages([
                'quantity' => sprintf('W tym miejscu dostępne jest tylko %s.', rtrim(rtrim(number_format($item->quantity, 3, '.', ''), '0'), '.')),
            ]);
        }
    }

    private function log(
        int $productId,
        MovementType $type,
        float $quantity,
        ?int $from,
        ?int $to,
        array $dimensions,
        ?User $user,
        ?string $note,
        ?string $reference,
    ): void {
        $movement = StockMovement::create([
            'product_id' => $productId,
            'type' => $type,
            'quantity' => round($quantity, 3),
            'from_sector_id' => $from,
            'to_sector_id' => $to,
            'slot' => $dimensions['slot'] ?? null,
            'batch' => $dimensions['batch'] ?? null,
            'pallet_id' => $dimensions['pallet_id'] ?? null,
            'user_id' => $user?->id,
            'note' => $note,
            'reference' => $reference,
        ]);

        // Change of the product's total quantity caused by this movement.
        $delta = match ($type) {
            MovementType::In => $quantity,
            MovementType::Out => -$quantity,
            MovementType::Adjust => $quantity,
            MovementType::Move => 0.0,
        };

        event(new DomainEvent('stock.movement', [
            'movement_id' => $movement->id,
            'product_id' => $productId,
            'type' => $type->value,
            'quantity' => round($quantity, 3),
            'total_delta' => round($delta, 3),
            'from_sector_id' => $from,
            'to_sector_id' => $to,
            'pallet_id' => $movement->pallet_id,
            'reference' => $reference,
            'user_id' => $user?->id,
        ]));
    }
}
