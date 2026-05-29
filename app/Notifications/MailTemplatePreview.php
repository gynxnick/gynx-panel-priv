<?php

namespace Pterodactyl\Notifications;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use Pterodactyl\Services\Mail\MailTemplateService;

/**
 * On-demand test send for a single mail template. Fired by the admin
 * "Send test" button on the Mail Templates page so staff can see the
 * fully-branded result in a real inbox.
 *
 * Builds the exact same MailMessage the live notification would, using
 * synthetic sample tokens. NOT queued (the admin is waiting on it) and
 * intentionally absent from MailTemplateService::NOTIFICATION_MAP so the
 * disabled-template kill-switch never suppresses a test the admin asked
 * for.
 */
class MailTemplatePreview extends Notification
{
    public function __construct(private string $key)
    {
    }

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        $service = app(MailTemplateService::class);

        return $service->build($this->key, $service->sampleContext($this->key));
    }
}
