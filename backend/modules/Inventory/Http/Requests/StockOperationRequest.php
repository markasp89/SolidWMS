<?php

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Shared validation for stock operations. The route name decides which fields are needed.
 */
class StockOperationRequest extends FormRequest
{
    /** Optional location dimensions (used by the slots and batches modules). */
    public static function dimensionRules(string $prefix = ''): array
    {
        return [
            $prefix.'slot' => ['nullable', 'string', 'max:32', 'regex:/^[A-Za-z0-9_.\-\/ ]+$/'],
            $prefix.'batch' => ['nullable', 'string', 'max:64'],
            $prefix.'expires_at' => ['nullable', 'date'],
        ];
    }

    public function rules(): array
    {
        $quantity = ['required', 'numeric', 'gt:0', 'max:999999999'];
        $note = ['nullable', 'string', 'max:255'];

        return match ($this->route()->getName()) {
            'stock.receive' => [
                'product_id' => ['required', 'integer', 'exists:products,id'],
                'sector_id' => ['required', 'integer', 'exists:sectors,id'],
                'quantity' => $quantity,
                'note' => $note,
                ...self::dimensionRules(),
            ],
            'stock.issue' => [
                'quantity' => $quantity,
                'note' => $note,
            ],
            'stock.move' => [
                'to_sector_id' => ['required', 'integer', 'exists:sectors,id'],
                'to_slot' => ['nullable', 'string', 'max:32', 'regex:/^[A-Za-z0-9_.\-\/ ]+$/'],
                'quantity' => $quantity,
                'note' => $note,
            ],
            'stock.update' => [
                'quantity' => ['sometimes', 'numeric', 'gte:0', 'max:999999999'],
                'note' => ['sometimes', 'nullable', 'string', 'max:255'],
            ],
            default => [],
        };
    }

    public function messages(): array
    {
        return ['slot.regex' => 'Miejsce może zawierać litery, cyfry oraz znaki - _ . /', 'to_slot.regex' => 'Miejsce może zawierać litery, cyfry oraz znaki - _ . /'];
    }
}
