<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_log_in_and_fetch_profile(): void
    {
        $user = User::factory()->admin()->create(['password' => 'secret123']);

        $token = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'secret123'])
            ->assertOk()
            ->assertJsonPath('user.role', 'admin')
            ->json('token');

        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('email', $user->email);
    }

    public function test_wrong_password_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'nope'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_inactive_user_cannot_log_in_and_tokens_stop_working(): void
    {
        $user = User::factory()->create(['password' => 'secret123']);
        $token = $user->createToken('web')->plainTextToken;

        $user->update(['is_active' => false]);

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'secret123'])
            ->assertUnprocessable();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_worker_cannot_manage_users(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/users')->assertForbidden();
    }

    public function test_admin_cannot_delete_or_demote_themselves(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->deleteJson("/api/users/{$admin->id}")->assertUnprocessable();
        $this->actingAs($admin)->patchJson("/api/users/{$admin->id}", ['role' => 'worker'])->assertUnprocessable();
        $this->actingAs($admin)->postJson('/api/users', [
            'name' => 'Nowy', 'email' => 'nowy@example.com', 'password' => 'password1', 'role' => 'worker',
        ])->assertCreated()->assertJsonPath('role', 'worker');
    }
}
