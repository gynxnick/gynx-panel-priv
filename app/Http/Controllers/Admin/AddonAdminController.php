<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Illuminate\View\Factory as ViewFactory;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\AddonMod;
use Pterodactyl\Models\AddonModpack;
use Pterodactyl\Models\AddonPlugin;

/**
 * Admin-side "who has what installed" view across every server.
 * Read-heavy by design — destructive actions route through the same
 * services the client API uses to keep /plugins, /mods, /modpacks in
 * sync on Wings and in the DB.
 */
class AddonAdminController extends Controller
{
    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view,
    ) {
    }

    public function plugins(): View
    {
        return $this->view->make('admin.addons.index', [
            'title'       => 'Plugins',
            'kind'        => 'plugins',
            'items'       => AddonPlugin::query()
                ->with(['server:id,name', 'installer:id,username'])
                ->orderByDesc('installed_at')
                ->limit(500)
                ->get(),
            'destroyRoute'=> 'admin.addons.plugins.destroy',
        ]);
    }

    public function mods(): View
    {
        return $this->view->make('admin.addons.index', [
            'title'       => 'Mods',
            'kind'        => 'mods',
            'items'       => AddonMod::query()
                ->with(['server:id,name', 'installer:id,username'])
                ->orderByDesc('installed_at')
                ->limit(500)
                ->get(),
            'destroyRoute'=> 'admin.addons.mods.destroy',
        ]);
    }

    public function modpacks(): View
    {
        return $this->view->make('admin.addons.index', [
            'title'       => 'Modpacks',
            'kind'        => 'modpacks',
            'items'       => AddonModpack::query()
                ->with(['server:id,name', 'installer:id,username'])
                ->orderByDesc('installed_at')
                ->limit(500)
                ->get(),
            'destroyRoute'=> 'admin.addons.modpacks.destroy',
        ]);
    }

    public function destroyPlugin(AddonPlugin $plugin): RedirectResponse
    {
        $plugin->delete();
        $this->alert->success('Plugin removed from the installation log. Delete the jar manually if still present.')->flash();
        return redirect()->route('admin.addons.plugins');
    }

    public function destroyMod(AddonMod $mod): RedirectResponse
    {
        $mod->delete();
        $this->alert->success('Mod removed from the installation log.')->flash();
        return redirect()->route('admin.addons.mods');
    }

    public function destroyModpack(AddonModpack $modpack): RedirectResponse
    {
        $modpack->delete();
        $this->alert->success('Modpack archive removed from the installation log.')->flash();
        return redirect()->route('admin.addons.modpacks');
    }
}
