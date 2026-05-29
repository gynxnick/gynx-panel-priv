<?php

namespace Pterodactyl\Listeners\Notification;

use Illuminate\Notifications\Events\NotificationSending;
use Pterodactyl\Services\Mail\MailTemplateService;

/**
 * Kill-switch for admin-disabled email templates.
 *
 * Returning false from a NotificationSending listener cancels the send
 * before it reaches the transport, so an admin can switch off a
 * non-critical template (e.g. "added to server") from the Mail
 * Templates page without touching any notification class.
 *
 * Fail-open by design: if the template can't be resolved or the
 * settings lookup throws, the notification is allowed through — we
 * never silently drop mail because of a bookkeeping error.
 */
class CancelDisabledMailTemplate
{
    public function __construct(private MailTemplateService $templates)
    {
    }

    public function handle(NotificationSending $event): bool
    {
        // Only mail; other channels (if any) are unaffected.
        if ($event->channel !== 'mail') {
            return true;
        }

        try {
            $key = MailTemplateService::NOTIFICATION_MAP[get_class($event->notification)] ?? null;
            if ($key === null) {
                return true;
            }

            return $this->templates->isEnabled($key);
        } catch (\Throwable $e) {
            return true;
        }
    }
}
