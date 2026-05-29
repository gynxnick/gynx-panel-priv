<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\Factory as ViewFactory;
use Illuminate\Support\Facades\Notification;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Notifications\MailTemplatePreview;
use Pterodactyl\Services\Mail\MailTemplateService;

/**
 * Admin UI for editing the panel's outgoing email templates. Each
 * notification (account_created / added_to_server / etc.) is shown as
 * a card with subject / greeting / body / action-button fields. Only
 * fields the admin actually changes are persisted, so adjusting the
 * panel's display name later still flows through to all unmodified
 * templates without manual fixups.
 *
 * Backed by MailTemplateService — see that file for the full default
 * copy + the placeholder vocabulary per template.
 */
class MailTemplatesController extends Controller
{
    public function __construct(
        private MailTemplateService $templates,
        private ViewFactory $view,
    ) {
    }

    public function index(): View
    {
        $rows = [];
        foreach (MailTemplateService::templateKeys() as $key) {
            $meta = MailTemplateService::templateMeta($key);
            $current = $this->templates->load($key);
            $rows[] = [
                'key' => $key,
                'label' => $meta['label'],
                'description' => $meta['description'],
                'placeholders' => $meta['placeholders'],
                'defaults' => array_intersect_key($meta, array_flip(MailTemplateService::EDITABLE_PARTS)),
                'current' => $current,
                'enabled' => $this->templates->isEnabled($key),
                'always_on' => in_array($key, MailTemplateService::ALWAYS_ON, true),
            ];
        }

        return $this->view->make('admin.settings.mail-templates', [
            'templates' => $rows,
        ]);
    }

    /**
     * Save a single template. The admin form posts one card at a time
     * so a typo in template A doesn't lose unsaved edits in B/C/D.
     */
    public function update(Request $request, string $key): Response
    {
        if (!in_array($key, MailTemplateService::templateKeys(), true)) {
            return response('Unknown template key.', 404);
        }

        $payload = $request->validate([
            'subject' => 'nullable|string|max:255',
            'greeting' => 'nullable|string|max:255',
            'lines' => 'nullable|string|max:8000',
            'action_label' => 'nullable|string|max:120',
            'action_url' => 'nullable|string|max:500',
        ]);

        $this->templates->save($key, $payload);

        return response('', 204);
    }

    /**
     * Reset a single template back to its hardcoded default by clearing
     * any DB overrides for that key.
     */
    public function reset(string $key): Response
    {
        if (!in_array($key, MailTemplateService::templateKeys(), true)) {
            return response('Unknown template key.', 404);
        }

        $this->templates->save($key, []);

        return response('', 204);
    }

    /**
     * Render the fully-branded HTML of a template (with synthetic sample
     * tokens) through the live notification view, so the admin can see
     * the actual email in an iframe. Reflects the currently-saved copy.
     */
    public function preview(string $key): Response
    {
        if (!in_array($key, MailTemplateService::templateKeys(), true)) {
            return response('Unknown template key.', 404);
        }

        $message = $this->templates->build($key, $this->templates->sampleContext($key));
        $html = $this->view->make('notifications::email', $message->data())->render();

        return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
    }

    /**
     * Send a real test email of this template to the authenticated admin
     * so they can verify rendering in an actual inbox. Sent immediately
     * (not queued) and bypasses the disabled-template kill-switch.
     */
    public function test(Request $request, string $key): Response
    {
        if (!in_array($key, MailTemplateService::templateKeys(), true)) {
            return response('Unknown template key.', 404);
        }

        try {
            Notification::route('mail', $request->user()->email)
                ->notify(new MailTemplatePreview($key));
        } catch (\Exception $exception) {
            return response($exception->getMessage(), 500);
        }

        return response('', 204);
    }

    /**
     * Enable or disable a template. ALWAYS_ON templates (password reset,
     * account creation, mail test) ignore the request server-side so an
     * admin can't accidentally strand users.
     */
    public function toggle(Request $request, string $key): Response
    {
        if (!in_array($key, MailTemplateService::templateKeys(), true)) {
            return response('Unknown template key.', 404);
        }

        $data = $request->validate(['enabled' => 'required|boolean']);
        $this->templates->setEnabled($key, (bool) $data['enabled']);

        return response('', 204);
    }
}
