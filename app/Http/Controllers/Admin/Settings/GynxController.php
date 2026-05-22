<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Models\Nest;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

/**
 * General Gynx panel settings — the home for gynx-only knobs that don't
 * belong on the upstream General / Mail / Advanced pages. Today it owns
 * the Slot Manager nest exclusion list; future gynx-specific settings
 * land here too.
 *
 * Storage is DB-backed via SettingsRepository, with the keys also
 * registered in SettingsServiceProvider so the boot pass writes them
 * into the config repo (which SlotConfigController reads).
 */
class GynxController extends Controller
{
    private const SETTING_EXCLUDED_NESTS = 'gynx:slot_manager:excluded_nests';

    public function __construct(
        private AlertsMessageBag $alert,
        private SettingsRepositoryInterface $settings,
        private ViewFactory $view,
    ) {
    }

    public function index(): View
    {
        // Pull the raw setting value (string) and split into ints for
        // the multi-select. config() already reflects the DB value if
        // set, falling back to the env-var-derived array otherwise.
        $raw = config('gynx.slot_manager.excluded_nests', []);
        $selected = is_array($raw)
            ? array_map('intval', $raw)
            : array_values(array_filter(array_map('intval', explode(',', (string) $raw))));

        $nests = Nest::query()->orderBy('name')->get(['id', 'name', 'description']);

        return $this->view->make('admin.settings.gynx', [
            'nests' => $nests,
            'selectedNestIds' => $selected,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'excluded_nests'   => 'array',
            'excluded_nests.*' => 'integer|exists:nests,id',
        ]);

        $value = implode(',', array_unique(array_map('intval', $data['excluded_nests'] ?? [])));
        $this->settings->set('settings::' . self::SETTING_EXCLUDED_NESTS, $value);

        $this->alert->success('Gynx settings updated. Changes apply immediately.')->flash();

        return redirect()->route('admin.settings.gynx');
    }
}
