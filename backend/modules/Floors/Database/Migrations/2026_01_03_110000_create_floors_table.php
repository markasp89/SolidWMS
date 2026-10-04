<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Additional floors / halls of a warehouse, each with its own plan.
        // Sectors without floor belong to the warehouse's main plan.
        Schema::create('floors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->integer('level')->default(1);
            $table->string('floor_plan_path')->nullable();
            $table->unsignedInteger('floor_plan_width')->nullable();
            $table->unsignedInteger('floor_plan_height')->nullable();
            $table->timestamps();
        });

        Schema::table('sectors', function (Blueprint $table) {
            $table->foreignId('floor_id')->nullable()->after('warehouse_id')->constrained('floors')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sectors', function (Blueprint $table) {
            $table->dropConstrainedForeignId('floor_id');
        });
        Schema::dropIfExists('floors');
    }
};
