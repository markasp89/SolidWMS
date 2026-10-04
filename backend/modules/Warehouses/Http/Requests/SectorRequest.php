<?php

namespace Modules\Warehouses\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Warehouses\Models\Sector;

class SectorRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtoupper(trim((string) $this->input('code')))]);
        }
    }

    public function rules(): array
    {
        /** @var Sector|null $sector */
        $sector = $this->route('sector');
        $warehouseId = $sector?->warehouse_id ?? $this->route('warehouse')?->id;
        $creating = $sector === null;

        return [
            'code' => [
                $creating ? 'required' : 'sometimes',
                'string',
                'max:32',
                'regex:/^[A-Z0-9_.\-]+$/',
                Rule::unique('sectors', 'code')->where('warehouse_id', $warehouseId)->ignore($sector),
            ],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'color' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'description' => ['nullable', 'string', 'max:5000'],
            // Floor of the warehouse (module "floors"); null = main floor plan.
            'floor_id' => ['nullable', 'integer', Rule::exists('floors', 'id')->where('warehouse_id', $warehouseId)],
            'shape' => ['nullable', 'array', 'min:3', 'max:500'],
            'shape.*' => ['array', 'size:2'],
            'shape.*.*' => ['numeric', 'between:0,1'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'Sektor o tym kodzie już istnieje w tym magazynie.',
            'code.regex' => 'Kod może zawierać tylko wielkie litery, cyfry oraz znaki _ . -',
            'shape.min' => 'Obszar sektora musi mieć co najmniej 3 punkty.',
        ];
    }
}
