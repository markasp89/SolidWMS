<?php

namespace Modules\Users\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\Password;
use Modules\Core\Enums\Role;

class UserRequest extends FormRequest
{
    public function rules(): array
    {
        $user = $this->route('user');
        $creating = $user === null;

        return [
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'email' => [
                $creating ? 'required' : 'sometimes',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user),
            ],
            'password' => [$creating ? 'required' : 'nullable', 'string', Password::min(8)],
            'role' => [$creating ? 'required' : 'sometimes', new Enum(Role::class)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
