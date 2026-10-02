<?php

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Inventory\Http\Resources\ProductResource;
use Modules\Inventory\Models\Product;

/**
 * "Where is it?" - finds products and returns every location they are stored in.
 */
class SearchController extends Controller
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $request->validate(['q' => ['required', 'string', 'min:1', 'max:100']]);

        $products = Product::query()
            ->search($request->string('q')->toString())
            ->with(['stockItems' => fn ($q) => $q->with(['product', 'sector.warehouse', 'updatedBy'])->orderByDesc('quantity')])
            ->withSum('stockItems', 'quantity')
            ->withCount('stockItems')
            ->orderBy('name')
            ->limit(25)
            ->get();

        return ProductResource::collection($products);
    }
}
