<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(['email' => 'admin@solidwms.local'], [
            'name' => 'Administrator',
            'password' => 'password',
            'role' => 'admin',
            'is_active' => true,
        ]);

        User::updateOrCreate(['email' => 'pracownik@solidwms.local'], [
            'name' => 'Jan Pracownik',
            'password' => 'password',
            'role' => 'worker',
            'is_active' => true,
        ]);

        $this->call(DemoWarehouseSeeder::class);
    }
}
