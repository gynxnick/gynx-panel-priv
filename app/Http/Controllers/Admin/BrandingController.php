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
 * Branding / editable panel text.
 *
 * All fields are stored as single-key entries in the settings table
 * under the `settings::gynx:*` namespace. They're loaded into the
 * React bundle via SiteConfiguration so the frontend can render them
 * without extra API calls.
 */
class BrandingController extends Controller
{
    public const KEYS = [
        'site_name'         => ['label' => 'Site name',            'default' => 'gynx.gg',                                                           'max' => 100],
        'tagline'           => ['label' => 'Sidebar tagline',      'default' => 'host smarter. play harder.',                                         'max' => 140],
        'logo_url'          => ['label' => 'Logo URL (optional)',  'default' => '',                                                                    'max' => 2048],
        'auth_lede'         => ['label' => 'Login page lede',      'default' => 'manage your game servers with speed and control.',                   'max' => 200],
        'auth_tagline_1'    => ['label' => 'Auth tagline 1',       'default' => 'host smarter. play harder.',                                         'max' => 120],
        'auth_tagline_2'    => ['label' => 'Auth tagline 2',       'default' => 'your server, fully unleashed.',                                       'max' => 120],
        'auth_tagline_3'    => ['label' => 'Auth tagline 3',       'default' => 'performance without compromise.',                                     'max' => 120],
        'auth_tagline_4'    => ['label' => 'Auth tagline 4',       'default' => 'where your world runs better.',                                       'max' => 120],
        'auth_tagline_5'    => ['label' => 'Auth tagline 5',       'default' => 'powering your worlds — instantly, reliably.',                        'max' => 120],
        'footer_copy'       => ['label' => 'Footer copy',          'default' => '',                                                                    'max' => 200],
        'dashboard_empty_title' => ['label' => 'Dashboard empty-state title', 'default' => 'No servers yet',                                          'max' => 100],
        'dashboard_empty_body'  => ['label' => 'Dashboard empty-state body',  'default' => 'Ask your admin for a deployment, or contact support.',   'max' => 300],
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
            $values[$key] = (string) $this->settings->get("settings::gynx:{$key}", $meta['default']);
        }

        return $this->view->make('admin.branding.index', [
            'fields' => self::KEYS,
            'values' => $values,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        foreach (self::KEYS as $key => $meta) {
            $value = $request->input($key);
            if ($value === null) continue;

            $value = is_string($value) ? trim($value) : '';
            $max = $meta['max'] ?? 500;
            if (strlen($value) > $max) {
                $value = substr($value, 0, $max);
            }

            if ($key === 'logo_url' && $value !== '' && !filter_var($value, FILTER_VALIDATE_URL)) {
                $this->alert->danger("Logo URL is not a valid URL — saved other fields.")->flash();
                continue;
            }

            // Empty string means "restore default" — store the default so
            // frontend + backend agree on the baseline.
            $toStore = $value === '' ? $meta['default'] : $value;
            $this->settings->set("settings::gynx:{$key}", $toStore);
        }

        $this->alert->success('Branding updated.')->flash();
        return redirect()->route('admin.branding.index');
    }

    public function reset(): RedirectResponse
    {
        foreach (self::KEYS as $key => $meta) {
            $this->settings->set("settings::gynx:{$key}", $meta['default']);
        }

        $this->alert->success('Branding reset to defaults.')->flash();
        return redirect()->route('admin.branding.index');
    }
}
