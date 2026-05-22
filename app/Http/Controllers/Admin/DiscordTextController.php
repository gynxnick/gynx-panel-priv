<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Illuminate\View\Factory as ViewFactory;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Http\Controllers\Controller;

/**
 * Discord text / integration copy.
 *
 * Mirrors the BrandingController shape: every editable string lives as
 * a row in the settings table under settings::gynx:discord:* and ships
 * to the React bundle via AssetComposer so the frontend can render
 * without an extra API call.
 *
 * Today this drives the DiscordCta card on the server console page.
 * As future Discord features (webhook notifications, embed builders,
 * status hooks) land, new keys are added to KEYS and the consumer
 * components opt in by reading from SiteConfiguration.discord.
 */
class DiscordTextController extends Controller
{
    public const KEYS = [
        'cta_enabled'      => ['label' => 'Show the Discord CTA card',          'default' => '1',                                                                                       'max' => 1,    'type' => 'bool'],
        'cta_title'        => ['label' => 'CTA title',                          'default' => 'Join the gynx Discord',                                                                   'max' => 80,   'type' => 'text'],
        'cta_subtitle'     => ['label' => 'CTA subtitle',                       'default' => 'Live support, mod recommendations, and the place we drop status updates first.',          'max' => 300,  'type' => 'text'],
        'cta_button_label' => ['label' => 'CTA button label',                   'default' => 'Join',                                                                                    'max' => 32,   'type' => 'text'],
        'invite_url'       => ['label' => 'Discord invite URL',                 'default' => 'https://discord.gg/gynx',                                                                 'max' => 2048, 'type' => 'url'],

        // Reserved for future Discord webhook / embed features. Stored
        // now so the admin page is ready when the consumer lands; until
        // then nothing reads them.
        'webhook_url'      => ['label' => 'Webhook URL (reserved, not used yet)',                                  'default' => '', 'max' => 2048, 'type' => 'url'],
        'notice_template'  => ['label' => 'Notification embed template (reserved, not used yet)',                  'default' => '', 'max' => 2000, 'type' => 'textarea'],
    ];

    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view,
        protected SettingsRepositoryInterface $settings,
    ) {
    }

    public function index(): View
    {
        $values = [];
        foreach (self::KEYS as $key => $meta) {
            $values[$key] = (string) $this->settings->get("settings::gynx:discord:{$key}", $meta['default']);
        }

        return $this->view->make('admin.discord.index', [
            'fields' => self::KEYS,
            'values' => $values,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        foreach (self::KEYS as $key => $meta) {
            $raw = $request->input($key);

            // For bool fields, the absence of the field name in the POST
            // body means "off" (since unchecked checkboxes don't submit).
            // For everything else, null means "skip" so partial saves work.
            if ($meta['type'] === 'bool') {
                $value = $raw ? '1' : '0';
            } else {
                if ($raw === null) continue;
                $value = is_string($raw) ? trim($raw) : '';
                $max = $meta['max'] ?? 500;
                if (strlen($value) > $max) {
                    $value = substr($value, 0, $max);
                }
                if ($meta['type'] === 'url' && $value !== '' && !filter_var($value, FILTER_VALIDATE_URL)) {
                    $this->alert->danger("'{$meta['label']}' is not a valid URL — saved other fields.")->flash();
                    continue;
                }
            }

            // Empty non-bool string = restore default so frontend + backend
            // agree on the baseline. Bools persist as literal '0' / '1'.
            $toStore = ($meta['type'] !== 'bool' && $value === '')
                ? $meta['default']
                : $value;

            $this->settings->set("settings::gynx:discord:{$key}", $toStore);
        }

        $this->alert->success('Discord text updated.')->flash();
        return redirect()->route('admin.discord.index');
    }

    public function reset(): RedirectResponse
    {
        foreach (self::KEYS as $key => $meta) {
            $this->settings->set("settings::gynx:discord:{$key}", $meta['default']);
        }

        $this->alert->success('Discord text reset to defaults.')->flash();
        return redirect()->route('admin.discord.index');
    }
}
