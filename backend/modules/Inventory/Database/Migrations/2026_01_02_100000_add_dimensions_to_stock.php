<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A stock location is identified by product + sector plus optional
 * dimensions used by optional modules: slot (shelf/level/bin), batch,
 * expiry date and pallet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropUnique(['product_id', 'sector_id']);
            $table->string('slot', 32)->nullable()->after('sector_id');
            $table->string('batch', 64)->nullable()->after('slot');
            $table->date('expires_at')->nullable()->after('batch')->index();
            $table->unsignedBigInteger('pallet_id')->nullable()->after('expires_at')->index();
            $table->index(['product_id', 'sector_id']);
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->string('slot', 32)->nullable()->after('to_sector_id');
            $table->string('batch', 64)->nullable()->after('slot');
            $table->unsignedBigInteger('pallet_id')->nullable()->after('batch')->index();
            // Business reference, e.g. a document number "PZ/2026/10/0001".
            $table->string('reference', 64)->nullable()->after('note')->index();
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropIndex(['pallet_id']);
            $table->dropIndex(['reference']);
            $table->dropColumn(['slot', 'batch', 'pallet_id', 'reference']);
        });

        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropIndex(['product_id', 'sector_id']);
            $table->dropIndex(['expires_at']);
            $table->dropIndex(['pallet_id']);
            $table->dropColumn(['slot', 'batch', 'expires_at', 'pallet_id']);
            $table->unique(['product_id', 'sector_id']);
        });
    }
};
