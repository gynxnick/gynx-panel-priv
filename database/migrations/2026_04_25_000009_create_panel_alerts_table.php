<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('panel_alerts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->enum('scope', ['panel', 'node'])->default('panel');
            $table->unsignedInteger('node_id')->nullable();
            $table->enum('severity', ['info', 'warn', 'maint', 'critical'])->default('info');
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('link_url', 2048)->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('dismissible')->default(true);
            $table->unsignedInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['scope', 'node_id', 'starts_at', 'ends_at'], 'panel_alerts_active_window');

            $table->foreign('node_id')
                ->references('id')->on('nodes')
                ->nullOnDelete();
            $table->foreign('created_by')
                ->references('id')->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('panel_alerts');
    }
};
