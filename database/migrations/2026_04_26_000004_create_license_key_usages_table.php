<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * license_key_usages — append-only log of validation attempts against
 * each key. The KeyService trims this to a configurable ring buffer
 * per key so the table doesn't grow unbounded; for a single-panel
 * deployment we don't need every historical hit.
 *
 * Stored fields are deliberately minimal — IP + UA + scope is enough
 * for "where is this key being used from" admin diagnostics without
 * being a privacy concern.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('license_key_usages', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('license_key_id');
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('scope', 64)->nullable();   // optional: which feature was being checked
            $table->boolean('accepted')->default(true);
            $table->timestamp('used_at')->useCurrent();

            $table->index(['license_key_id', 'used_at'], 'license_key_usages_recent');

            $table->foreign('license_key_id')
                ->references('id')->on('license_keys')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('license_key_usages');
    }
};
