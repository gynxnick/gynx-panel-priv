<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * subdomain_records — a server's claim on a subdomain under a parent zone.
 *
 * One server can hold multiple records (e.g. an A record + an SRV record
 * for Minecraft port-mapping), and we store the Cloudflare DNS record id
 * for each so we can update / delete cleanly later. Unique on
 * (zone_id, hostname, record_type) so a hostname can hold an A *and* an
 * SRV without a duplicate-row collision.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('subdomain_records', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('server_id');
            $table->unsignedBigInteger('zone_id');
            $table->string('hostname');                // "myserver" (relative to zone)
            $table->string('record_type', 10);         // "A", "AAAA", "SRV", "CNAME"
            $table->string('content');                 // the value Cloudflare stores
            $table->string('provider_record_id');      // CF record id
            $table->json('meta')->nullable();          // {priority, weight, port} for SRV etc.
            $table->timestamps();

            $table->unique(['zone_id', 'hostname', 'record_type'], 'subdomain_unique_per_zone');
            $table->index(['server_id'], 'subdomain_records_server');

            $table->foreign('server_id')
                ->references('id')->on('servers')
                ->cascadeOnDelete();
            $table->foreign('zone_id')
                ->references('id')->on('subdomain_zones')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subdomain_records');
    }
};
