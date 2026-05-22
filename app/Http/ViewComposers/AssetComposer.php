<?php

namespace Pterodactyl\Http\ViewComposers;

use Illuminate\View\View;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Http\Controllers\Admin\BrandingController;
use Pterodactyl\Http\Controllers\Admin\DiscordTextController;
use Pterodactyl\Services\Helpers\AssetHashService;
use Pterodactyl\Services\Licensing\LicenseClientService;

class AssetComposer
{
    public function __construct(
        private AssetHashService $assetHashService,
        private SettingsRepositoryInterface $settings,
        private LicenseClientService $licenses,
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

        // Discord copy / integration text. Same pattern as branding but
        // namespaced under settings::gynx:discord:* — see DiscordTextController.
        $discord = [];
        foreach (DiscordTextController::KEYS as $key => $meta) {
            $discord[$key] = (string) $this->settings->get("settings::gynx:discord:{$key}", $meta['default']);
        }

        // Prefer the admin-set Branding siteName, falling back to APP_NAME
        // and finally a literal 'gynx panel'. The frontend reads this as
        // SiteConfiguration.name (legacy field — newer code reads from
        // SiteConfiguration.branding.siteName via the brand() helper).
        $name = $branding['site_name'] ?? config('app.name') ?? 'gynx panel';

        $view->with('siteConfiguration', [
            'name' => $name,
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
                'modpackInstallWarning' => $branding['modpack_install_warning'] ?? null,
            ],
            // Discord text — drives DiscordCta and (eventually) any
            // webhook/embed UIs. See DiscordTextController::KEYS for the
            // canonical field list.
            //
            // NOTE: webhook_url is intentionally NOT shipped — webhook
            // URLs are credentials (anyone with the URL can post to the
            // channel). Only a boolean configured flag is exposed so the
            // SPA can show whether a webhook is in place. The actual URL
            // stays server-side and is only used by server-side senders.
            'discord' => [
                'ctaEnabled' => ($discord['cta_enabled'] ?? '1') === '1',
                'ctaTitle' => $discord['cta_title'] ?? null,
                'ctaSubtitle' => $discord['cta_subtitle'] ?? null,
                'ctaButtonLabel' => $discord['cta_button_label'] ?? null,
                'inviteUrl' => $discord['invite_url'] ?? null,
                'webhookConfigured' => ($discord['webhook_url'] ?? '') !== '',
                'noticeTemplate' => $discord['notice_template'] ?? null,
            ],
            // Surface license status to the React bundle so it can render a
            // warning banner / lockdown UI when the panel's license is
            // invalid. We DON'T expose the key itself — only the resolved
            // status. status() is a pure cache read; no upstream call here.
            'license' => $this->licenseSnapshot(),
        ]);
    }

    private function licenseSnapshot(): array
    {
        try {
            $s = $this->licenses->status();
        } catch (\Throwable $e) {
            // Settings repo / DB hiccup at compose time shouldn't break page render.
            return ['status' => 'unreachable', 'message' => null];
        }
        return [
            'status' => $s['status'] ?? 'unlicensed',
            'plan' => $s['plan'] ?? null,
            'expiresAt' => $s['expires_at'] ?? null,
            'message' => $s['message'] ?? null,
            'reason' => $s['reason'] ?? null,
        ];
    }
}
