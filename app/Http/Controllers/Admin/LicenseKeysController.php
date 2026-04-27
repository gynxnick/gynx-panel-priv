<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Illuminate\View\Factory as ViewFactory;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\LicenseKey;
use Pterodactyl\Services\Licensing\LicenseKeyService;

/**
 * Admin: license-key management. Issue, list, revoke, reactivate, rotate.
 *
 * Each panel runs its own keyring (per Option B in TODO.md). The list
 * page also surfaces recent usage so admins can spot a key being abused
 * or one that hasn't been validated in months.
 */
class LicenseKeysController extends Controller
{
    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view,
        protected LicenseKeyService $service,
    ) {
    }

    public function index(): View
    {
        $keys = LicenseKey::query()
            ->orderByDesc('id')
            ->get();

        return $this->view->make('admin.licenses.index', [
            'keys' => $keys,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'label' => 'nullable|string|max:120',
            'expires_at' => 'nullable|date|after:now',
            'limits' => 'nullable|string',          // freeform JSON, parsed below
            'features' => 'nullable|string',        // comma-separated list
        ]);

        $limits = null;
        if (!empty($data['limits'])) {
            $decoded = json_decode($data['limits'], true);
            if (!is_array($decoded)) {
                $this->alert->danger('Limits must be valid JSON, e.g. {"max_servers": 5}.')->flash();
                return redirect()->route('admin.licenses.index');
            }
            $limits = $decoded;
        }

        $features = null;
        if (!empty($data['features'])) {
            $features = array_values(array_filter(
                array_map('trim', explode(',', $data['features'])),
                fn ($s) => $s !== '',
            ));
        }

        $key = $this->service->generate([
            'label' => $data['label'] ?? null,
            'expires_at' => $data['expires_at'] ?? null,
            'limits' => $limits,
            'features' => $features,
        ], $request->user());

        $this->alert->success("Key created: {$key->key}")->flash();
        return redirect()->route('admin.licenses.index');
    }

    public function revoke(LicenseKey $license): RedirectResponse
    {
        $this->service->revoke($license);
        $this->alert->success('Key revoked.')->flash();
        return redirect()->route('admin.licenses.index');
    }

    public function reactivate(LicenseKey $license): RedirectResponse
    {
        try {
            $this->service->reactivate($license);
            $this->alert->success('Key re-enabled.')->flash();
        } catch (\Throwable $e) {
            $this->alert->danger($e->getMessage())->flash();
        }
        return redirect()->route('admin.licenses.index');
    }

    public function rotate(LicenseKey $license): RedirectResponse
    {
        $this->service->rotate($license);
        $this->alert->success("New key issued: {$license->refresh()->key}")->flash();
        return redirect()->route('admin.licenses.index');
    }

    public function destroy(LicenseKey $license): RedirectResponse
    {
        $license->delete();
        $this->alert->success('Key deleted.')->flash();
        return redirect()->route('admin.licenses.index');
    }
}
