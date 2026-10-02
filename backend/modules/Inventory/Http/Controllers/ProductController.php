<?php

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\Http\Requests\ProductRequest;
use Modules\Inventory\Http\Resources\ProductResource;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Services\StockService;
use Modules\Warehouses\Models\Sector;

class ProductController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = min(max((int) $request->integer('per_page', 25), 1), 100);

        $products = Product::query()
            ->search($request->string('q')->toString())
            ->withSum('stockItems', 'quantity')
            ->withCount('stockItems')
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        return ProductResource::collection($products);
    }

    public function store(ProductRequest $request, StockService $stock): ProductResource
    {
        $product = DB::transaction(function () use ($request, $stock) {
            $product = Product::create($request->safe()->except('initial_stock'));

            if ($initial = $request->validated('initial_stock')) {
                $stock->receive(
                    $product,
                    Sector::findOrFail($initial['sector_id']),
                    (float) $initial['quantity'],
                    $request->user(),
                    $initial['note'] ?? null,
                );
            }

            return $product;
        });

        return $this->show($product);
    }

    public function show(Product $product): ProductResource
    {
        $product->load(['stockItems' => fn ($q) => $q->with(['product', 'sector.warehouse', 'updatedBy'])->orderByDesc('quantity')])
            ->loadSum('stockItems', 'quantity')
            ->loadCount('stockItems');

        return new ProductResource($product);
    }

    public function update(ProductRequest $request, Product $product): ProductResource
    {
        $product->update($request->validated());

        return $this->show($product);
    }

    public function destroy(Product $product): Response
    {
        $product->delete();

        return response()->noContent();
    }
}
