<?php

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('sku')) {
            $this->merge(['sku' => strtoupper(trim((string) $this->input('sku')))]);
        }
    }

    public function rules(): array
    {
        $creating = $this->route('product') === null;

        return [
            'sku' => [
                $creating ? 'required' : 'sometimes',
                'string',
                'max:64',
                Rule::unique('products', 'sku')->ignore($this->route('product')),
            ],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'unit' => ['sometimes', 'string', 'max:16'],
            'description' => ['nullable', 'string', 'max:5000'],

            // Optional: put the new product straight into a sector.
            'initial_stock' => [$creating ? 'nullable' : 'prohibited', 'array'],
            'initial_stock.sector_id' => ['required_with:initial_stock', 'integer', 'exists:sectors,id'],
            'initial_stock.quantity' => ['required_with:initial_stock', 'numeric', 'gt:0', 'max:999999999'],
            'initial_stock.note' => ['nullable', 'string', 'max:255'],
            ...StockOperationRequest::dimensionRules('initial_stock.'),
        ];
    }

    public function messages(): array
    {
        return [
            'sku.unique' => 'Produkt o tym kodzie SKU już istnieje.',
        ];
    }
}
