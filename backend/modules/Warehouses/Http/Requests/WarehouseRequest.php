<?php

namespace Modules\Warehouses\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WarehouseRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtoupper(trim((string) $this->input('code')))]);
        }
    }

    public function rules(): array
    {
        $creating = $this->route('warehouse') === null;

        return [
            'code' => [
                $creating ? 'required' : 'sometimes',
                'string',
                'max:32',
                'regex:/^[A-Z0-9_.\-]+$/',
                Rule::unique('warehouses', 'code')->ignore($this->route('warehouse')),
            ],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.regex' => 'Kod może zawierać tylko wielkie litery, cyfry oraz znaki _ . -',
        ];
    }
}
