<?php

namespace Modules\Documents\Http\Controllers;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Documents\Models\Document;
use Modules\Documents\Models\DocumentLine;
use Modules\Documents\Services\DocumentService;
use Modules\Inventory\Http\Requests\StockOperationRequest;
use Modules\Inventory\Http\Resources\SectorSummary;

class DocumentController extends Controller
{
    public function __construct(
        private readonly DocumentService $documents,
        private readonly WarehouseScope $scope,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $allowed = $this->scope->allowedWarehouseIds($request->user());

        $page = Document::query()
            ->with(['warehouse', 'createdBy'])
            ->withCount('lines')
            ->when($allowed !== null, fn ($q) => $q->whereIn('warehouse_id', $allowed))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')->toString()))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->toString()))
            ->when($request->filled('q'), fn ($q) => $q->where(fn ($w) => $w
                ->where('number', 'like', '%'.$request->string('q').'%')
                ->orWhere('counterparty', 'like', '%'.$request->string('q').'%')))
            ->latest('id')
            ->paginate(30)
            ->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Document $d) => $this->summary($d)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $page->perPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $document = $this->documents->save(null, $this->validated($request, true), $request->user());

        return response()->json($this->detail($document), 201);
    }

    public function show(Request $request, Document $document): JsonResponse
    {
        $this->scope->ensure($request->user(), $document->warehouse_id);

        return response()->json($this->detail($document));
    }

    public function update(Request $request, Document $document): JsonResponse
    {
        $document = $this->documents->save($document, $this->validated($request, false) + ['type' => $document->type], $request->user());

        return response()->json($this->detail($document));
    }

    public function destroy(Request $request, Document $document): Response
    {
        $this->scope->ensure($request->user(), $document->warehouse_id);
        $this->documents->ensureDraft($document);
        $document->delete();

        return response()->noContent();
    }

    public function post(Request $request, Document $document): JsonResponse
    {
        return response()->json($this->detail($this->documents->post($document, $request->user())));
    }

    public function pdf(Request $request, Document $document)
    {
        $this->scope->ensure($request->user(), $document->warehouse_id);
        $document->load(['warehouse', 'createdBy', 'postedBy', 'lines.product', 'lines.sector']);

        return Pdf::loadView('documents::document', ['document' => $document])
            ->setPaper('a4')
            ->download(str_replace('/', '-', $document->number).'.pdf');
    }

    private function validated(Request $request, bool $creating): array
    {
        return $request->validate([
            'type' => [$creating ? 'required' : 'prohibited', Rule::in(array_keys(Document::TYPES))],
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'counterparty' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:500'],
            'lines.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'max:999999999'],
            'lines.*.sector_id' => ['nullable', 'integer', 'exists:sectors,id'],
            'lines.*.stock_item_id' => ['nullable', 'integer', 'exists:stock_items,id'],
            'lines.*.note' => ['nullable', 'string', 'max:255'],
            ...StockOperationRequest::dimensionRules('lines.*.'),
        ], [
            'lines.required' => 'Dodaj co najmniej jedną pozycję.',
            'lines.min' => 'Dodaj co najmniej jedną pozycję.',
        ]);
    }

    private function summary(Document $d): array
    {
        $d->loadMissing(['warehouse', 'createdBy', 'postedBy']);

        return [
            'id' => $d->id,
            'type' => $d->type,
            'type_label' => Document::TYPES[$d->type],
            'number' => $d->number,
            'status' => $d->status,
            'warehouse' => $d->warehouse?->only(['id', 'code', 'name']),
            'counterparty' => $d->counterparty,
            'note' => $d->note,
            'lines_count' => $d->lines_count ?? $d->lines()->count(),
            'created_by' => $d->createdBy?->only(['id', 'name']),
            'posted_by' => $d->postedBy?->only(['id', 'name']),
            'created_at' => $d->created_at?->toIso8601String(),
            'posted_at' => $d->posted_at?->toIso8601String(),
        ];
    }

    private function detail(Document $d): array
    {
        $d->load(['lines.product', 'lines.sector.warehouse']);

        return $this->summary($d) + [
            'lines' => $d->lines->map(fn (DocumentLine $l) => [
                'id' => $l->id,
                'position' => $l->position,
                'product' => $l->product?->only(['id', 'sku', 'name', 'unit']),
                'quantity' => $l->quantity,
                'sector' => SectorSummary::from($l->sector),
                'stock_item_id' => $l->stock_item_id,
                'slot' => $l->slot,
                'batch' => $l->batch,
                'expires_at' => $l->expires_at?->toDateString(),
                'note' => $l->note,
                'posted_locations' => $l->posted_locations,
            ]),
        ];
    }
}
