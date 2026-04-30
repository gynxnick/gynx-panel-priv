<?php

namespace Pterodactyl\Services\Addons;

use Pterodactyl\Services\Addons\Sources\CurseForgeAdapter;
use Pterodactyl\Services\Addons\Sources\HangarAdapter;
use Pterodactyl\Services\Addons\Sources\ModrinthAdapter;
use Pterodactyl\Services\Addons\Sources\SpigotAdapter;
use Pterodactyl\Services\Addons\Sources\ThunderstoreAdapter;
use Pterodactyl\Services\Addons\Sources\UmodAdapter;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AddonSourceRegistry
{
    /** @var AddonSource[] */
    private array $sources;

    public function __construct(
        ModrinthAdapter $modrinth,
        HangarAdapter $hangar,
        SpigotAdapter $spigot,
        CurseForgeAdapter $curseforge,
        ThunderstoreAdapter $thunderstore,
        UmodAdapter $umod,
    ) {
        $this->sources = [
            $modrinth->slug() => $modrinth,
            $hangar->slug() => $hangar,
            $spigot->slug() => $spigot,
            $curseforge->slug() => $curseforge,
            $thunderstore->slug() => $thunderstore,
            $umod->slug() => $umod,
        ];
    }

    /** @return AddonSource[] indexed by slug */
    public function all(): array
    {
        return $this->sources;
    }

    /**
     * Sources that are enabled AND support the given type.
     *
     * @return AddonSource[]
     */
    public function enabledFor(string $type): array
    {
        return array_filter(
            $this->sources,
            fn (AddonSource $s) => $s->available() && $s->supports($type),
        );
    }

    public function get(string $slug): AddonSource
    {
        if (!isset($this->sources[$slug])) {
            throw new NotFoundHttpException("Unknown add-on source: {$slug}");
        }
        return $this->sources[$slug];
    }
}
