<?php

namespace Modules\Warehouses\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Warehouses\Models\Warehouse;

/** @extends Factory<Warehouse> */
class WarehouseFactory extends Factory
{
    protected $model = Warehouse::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper(fake()->unique()->bothify('MAG-##??')),
            'name' => 'Magazyn '.fake()->city(),
            'address' => fake()->address(),
        ];
    }
}
