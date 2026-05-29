<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('partner_modpacks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('title');
            $table->text('summary')->nullable();
            $table->string('banner_url', 2048)->nullable();
            // Provider the install pipeline resolves against (reuses the
            // existing modpack installer — see ModpackInstallerService).
            $table->enum('source', ['modrinth', 'curseforge']);
            $table->string('external_id');
            $table->string('version_id')->nullable();
            $table->string('game_version')->nullable();
            // Optional brand accent (hex) for the card; null = brand purple.
            $table->string('accent', 9)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_visible')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->timestamps();

            $table->index(['is_visible', 'sort_order'], 'partner_modpacks_visible_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_modpacks');
    }
};
