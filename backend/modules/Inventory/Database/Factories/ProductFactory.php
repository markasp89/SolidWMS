<?php

namespace Modules\Inventory\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Inventory\Models\Product;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'sku' => strtoupper(fake()->unique()->bothify('SKU-#####')),
            'name' => ucfirst(fake()->words(3, true)),
            'barcode' => fake()->ean13(),
            'unit' => 'szt',
        ];
    }
}
