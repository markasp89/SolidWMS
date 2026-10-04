<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('type', 4)->index();             // PZ | WZ
            $table->string('number', 32)->unique();          // PZ/2026/10/0001
            $table->string('status', 16)->default('draft');  // draft | posted
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->string('counterparty')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('document_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position');
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 14, 3);
            // PZ: target place. WZ: optional source location (empty = FEFO allocation).
            $table->foreignId('sector_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('stock_item_id')->nullable();
            $table->string('slot', 32)->nullable();
            $table->string('batch', 64)->nullable();
            $table->date('expires_at')->nullable();
            $table->string('note')->nullable();
            // Where the goods actually went/came from, filled in when posting.
            $table->json('posted_locations')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_lines');
        Schema::dropIfExists('documents');
    }
};
