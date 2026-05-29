<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\Factory as ViewFactory;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Models\PartnerModpack;
use Pterodactyl\Http\Controllers\Controller;

/**
 * Admin CRUD for the featured "Partner Modpacks" surfaced at the top of
 * the in-panel installer. Each entry is a curated pointer into the
 * existing modpack install pipeline (source + external_id + optional
 * version/game version) dressed up with a banner, copy, and ordering.
 */
class PartnerModpacksController extends Controller
{
    /** Providers that actually host modpacks (mirrors the installer). */
    public const SOURCES = ['modrinth', 'curseforge'];

    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view,
    ) {
    }

    public function index(): View
    {
        return $this->view->make('admin.partner-modpacks.index', [
            'packs' => PartnerModpack::query()
                ->orderBy('sort_order')
                ->orderByDesc('is_featured')
                ->orderBy('id')
                ->get(),
            'sources' => self::SOURCES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        PartnerModpack::create($data);

        $this->alert->success('Partner modpack added.')->flash();

        return redirect()->route('admin.partner-modpacks.index');
    }

    public function update(Request $request, PartnerModpack $partnerModpack): RedirectResponse
    {
        $data = $this->validated($request);
        $partnerModpack->update($data);

        $this->alert->success('Partner modpack updated.')->flash();

        return redirect()->route('admin.partner-modpacks.index');
    }

    public function destroy(PartnerModpack $partnerModpack): RedirectResponse
    {
        $partnerModpack->delete();

        $this->alert->success('Partner modpack removed.')->flash();

        return redirect()->route('admin.partner-modpacks.index');
    }

    /**
     * Validate + normalize the form payload. Checkboxes only POST when
     * checked, so visibility/featured are read explicitly as booleans.
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => 'required|string|max:120',
            'summary' => 'nullable|string|max:500',
            'banner_url' => 'nullable|url|max:2048',
            'source' => 'required|in:' . implode(',', self::SOURCES),
            'external_id' => 'required|string|max:191',
            'version_id' => 'nullable|string|max:191',
            'game_version' => 'nullable|string|max:64',
            'accent' => 'nullable|string|max:9',
            'sort_order' => 'nullable|integer|min:0|max:9999',
        ]);

        $data['sort_order'] = $data['sort_order'] ?? 0;
        $data['is_visible'] = $request->boolean('is_visible');
        $data['is_featured'] = $request->boolean('is_featured');

        return $data;
    }
}
