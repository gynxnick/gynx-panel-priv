<?php

namespace Pterodactyl\Notifications;

use Pterodactyl\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use Pterodactyl\Services\Mail\MailTemplateService;

class MailTested extends Notification
{
    public function __construct(private User $user)
    {
    }

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        return app(MailTemplateService::class)->build('mail_test', [
            'name' => $this->user->name,
        ]);
    }
}
