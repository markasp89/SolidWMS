<?php

namespace Modules\Alerts\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Inventory\Models\Product;

class AlertController extends Controller
{
    /** Products below their minimum quantity. */
    public function lowStock(): JsonResponse
    {
        $products = Product::query()
            ->whereNotNull('min_quantity')
            ->withSum('stockItems', 'quantity')
            ->orderBy('name')
            ->get()
            ->filter(fn (Product $p) => (float) $p->stock_items_sum_quantity < (float) $p->min_quantity)
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'sku' => $p->sku,
                'name' => $p->name,
                'unit' => $p->unit,
                'total_quantity' => (float) $p->stock_items_sum_quantity,
                'min_quantity' => (float) $p->min_quantity,
            ])
            ->values();

        return response()->json($products);
    }

    public function setMinimum(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate(['min_quantity' => ['present', 'nullable', 'numeric', 'gte:0', 'max:999999999']]);

        $product->forceFill(['min_quantity' => $data['min_quantity']])->save();

        return response()->json([
            'product_id' => $product->id,
            'min_quantity' => $product->min_quantity === null ? null : (float) $product->min_quantity,
            'total_quantity' => (float) $product->stockItems()->sum('quantity'),
        ]);
    }

    public function getMinimum(Product $product): JsonResponse
    {
        return response()->json([
            'product_id' => $product->id,
            'min_quantity' => $product->min_quantity === null ? null : (float) $product->min_quantity,
            'total_quantity' => (float) $product->stockItems()->sum('quantity'),
        ]);
    }

    public function notifications(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'unread' => $user->unreadNotifications()->count(),
            'items' => $user->notifications()->latest()->limit(30)->get()->map(fn ($n) => [
                'id' => $n->id,
                'data' => $n->data,
                'read_at' => $n->read_at?->toIso8601String(),
                'created_at' => $n->created_at?->toIso8601String(),
            ]),
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['nullable', 'array'], 'ids.*' => ['string']]);

        $query = $request->user()->unreadNotifications();
        if (! empty($data['ids'])) {
            $query->whereIn('id', $data['ids']);
        }
        $query->update(['read_at' => now()]);

        return $this->notifications($request);
    }
}
