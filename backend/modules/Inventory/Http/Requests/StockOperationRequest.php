<?php

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Shared validation for stock operations. The route name decides which fields are needed.
 */
class StockOperationRequest extends FormRequest
{
    public function rules(): array
    {
        return match ($this->route()->getName()) {
            'stock.receive' => [
                'product_id' => ['required', 'integer', 'exists:products,id'],
                'sector_id' => ['required', 'integer', 'exists:sectors,id'],
                'quantity' => ['required', 'numeric', 'gt:0', 'max:999999999'],
                'note' => ['nullable', 'string', 'max:255'],
            ],
            'stock.issue' => [
                'quantity' => ['required', 'numeric', 'gt:0', 'max:999999999'],
                'note' => ['nullable', 'string', 'max:255'],
            ],
            'stock.move' => [
                'to_sector_id' => ['required', 'integer', 'exists:sectors,id'],
                'quantity' => ['required', 'numeric', 'gt:0', 'max:999999999'],
                'note' => ['nullable', 'string', 'max:255'],
            ],
            'stock.update' => [
                'quantity' => ['sometimes', 'numeric', 'gte:0', 'max:999999999'],
                'note' => ['sometimes', 'nullable', 'string', 'max:255'],
            ],
            default => [],
        };
    }
}
