<?php

namespace Pterodactyl\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Pterodactyl\Services\Mail\MailTemplateService;

class RemovedFromServer extends Notification implements ShouldQueue
{
    use Queueable;

    public object $server;

    public function __construct(array $server)
    {
        $this->server = (object) $server;
    }

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        return app(MailTemplateService::class)->build('removed_from_server', [
            'name' => $this->server->user,
            'server_name' => $this->server->name,
            'action_url' => route('index'),
        ])->error();
    }
}
