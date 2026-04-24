<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('addon_modpacks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('server_id');
            $table->enum('source', ['modrinth', 'hangar', 'spigot', 'curseforge']);
            $table->string('external_id');
            $table->string('slug')->nullable();
            $table->string('name');
            $table->string('version')->nullable();
            $table->string('file_name');
            $table->string('file_hash', 128)->nullable();
            $table->enum('status', ['downloaded', 'extracted', 'failed'])->default('downloaded');
            $table->timestamp('installed_at')->useCurrent();
            $table->unsignedInteger('installed_by');

            $table->unique(['server_id', 'source', 'external_id'], 'addon_modpacks_unique');
            $table->index(['server_id', 'installed_at'], 'addon_modpacks_server_recent');

            $table->foreign('server_id')
                ->references('id')->on('servers')
                ->cascadeOnDelete();
            $table->foreign('installed_by')
                ->references('id')->on('users')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addon_modpacks');
    }
};
