<?php

namespace Pterodactyl\Services\Eggs;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\EggSwitchLog;
use Pterodactyl\Models\EggSwitchRule;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerEggSwitchOverride;
use Pterodactyl\Models\ServerVariable;
use Pterodactyl\Models\User;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Services\Servers\ReinstallServerService;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

/**
 * Resolves allowed egg transitions for a given server, previews them,
 * and performs the actual switch. All admin-facing rule/override config
 * is read-only here; the admin writes them via Blade / tinker for now.
 */
class EggSwitcherService
{
    public function __construct(
        private ConnectionInterface $connection,
        private ReinstallServerService $reinstallServerService,
        private DaemonFileRepository $daemonFiles,
    ) {
    }

    /**
     * Resolved policy for a (server → target egg) pair.
     */
    private function resolvePolicy(Server $server, int $targetEggId): ?ResolvedPolicy
    {
        $override = ServerEggSwitchOverride::query()
            ->where('server_id', $server->id)
            ->where('target_egg_id', $targetEggId)
            ->first();

        if ($override !== null && $override->allowed === false) {
            return null;
        }

        $rule = EggSwitchRule::query()
            ->where('enabled', true)
            ->where('target_egg_id', $targetEggId)
            ->where(function ($q) use ($server) {
                $q->whereNull('source_egg_id')
                    ->orWhere('source_egg_id', $server->egg_id);
            })
            ->orderByRaw('source_egg_id IS NULL')  // prefer specific rules over global
            ->first();

        if ($rule === null && ($override === null || $override->allowed !== true)) {
            return null;
        }

        // Override wins for preserves_files when non-null.
        $preservesFiles = $override?->preserves_files ?? $rule?->preserves_files ?? false;
        $cooldown = $rule?->cooldown_minutes ?? 0;
        $warning = $rule?->warning_copy;
        $iconUrl = $rule?->icon_url;
        $bannerUrl = $rule?->banner_url;

        return new ResolvedPolicy($preservesFiles, $cooldown, $warning, $iconUrl, $bannerUrl);
    }

    /**
     * List every egg this user can switch *to* on this server.
     */
    public function listAllowedTargets(Server $server, User $actor): Collection
    {
        // Start from the union of rule targets and override targets.
        $ruleTargetIds = EggSwitchRule::query()
            ->where('enabled', true)
            ->where(function ($q) use ($server) {
                $q->whereNull('source_egg_id')
                    ->orWhere('source_egg_id', $server->egg_id);
            })
            ->pluck('target_egg_id');

        $overrideAllowedIds = ServerEggSwitchOverride::query()
            ->where('server_id', $server->id)
            ->where('allowed', true)
            ->pluck('target_egg_id');

        $overrideDeniedIds = ServerEggSwitchOverride::query()
            ->where('server_id', $server->id)
            ->where('allowed', false)
            ->pluck('target_egg_id')
            ->all();

        $candidateIds = $ruleTargetIds
            ->merge($overrideAllowedIds)
            ->unique()
            ->reject(fn ($id) => in_array($id, $overrideDeniedIds, true))
            ->reject(fn ($id) => (int) $id === (int) $server->egg_id);

        if ($candidateIds->isEmpty()) {
            return new Collection();
        }

        $eggs = Egg::query()->whereIn('id', $candidateIds)->get();
        $lastSwitchAt = $this->lastSuccessfulSwitchAt($server);

        return $eggs->map(function (Egg $egg) use ($server, $lastSwitchAt) {
            $policy = $this->resolvePolicy($server, $egg->id);
            if ($policy === null) return null;

            $remaining = $this->cooldownRemainingSeconds($lastSwitchAt, $policy->cooldownMinutes);

            return [
                'eggId' => $egg->id,
                'name' => $egg->name,
                'description' => (string) ($egg->description ?? ''),
                'iconUrl' => $policy->iconUrl,
                'bannerUrl' => $policy->bannerUrl,
                'preservesFiles' => $policy->preservesFiles,
                'cooldownRemainingSeconds' => $remaining,
                'warningCopy' => $policy->warningCopy,
            ];
        })->filter()->values();
    }

    /**
     * Dry-run: shows what the switch would change. Never mutates.
     */
    public function preview(Server $server, Egg $targetEgg, User $actor): array
    {
        $policy = $this->resolvePolicy($server, $targetEgg->id);
        if ($policy === null) {
            throw new NotFoundHttpException('This server is not allowed to switch to that egg.');
        }

        $lastSwitchAt = $this->lastSuccessfulSwitchAt($server);
        $remaining = $this->cooldownRemainingSeconds($lastSwitchAt, $policy->cooldownMinutes);

        // Build variable diff.
        $currentVars = $server->variables()
            ->get()
            ->keyBy(fn ($v) => $v->variable?->env_variable ?? '');

        $targetEgg->load('variables');
        $changes = [];
        foreach ($targetEgg->variables as $v) {
            $existing = $currentVars->get($v->env_variable);
            $changes[] = [
                'envKey' => $v->env_variable,
                'from' => $existing?->variable_value,
                'to' => $v->default_value,
            ];
        }

        $warnings = [];
        if (!$policy->preservesFiles) {
            $warnings[] = 'Switching will run this egg\'s install script which may wipe existing server files.';
        }
        if ($policy->warningCopy) {
            $warnings[] = $policy->warningCopy;
        }

        return [
            'targetEgg' => [
                'eggId' => $targetEgg->id,
                'name' => $targetEgg->name,
                'dockerImage' => array_values($targetEgg->docker_images ?? [])[0] ?? $targetEgg->docker_image,
            ],
            'variableChanges' => $changes,
            'filesWipeRequired' => !$policy->preservesFiles,
            'cooldownRemainingSeconds' => $remaining,
            'warnings' => $warnings,
        ];
    }

    /**
     * Perform the switch. Writes an `egg_switch_logs` row, mutates the
     * server, and dispatches a reinstall.
     *
     * @throws \Throwable
     */
    public function request(Server $server, Egg $targetEgg, User $actor): EggSwitchLog
    {
        $policy = $this->resolvePolicy($server, $targetEgg->id);
        if ($policy === null) {
            throw new NotFoundHttpException('This server is not allowed to switch to that egg.');
        }

        $lastSwitchAt = $this->lastSuccessfulSwitchAt($server);
        $remaining = $this->cooldownRemainingSeconds($lastSwitchAt, $policy->cooldownMinutes);
        if ($remaining > 0) {
            throw new TooManyRequestsHttpException($remaining, "Cooldown in effect. Try again in {$remaining}s.");
        }

        if (!$server->isInstalled() || $server->isSuspended() || $server->transfer !== null) {
            throw new ConflictHttpException('Server is currently installing, suspended, or transferring.');
        }

        return $this->connection->transaction(function () use ($server, $targetEgg, $actor, $policy) {
            $log = EggSwitchLog::query()->create([
                'server_id' => $server->id,
                'actor_user_id' => $actor->id,
                'source_egg_id' => $server->egg_id,
                'target_egg_id' => $targetEgg->id,
                'preserved_files' => $policy->preservesFiles,
                'status' => EggSwitchLog::STATUS_QUEUED,
            ]);

            // Rebuild server variables to match the new egg's schema, carrying
            // values across where the env_variable key matches.
            $targetEgg->load('variables');
            $existing = $server->variables()
                ->get()
                ->keyBy(fn ($v) => $v->variable?->env_variable ?? '');

            $server->variables()->delete();
            foreach ($targetEgg->variables as $v) {
                $carry = $existing->get($v->env_variable);
                ServerVariable::query()->create([
                    'server_id' => $server->id,
                    'variable_id' => $v->id,
                    'variable_value' => $carry?->variable_value ?? (string) ($v->default_value ?? ''),
                ]);
            }

            // Point the server at the new egg + its default Docker image.
            $images = array_values($targetEgg->docker_images ?? []);
            $server->forceFill([
                'egg_id' => $targetEgg->id,
                'image' => $images[0] ?? $targetEgg->docker_image,
                'startup' => $targetEgg->startup,
                'status' => Server::STATUS_INSTALLING,
            ])->save();

            $log->forceFill([
                'status' => EggSwitchLog::STATUS_RUNNING,
                'started_at' => Carbon::now(),
            ])->save();

            // When preserves_files = false, clear out the addon directories
            // that pollute across MC variants (Forge mods left over after a
            // switch to Paper, etc.). We deliberately leave the server jar,
            // worlds, and root-level configs alone — wiping them was making
            // some eggs un-startable because the install script doesn't
            // always re-download every file the runtime needs.
            if (!$policy->preservesFiles) {
                $this->wipeAddonDirs($server);
            }

            // Dispatch the reinstall. Wings pulls the (new) image + runs the
            // new egg's install script.
            try {
                $this->reinstallServerService->handle($server->refresh());
            } catch (\Throwable $e) {
                $log->forceFill([
                    'status' => EggSwitchLog::STATUS_FAILED,
                    'error' => $e->getMessage(),
                    'completed_at' => Carbon::now(),
                ])->save();
                throw $e;
            }

            return $log->refresh();
        });
    }

    private function lastSuccessfulSwitchAt(Server $server): ?Carbon
    {
        $log = EggSwitchLog::query()
            ->where('server_id', $server->id)
            ->where('status', EggSwitchLog::STATUS_SUCCESS)
            ->orderByDesc('completed_at')
            ->first();

        return $log?->completed_at;
    }

    private function cooldownRemainingSeconds(?Carbon $lastSwitchAt, int $cooldownMinutes): int
    {
        if ($lastSwitchAt === null || $cooldownMinutes <= 0) return 0;
        $unlockAt = $lastSwitchAt->copy()->addMinutes($cooldownMinutes);
        $now = Carbon::now();
        return $now->gte($unlockAt) ? 0 : $now->diffInSeconds($unlockAt);
    }

    /**
     * Wipe the directories that pollute across MC variants — mods/, plugins/,
     * config/ — without touching the server jar, worlds, server.properties,
     * or anything else at the root. The earlier "delete everything" version
     * left some eggs un-startable because their install scripts don't
     * re-download every file the runtime needs (jar, eula, etc.).
     */
    private function wipeAddonDirs(Server $server): void
    {
        $files = $this->daemonFiles->setServer($server);

        foreach (['mods', 'plugins', 'config'] as $dir) {
            try {
                $entries = $files->getDirectory('/' . $dir);
            } catch (\Throwable $e) {
                continue; // dir doesn't exist on this server
            }

            $names = [];
            foreach ($entries as $e) {
                $name = is_array($e) ? ($e['name'] ?? null) : null;
                if (is_string($name) && $name !== '') $names[] = $name;
            }
            if (empty($names)) continue;

            try {
                $files->deleteFiles('/' . $dir, $names);
            } catch (\Throwable $e) {
                // Log and continue — better a partial wipe than a stuck switch.
                report($e);
            }
        }
    }
}
