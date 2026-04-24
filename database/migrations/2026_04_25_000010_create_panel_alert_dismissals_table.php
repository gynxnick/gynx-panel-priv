<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('panel_alert_dismissals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('alert_id');
            $table->unsignedInteger('user_id');
            $table->timestamp('dismissed_at')->useCurrent();

            $table->unique(['alert_id', 'user_id'], 'panel_alert_dismissals_unique');

            $table->foreign('alert_id')
                ->references('id')->on('panel_alerts')
                ->cascadeOnDelete();
            $table->foreign('user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('panel_alert_dismissals');
    }
};
