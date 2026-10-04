<?php

namespace Modules\Users\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;
use Modules\Users\Http\Requests\UserRequest;
use Modules\Users\Http\Resources\UserResource;

class UserController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return UserResource::collection(User::query()->orderBy('name')->get());
    }

    public function store(UserRequest $request): UserResource
    {
        return new UserResource(User::create($request->validated()));
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user);
    }

    public function update(UserRequest $request, User $user): UserResource
    {
        $data = $request->validated();

        if (empty($data['password'])) {
            unset($data['password']);
        }

        if ($user->is($request->user())) {
            // An administrator cannot lock themselves out.
            if (isset($data['role']) && $data['role'] !== $user->role->value) {
                throw ValidationException::withMessages(['role' => 'Nie możesz zmienić własnej roli.']);
            }
            if (array_key_exists('is_active', $data) && ! $data['is_active']) {
                throw ValidationException::withMessages(['is_active' => 'Nie możesz dezaktywować własnego konta.']);
            }
        }

        $user->update($data);

        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        return new UserResource($user);
    }

    public function destroy(Request $request, User $user): Response
    {
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['user' => 'Nie możesz usunąć własnego konta.']);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->noContent();
    }
}
