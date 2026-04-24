<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Illuminate\View\Factory as ViewFactory;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\PanelAlert;

class PanelAlertsController extends Controller
{
    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view,
    ) {
    }

    public function index(): View
    {
        return $this->view->make('admin.alerts.index', [
            'alerts' => PanelAlert::query()
                ->with('node:id,name')
                ->orderByDesc('created_at')
                ->get(),
        ]);
    }

    public function create(): View
    {
        return $this->view->make('admin.alerts.edit', [
            'alert' => null,
            'nodes' => Node::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function edit(PanelAlert $alert): View
    {
        return $this->view->make('admin.alerts.edit', [
            'alert' => $alert,
            'nodes' => Node::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateInput($request);
        $data['created_by'] = $request->user()->id;

        PanelAlert::query()->create($data);
        $this->alert->success('Alert created.')->flash();

        return redirect()->route('admin.alerts.index');
    }

    public function update(Request $request, PanelAlert $alert): RedirectResponse
    {
        $data = $this->validateInput($request);
        $alert->forceFill($data)->save();
        $this->alert->success('Alert updated.')->flash();

        return redirect()->route('admin.alerts.index');
    }

    public function destroy(PanelAlert $alert): RedirectResponse
    {
        $alert->delete();
        $this->alert->success('Alert removed.')->flash();

        return redirect()->route('admin.alerts.index');
    }

    private function validateInput(Request $request): array
    {
        $data = $request->validate([
            'scope' => 'required|in:panel,node',
            'node_id' => 'nullable|integer|exists:nodes,id',
            'severity' => 'required|in:info,warn,maint,critical',
            'title' => 'required|string|max:200',
            'body' => 'nullable|string|max:2000',
            'link_url' => 'nullable|url|max:2048',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'dismissible' => 'nullable|boolean',
        ]);

        $data['dismissible'] = (bool) ($data['dismissible'] ?? false);
        if ($data['scope'] === 'panel') {
            $data['node_id'] = null;
        }
        $data['body'] = $data['body'] ?? null;
        $data['link_url'] = $data['link_url'] ?? null;
        $data['starts_at'] = $data['starts_at'] ?? null;
        $data['ends_at'] = $data['ends_at'] ?? null;

        return $data;
    }
}
