<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * subdomain_zones — admin-configured parent domains the panel can issue
 * subdomains under (e.g. "play.gynx.gg" with a Cloudflare zone token).
 *
 * The provider column is forward-looking; for now only "cloudflare" is
 * supported. Token is stored as the raw value because we need to send it
 * verbatim to the Cloudflare API; encryption-at-rest is the DB host's
 * responsibility (same as APP_KEY in .env, settings table secrets, etc.).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('subdomain_zones', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('label');                  // human-friendly, e.g. "Play"
            $table->string('domain');                 // "play.gynx.gg"
            $table->enum('provider', ['cloudflare']);
            $table->string('provider_zone_id');       // Cloudflare zone id
            $table->text('provider_token');           // scoped API token (Zone:DNS:Edit)
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->unique('domain');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subdomain_zones');
    }
};
