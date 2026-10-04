<?php

namespace Modules\Documents\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Core\Events\DomainEvent;
use Modules\Documents\Models\Document;
use Modules\Inventory\Models\StockItem;
use Modules\Inventory\Services\StockService;

class DocumentService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly WarehouseScope $scope,
    ) {}

    public function save(?Document $document, array $data, ?User $user): Document
    {
        $this->scope->ensure($user, (int) $data['warehouse_id']);

        return DB::transaction(function () use ($document, $data, $user) {
            if ($document === null) {
                $document = Document::create([
                    'type' => $data['type'],
                    'number' => Document::nextNumber($data['type']),
                    'status' => 'draft',
                    'warehouse_id' => $data['warehouse_id'],
                    'counterparty' => $data['counterparty'] ?? null,
                    'note' => $data['note'] ?? null,
                    'created_by' => $user?->id,
                ]);
            } else {
                $this->ensureDraft($document);
                $document->update([
                    'warehouse_id' => $data['warehouse_id'],
                    'counterparty' => $data['counterparty'] ?? null,
                    'note' => $data['note'] ?? null,
                ]);
                $document->lines()->delete();
            }

            foreach (array_values($data['lines']) as $index => $line) {
                $document->lines()->create([
                    'position' => $index + 1,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'sector_id' => $line['sector_id'] ?? null,
                    'stock_item_id' => $line['stock_item_id'] ?? null,
                    'note' => $line['note'] ?? null,
                    ...array_intersect_key(StockService::normalize($line), array_flip(['slot', 'batch', 'expires_at'])),
                ]);
            }

            return $document;
        });
    }

    /** Executes the document: puts goods into / takes goods out of the warehouse. */
    public function post(Document $document, ?User $user): Document
    {
        $this->ensureDraft($document);
        $this->scope->ensure($user, $document->warehouse_id);

        if (! $document->lines()->exists()) {
            throw ValidationException::withMessages(['lines' => 'Dokument nie ma pozycji.']);
        }

        DB::transaction(function () use ($document, $user) {
            foreach ($document->lines()->with(['product', 'sector'])->get() as $line) {
                $locations = $document->type === 'PZ'
                    ? $this->receiveLine($document, $line, $user)
                    : $this->issueLine($document, $line, $user);

                $line->update(['posted_locations' => $locations]);
            }

            $document->update(['status' => 'posted', 'posted_by' => $user?->id, 'posted_at' => now()]);
        });

        event(new DomainEvent('document.posted', [
            'id' => $document->id,
            'type' => $document->type,
            'number' => $document->number,
            'warehouse_id' => $document->warehouse_id,
            'lines' => $document->lines()->with('product')->get()->map(fn ($l) => [
                'sku' => $l->product->sku,
                'quantity' => $l->quantity,
            ])->all(),
        ]));

        return $document->refresh();
    }

    public function ensureDraft(Document $document): void
    {
        if ($document->status !== 'draft') {
            throw ValidationException::withMessages(['document' => 'Zatwierdzonego dokumentu nie można zmieniać.']);
        }
    }

    private function receiveLine(Document $document, $line, ?User $user): array
    {
        if (! $line->sector || $line->sector->warehouse_id !== $document->warehouse_id) {
            throw ValidationException::withMessages(["lines.{$line->position}" => "Pozycja {$line->position}: wybierz sektor w magazynie dokumentu."]);
        }

        $item = $this->stock->receive($line->product, $line->sector, $line->quantity, $user, $line->note, [
            'slot' => $line->slot,
            'batch' => $line->batch,
            'expires_at' => $line->expires_at,
        ], $document->number);

        return [['label' => $item->load('sector.warehouse')->locationLabel(), 'quantity' => $line->quantity]];
    }

    /** Issues from the chosen location or, if none, from the oldest-expiring ones (FEFO). */
    private function issueLine(Document $document, $line, ?User $user): array
    {
        $remaining = $line->quantity;
        $locations = [];

        $candidates = $line->stock_item_id
            ? StockItem::whereKey($line->stock_item_id)->get()
            : StockItem::query()
                ->with('sector.warehouse')
                ->where('product_id', $line->product_id)
                ->whereHas('sector', fn ($s) => $s->where('warehouse_id', $document->warehouse_id))
                ->when($line->batch, fn ($q) => $q->where('batch', $line->batch))
                ->fefo()
                ->get();

        foreach ($candidates as $item) {
            if ($remaining <= 0.0005) {
                break;
            }
            $take = min($remaining, $item->quantity);
            $label = $item->load('sector.warehouse')->locationLabel();
            $this->stock->issue($item, $take, $user, $line->note, $document->number);
            $locations[] = ['label' => $label, 'quantity' => round($take, 3)];
            $remaining -= $take;
        }

        if ($remaining > 0.0005) {
            throw ValidationException::withMessages([
                "lines.{$line->position}" => sprintf('Pozycja %d (%s): brakuje %s %s w magazynie.', $line->position, $line->product->name, rtrim(rtrim(number_format($remaining, 3, ',', ''), '0'), ','), $line->product->unit),
            ]);
        }

        return $locations;
    }
}
