<?php

namespace Modules\Warehouses\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Warehouses\Models\Sector;
use Modules\Warehouses\Models\Warehouse;

/** @extends Factory<Sector> */
class SectorFactory extends Factory
{
    protected $model = Sector::class;

    public function definition(): array
    {
        $x = fake()->randomFloat(3, 0, 0.8);
        $y = fake()->randomFloat(3, 0, 0.8);

        return [
            'warehouse_id' => Warehouse::factory(),
            'code' => strtoupper(fake()->unique()->bothify('?##')),
            'name' => 'Sektor '.fake()->word(),
            'color' => fake()->hexColor(),
            'shape' => [[$x, $y], [$x + 0.15, $y], [$x + 0.15, $y + 0.15], [$x, $y + 0.15]],
        ];
    }
}
