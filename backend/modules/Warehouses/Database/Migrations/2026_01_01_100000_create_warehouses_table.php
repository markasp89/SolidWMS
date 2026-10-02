<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->string('address')->nullable();
            $table->text('description')->nullable();
            $table->string('floor_plan_path')->nullable();
            $table->unsignedInteger('floor_plan_width')->nullable();
            $table->unsignedInteger('floor_plan_height')->nullable();
            $table->timestamps();
        });

        Schema::create('sectors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name');
            $table->string('color', 7)->default('#2563eb');
            $table->text('description')->nullable();
            // Polygon in coordinates normalised to the floor plan (0..1): [[x, y], ...]
            $table->json('shape')->nullable();
            $table->timestamps();

            $table->unique(['warehouse_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sectors');
        Schema::dropIfExists('warehouses');
    }
};
