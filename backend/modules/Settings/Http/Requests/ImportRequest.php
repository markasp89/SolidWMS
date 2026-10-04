<?php

namespace Modules\Settings\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use Modules\Settings\Services\DataTransferService;

class ImportRequest extends FormRequest
{
    public function rules(): array
    {
        $code = ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9_.\-]+$/'];

        return [
            'mode' => ['required', 'in:merge,replace'],
            'data' => ['required', 'array'],
            'data.format' => ['nullable', 'in:'.DataTransferService::FORMAT],
            'data.version' => ['required', 'integer', 'in:'.implode(',', DataTransferService::SUPPORTED_VERSIONS)],

            'data.warehouses' => ['present', 'array'],
            'data.warehouses.*.code' => [...$code, 'distinct:ignore_case'],
            'data.warehouses.*.name' => ['required', 'string', 'max:255'],
            'data.warehouses.*.address' => ['nullable', 'string', 'max:255'],
            'data.warehouses.*.description' => ['nullable', 'string', 'max:5000'],
            'data.warehouses.*.floor_plan' => ['nullable', 'array'],
            'data.warehouses.*.floor_plan.data' => ['nullable', 'string'],
            'data.warehouses.*.floors' => ['nullable', 'array'],
            'data.warehouses.*.floors.*.name' => ['required', 'string', 'max:100', 'distinct'],
            'data.warehouses.*.floors.*.level' => ['nullable', 'integer', 'between:-10,200'],
            'data.warehouses.*.floors.*.floor_plan' => ['nullable', 'array'],
            'data.warehouses.*.floors.*.floor_plan.data' => ['nullable', 'string'],
            'data.warehouses.*.sectors' => ['nullable', 'array'],
            'data.warehouses.*.sectors.*.floor' => ['nullable', 'string', 'max:100'],
            'data.warehouses.*.sectors.*.code' => $code,
            'data.warehouses.*.sectors.*.name' => ['required', 'string', 'max:255'],
            'data.warehouses.*.sectors.*.color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'data.warehouses.*.sectors.*.description' => ['nullable', 'string', 'max:5000'],
            'data.warehouses.*.sectors.*.shape' => ['nullable', 'array', 'min:3', 'max:500'],
            'data.warehouses.*.sectors.*.shape.*' => ['array', 'size:2'],
            'data.warehouses.*.sectors.*.shape.*.*' => ['numeric', 'between:0,1'],

            'data.products' => ['present', 'array'],
            'data.products.*.sku' => ['required', 'string', 'max:64', 'distinct:ignore_case'],
            'data.products.*.name' => ['required', 'string', 'max:255'],
            'data.products.*.barcode' => ['nullable', 'string', 'max:64'],
            'data.products.*.unit' => ['nullable', 'string', 'max:16'],
            'data.products.*.description' => ['nullable', 'string', 'max:5000'],
            'data.products.*.min_quantity' => ['nullable', 'numeric', 'gte:0'],

            'data.pallets' => ['nullable', 'array'],
            'data.pallets.*.code' => ['required', 'string', 'max:32', 'distinct:ignore_case'],
            'data.pallets.*.warehouse_code' => ['nullable', 'string', 'max:32'],
            'data.pallets.*.sector_code' => ['nullable', 'required_with:data.pallets.*.warehouse_code', 'string', 'max:32'],
            'data.pallets.*.slot' => ['nullable', 'string', 'max:32'],
            'data.pallets.*.note' => ['nullable', 'string', 'max:255'],

            'data.stock' => ['present', 'array'],
            'data.stock.*.sku' => ['required', 'string', 'max:64'],
            'data.stock.*.warehouse_code' => ['required', 'string', 'max:32'],
            'data.stock.*.sector_code' => ['required', 'string', 'max:32'],
            'data.stock.*.quantity' => ['required', 'numeric', 'gte:0', 'max:999999999'],
            'data.stock.*.note' => ['nullable', 'string', 'max:255'],
            'data.stock.*.slot' => ['nullable', 'string', 'max:32'],
            'data.stock.*.batch' => ['nullable', 'string', 'max:64'],
            'data.stock.*.expires_at' => ['nullable', 'date'],
            'data.stock.*.pallet' => ['nullable', 'string', 'max:32'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                // Sector codes must be unique within their warehouse.
                foreach ((array) $this->input('data.warehouses', []) as $w => $warehouse) {
                    $seen = [];
                    foreach ((array) ($warehouse['sectors'] ?? []) as $s => $sector) {
                        $code = strtoupper((string) ($sector['code'] ?? ''));
                        if ($code !== '' && isset($seen[$code])) {
                            $validator->errors()->add("data.warehouses.$w.sectors.$s.code", "Zduplikowany kod sektora {$code}.");
                        }
                        $seen[$code] = true;
                    }
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'data.version.in' => 'Nieobsługiwana wersja pliku eksportu.',
            'data.format.in' => 'To nie jest plik eksportu SolidWMS.',
        ];
    }
}
