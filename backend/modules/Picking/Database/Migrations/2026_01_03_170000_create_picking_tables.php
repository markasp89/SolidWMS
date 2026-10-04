<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pick_lists', function (Blueprint $table) {
            $table->id();
            $table->string('number', 32)->unique();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->string('status', 16)->default('open'); // open | completed | cancelled
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('pick_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pick_list_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sequence');
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('stock_item_id')->nullable();
            $table->foreignId('sector_id')->nullable()->constrained()->nullOnDelete();
            $table->string('slot', 32)->nullable();
            $table->string('batch', 64)->nullable();
            $table->date('expires_at')->nullable();
            $table->decimal('quantity', 14, 3);
            $table->decimal('picked', 14, 3)->default(0);
            $table->string('status', 16)->default('pending'); // pending | picked | short
            $table->foreignId('picked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('picked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pick_lines');
        Schema::dropIfExists('pick_lists');
    }
};
