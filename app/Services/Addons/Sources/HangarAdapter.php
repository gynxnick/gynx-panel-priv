<?php

namespace Pterodactyl\Services\Addons\Sources;

use Pterodactyl\Services\Addons\AddonSource;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

/**
 * Hangar (PaperMC) source — stub. Phase 9.2 fills it in.
 * Plugins only (Paper doesn't do mods/modpacks).
 */
class HangarAdapter implements AddonSource
{
    public function slug(): string { return 'hangar'; }
    public function available(): bool { return false; }
    public function supports(string $type): bool { return $type === self::TYPE_PLUGIN; }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 20): array
    {
        throw new ServiceUnavailableHttpException(null, 'Hangar source is not yet available.');
    }

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null): array
    {
        throw new ServiceUnavailableHttpException(null, 'Hangar source is not yet available.');
    }
}
