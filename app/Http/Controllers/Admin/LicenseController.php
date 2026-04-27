<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Illuminate\View\Factory as ViewFactory;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\Licensing\LicenseClientService;

/**
 * Admin: gynx-panel license entry + status. The panel is a *client* of the
 * gynx.gg license API — keys are issued centrally on gynx.gg/admin/licenses
 * and pasted here. This page handles set / clear / re-verify.
 */
class LicenseController extends Controller
{
    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view,
        protected LicenseClientService $service,
    ) {
    }

    public function index(): View
    {
        // Lazy-refresh on view so the admin sees current status without
        // having to click verify. Cached for an hour internally so this
        // is cheap.
        $this->service->refreshIfStale();

        return $this->view->make('admin.license.index', [
            'status' => $this->service->status(),
            'key' => $this->service->key(),
            'apiUrl' => env('GYNX_LICENSE_API_URL', 'https://gynx.gg/api/license'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'key' => 'required|string|min:8|max:64',
        ]);
        $this->service->setKey($data['key']);

        // Validate immediately so the result is fresh on the next page load.
        $status = $this->service->validateNow();

        if ($status['status'] === LicenseClientService::STATUS_VALID) {
            $this->alert->success('License accepted: ' . ($status['message'] ?? 'OK'))->flash();
        } elseif ($status['status'] === LicenseClientService::STATUS_INVALID) {
            $this->alert->danger($status['message'] ?? 'License rejected.')->flash();
        } else {
            $this->alert->warning($status['message'] ?? 'License server unreachable; will retry later.')->flash();
        }

        return redirect()->route('admin.license.index');
    }

    public function verify(): RedirectResponse
    {
        $status = $this->service->validateNow();

        if ($status['status'] === LicenseClientService::STATUS_VALID) {
            $this->alert->success($status['message'] ?? 'License OK.')->flash();
        } elseif ($status['status'] === LicenseClientService::STATUS_INVALID) {
            $this->alert->danger($status['message'] ?? 'License rejected.')->flash();
        } else {
            $this->alert->warning($status['message'] ?? 'License server unreachable.')->flash();
        }

        return redirect()->route('admin.license.index');
    }

    public function destroy(): RedirectResponse
    {
        $this->service->clearKey();
        $this->alert->success('License key cleared. Panel features that require a license will lock down on next page load.')->flash();
        return redirect()->route('admin.license.index');
    }
}
