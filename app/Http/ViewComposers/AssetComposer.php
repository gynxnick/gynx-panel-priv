<?php

namespace Pterodactyl\Http\ViewComposers;

use Illuminate\View\View;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Http\Controllers\Admin\BrandingController;
use Pterodactyl\Services\Helpers\AssetHashService;

class AssetComposer
{
    public function __construct(
        private AssetHashService $assetHashService,
        private SettingsRepositoryInterface $settings,
    ) {
    }

    public function compose(View $view): void
    {
        $view->with('asset', $this->assetHashService);

        // Resolve branding overrides; fall back to each field's default.
        $branding = [];
        foreach (BrandingController::KEYS as $key => $meta) {
            $branding[$key] = (string) $this->settings->get("settings::gynx:{$key}", $meta['default']);
        }

        $view->with('siteConfiguration', [
            'name' => config('app.name') ?? 'Pterodactyl',
            'locale' => config('app.locale') ?? 'en',
            'recaptcha' => [
                'enabled' => config('recaptcha.enabled', false),
                'siteKey' => config('recaptcha.website_key') ?? '',
            ],
            // Back-compat top-level field — frontend's brand() helper
            // prefers branding.logoUrl over this.
            'logoUrl' => $branding['logo_url'] ?? null,
            'branding' => [
                'siteName' => $branding['site_name'] ?? null,
                'tagline' => $branding['tagline'] ?? null,
                'logoUrl' => $branding['logo_url'] ?? null,
                'authLede' => $branding['auth_lede'] ?? null,
                'authTaglines' => array_values(array_filter([
                    $branding['auth_tagline_1'] ?? null,
                    $branding['auth_tagline_2'] ?? null,
                    $branding['auth_tagline_3'] ?? null,
                    $branding['auth_tagline_4'] ?? null,
                    $branding['auth_tagline_5'] ?? null,
                ])),
                'footerCopy' => $branding['footer_copy'] ?? null,
                'dashboardEmptyTitle' => $branding['dashboard_empty_title'] ?? null,
                'dashboardEmptyBody' => $branding['dashboard_empty_body'] ?? null,
            ],
        ]);
    }
}
