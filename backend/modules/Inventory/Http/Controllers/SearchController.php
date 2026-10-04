<?php

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Core\Contracts\WarehouseScope;
use Modules\Inventory\Http\Resources\ProductResource;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;

/**
 * "Where is it?" - finds products and returns every location they are stored in.
 */
class SearchController extends Controller
{
    public function __construct(private readonly WarehouseScope $scope) {}

    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $request->validate(['q' => ['required', 'string', 'min:1', 'max:100']]);

        $allowed = $this->scope->allowedWarehouseIds($request->user());

        $products = Product::query()
            ->search($request->string('q')->toString())
            ->with(['stockItems' => fn ($q) => $q->with(StockItem::$apiRelations)->inWarehouses($allowed)->fefo()])
            ->withSum('stockItems', 'quantity')
            ->withCount('stockItems')
            ->orderBy('name')
            ->limit(25)
            ->get();

        return ProductResource::collection($products);
    }
}
