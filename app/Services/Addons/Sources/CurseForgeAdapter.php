<?php

namespace Pterodactyl\Services\Addons\Sources;

use Pterodactyl\Services\Addons\AddonSource;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

/**
 * CurseForge source — stub. Phase 9.4 fills it in; needs
 * CURSEFORGE_API_KEY env var to enable. Supports plugin/mod/modpack.
 */
class CurseForgeAdapter implements AddonSource
{
    public function slug(): string { return 'curseforge'; }

    public function available(): bool
    {
        return !empty(env('CURSEFORGE_API_KEY'));
    }

    public function supports(string $type): bool
    {
        return in_array($type, [self::TYPE_PLUGIN, self::TYPE_MOD, self::TYPE_MODPACK], true);
    }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 20): array
    {
        throw new ServiceUnavailableHttpException(null, 'CurseForge source is not yet available.');
    }

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null): array
    {
        throw new ServiceUnavailableHttpException(null, 'CurseForge source is not yet available.');
    }
}
