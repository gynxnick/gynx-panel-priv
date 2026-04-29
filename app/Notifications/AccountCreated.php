<?php

namespace Pterodactyl\Notifications;

use Pterodactyl\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Pterodactyl\Services\Mail\MailTemplateService;

class AccountCreated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public User $user, public ?string $token = null)
    {
    }

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        $context = [
            'name' => $this->user->name,
            'username' => $this->user->username,
            'email' => $this->user->email,
        ];

        // The action button only renders when the template's
        // action_url placeholder resolves to a non-empty value.
        // Including the token-derived URL only when one exists keeps
        // the legacy "no button when no token" semantics.
        $context['action_url'] = $this->token === null
            ? ''
            : url('/auth/password/reset/' . $this->token . '?email=' . urlencode($this->user->email));

        return app(MailTemplateService::class)->build('account_created', $context);
    }
}
