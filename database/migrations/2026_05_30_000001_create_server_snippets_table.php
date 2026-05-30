<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('server_snippets', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('server_id');
            $table->string('name', 120);
            // Where this snippet typically applies — used to filter the
            // editor's "Templates" picker so only relevant ones show up
            // for the open file. Nullable for general-purpose snippets.
            $table->string('path_hint', 512)->nullable();
            // Catalogued format ('yaml' / 'json' / 'properties' / 'toml'
            // / 'ini' / 'xml' / 'plain') — used for the same filtering.
            // Nullable for format-agnostic snippets.
            $table->string('format', 16)->nullable();
            $table->longText('content');
            $table->timestamps();

            $table->index(['server_id', 'format'], 'server_snippets_server_format');
            $table->index(['server_id', 'path_hint'], 'server_snippets_server_path');

            $table->foreign('server_id')
                ->references('id')->on('servers')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_snippets');
    }
};
