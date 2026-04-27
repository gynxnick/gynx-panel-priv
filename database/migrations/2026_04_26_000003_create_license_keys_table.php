<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * license_keys — internal entitlement keys, similar to a Discord bot key
 * system. Admin-managed; each panel issues its own. Used to gate features
 * or impose per-key limits at the API level.
 *
 * Key string is unique; we generate it server-side as a 32-char URL-safe
 * token. Status uses a string enum so we can add states later without a
 * destructive migration.
 *
 * limits is JSON so admins can scope a key with arbitrary numeric
 * caps (max_servers, max_users, max_addons, etc.) without us pre-baking
 * a column per limit. The validating middleware reads whatever scope
 * it cares about and ignores unknown keys.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('license_keys', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('key', 64)->unique();
            $table->string('label')->nullable();
            $table->enum('status', ['active', 'revoked', 'expired'])->default('active');
            $table->timestamp('expires_at')->nullable();
            $table->json('limits')->nullable();
            $table->json('features')->nullable();
            $table->unsignedInteger('issued_by')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->unsignedInteger('use_count')->default(0);
            $table->timestamps();

            $table->index(['status', 'expires_at'], 'license_keys_status_expiry');

            $table->foreign('issued_by')
                ->references('id')->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('license_keys');
    }
};
