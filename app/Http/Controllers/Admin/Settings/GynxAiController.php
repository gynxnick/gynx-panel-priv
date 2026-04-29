<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;

use Illuminate\View\View;
use Illuminate\Http\Response;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Illuminate\Contracts\Encryption\Encrypter;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Providers\SettingsServiceProvider;
use Pterodactyl\Services\Ai\AiProvider;
use Illuminate\Contracts\Config\Repository as ConfigRepository;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Http\Requests\Admin\Settings\GynxAiSettingsFormRequest;

/**
 * Admin settings page for gynx.ai. DB-backed so the panel owner can
 * rotate the Gemini key (or flip the feature off) without editing
 * .env and bouncing PHP-FPM. The form and the underlying setting
 * keys are 1:1, mirroring the MailController pattern.
 */
class GynxAiController extends Controller
{
    public function __construct(
        private AlertsMessageBag $alert,
        private ConfigRepository $config,
        private Encrypter $encrypter,
        private SettingsRepositoryInterface $settings,
        private ViewFactory $view,
    ) {
    }

    public function index(): View
    {
        // Surface the API key as masked unless the admin clicks "Show".
        // We only display the last 4 characters so a shoulder-surfer
        // can see *that* it's set without learning the value.
        $rawKey = (string) $this->config->get('services.gynx_ai.gemini.api_key', '');
        $maskedKey = $rawKey === '' ? '' : str_repeat('•', max(0, strlen($rawKey) - 4)) . substr($rawKey, -4);

        return $this->view->make('admin.settings.gynx-ai', [
            'enabled' => (bool) $this->config->get('services.gynx_ai.enabled', false),
            'provider' => (string) $this->config->get('services.gynx_ai.provider', 'gemini'),
            'apiKeyConfigured' => $rawKey !== '',
            'apiKeyMasked' => $maskedKey,
            'model' => (string) $this->config->get('services.gynx_ai.gemini.model', 'gemini-2.0-flash'),
            'dailyCap' => (int) $this->config->get('services.gynx_ai.daily_cap_per_server', 20),
        ]);
    }

    /**
     * @throws \Pterodactyl\Exceptions\Model\DataValidationException
     * @throws \Pterodactyl\Exceptions\Repository\RecordNotFoundException
     */
    public function update(GynxAiSettingsFormRequest $request): RedirectResponse
    {
        $values = $request->normalize();

        // Empty api_key submission means "leave the existing value alone"
        // — otherwise the admin who edited a different field would
        // accidentally wipe their key. Sentinel '!clear' lets them
        // explicitly remove it.
        if (array_key_exists('services:gynx_ai:gemini:api_key', $values)) {
            $submitted = (string) $values['services:gynx_ai:gemini:api_key'];
            if ($submitted === '') {
                unset($values['services:gynx_ai:gemini:api_key']);
            } elseif ($submitted === '!clear') {
                $values['services:gynx_ai:gemini:api_key'] = '';
            }
        }

        foreach ($values as $key => $value) {
            if (in_array($key, SettingsServiceProvider::getEncryptedKeys()) && !empty($value)) {
                $value = $this->encrypter->encrypt($value);
            }
            $this->settings->set('settings::' . $key, $value);
        }

        $this->alert->success('gynx.ai settings updated. Changes apply immediately.')->flash();

        return redirect()->route('admin.settings.gynx-ai');
    }

    /**
     * Round-trip a one-shot request to the configured provider so the
     * admin can verify their key works without leaving the page.
     * Returns 204 on success and a JSON error on failure.
     */
    public function test(): Response
    {
        try {
            // Resolve through the container so this respects whatever
            // provider is configured — Gemini today, Claude/OpenAI later.
            /** @var AiProvider $provider */
            $provider = app(AiProvider::class);
            if (!$provider->available()) {
                return response('Provider credentials are not set. Save your key first, then test.', 400);
            }
            $provider->complete(
                'You are a test endpoint. Respond with exactly the word OK.',
                'Ping.',
            );
        } catch (\Throwable $e) {
            return response('Test request failed: ' . $e->getMessage(), 500);
        }

        return response('', 204);
    }
}
