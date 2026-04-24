<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Illuminate\View\Factory as ViewFactory;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\EggSwitchRule;

class EggSwitchRulesController extends Controller
{
    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view,
    ) {
    }

    public function index(): View
    {
        return $this->view->make('admin.egg-switch.index', [
            'rules' => EggSwitchRule::query()
                ->with(['sourceEgg:id,name', 'targetEgg:id,name'])
                ->orderBy('enabled', 'desc')
                ->orderBy('target_egg_id')
                ->get(),
            'eggs' => Egg::query()
                ->with('nest:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'nest_id']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'source_egg_id' => 'nullable|integer|exists:eggs,id',
            'target_egg_id' => 'required|integer|exists:eggs,id',
            'preserves_files' => 'nullable|boolean',
            'cooldown_minutes' => 'required|integer|min:0|max:10080',
            'warning_copy' => 'nullable|string|max:500',
        ]);

        $data['preserves_files'] = (bool) ($data['preserves_files'] ?? false);
        $data['enabled'] = true;

        if ((int) ($data['source_egg_id'] ?? 0) === (int) $data['target_egg_id']) {
            $this->alert->danger('Source and target egg cannot be the same.')->flash();
            return redirect()->route('admin.egg-switch.index');
        }

        try {
            EggSwitchRule::query()->create($data);
            $this->alert->success('Rule created.')->flash();
        } catch (\Illuminate\Database\QueryException $e) {
            if (str_contains($e->getMessage(), 'Duplicate') || str_contains($e->getMessage(), 'unique')) {
                $this->alert->danger('A rule for that source/target pair already exists.')->flash();
            } else {
                $this->alert->danger('Could not create rule: ' . $e->getMessage())->flash();
            }
        }

        return redirect()->route('admin.egg-switch.index');
    }

    public function toggle(EggSwitchRule $rule): RedirectResponse
    {
        $rule->forceFill(['enabled' => !$rule->enabled])->save();
        $this->alert->success($rule->enabled ? 'Rule enabled.' : 'Rule disabled.')->flash();
        return redirect()->route('admin.egg-switch.index');
    }

    public function destroy(EggSwitchRule $rule): RedirectResponse
    {
        $rule->delete();
        $this->alert->success('Rule removed.')->flash();
        return redirect()->route('admin.egg-switch.index');
    }
}
