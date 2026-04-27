<?php

namespace Pterodactyl\Services\Subdomains;

use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\SubdomainRecord;
use Pterodactyl\Models\SubdomainZone;
use Pterodactyl\Services\Subdomains\Providers\CloudflareDnsProvider;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Orchestrates panel-side subdomain claims with the upstream DNS provider.
 *
 * Two public flows:
 *   - claim(server, zone, hostname): create the DNS record(s) on the
 *     provider, persist a row pointing at them. Idempotent: if a record
 *     with the same (zone, hostname, type) already belongs to this server,
 *     update it instead of erroring.
 *   - release(record): delete the upstream record + the local row.
 *
 * The "create A record + optional SRV record" pair is encoded here rather
 * than in the controller so the rules stay in one place. SRV is currently
 * Minecraft-flavoured (_minecraft._tcp); we only emit it when the egg
 * looks like Minecraft and the chosen allocation port isn't 25565 (the
 * default — clients reach that port via plain DNS lookup).
 */
class SubdomainService
{
    public function __construct(
        private ConnectionInterface $connection,
    ) {
    }

    /**
     * @return SubdomainRecord[]
     */
    public function claim(Server $server, SubdomainZone $zone, string $hostname): array
    {
        if (!$zone->enabled) {
            throw new ConflictHttpException('That subdomain zone is currently disabled.');
        }

        $hostname = $this->normalizeHostname($hostname);
        $allocation = $server->allocation;
        if (!$allocation) {
            throw new ConflictHttpException('Server has no default allocation to point a subdomain at.');
        }

        $cf = CloudflareDnsProvider::forZone($zone);

        // 1. A record → server's IP. Always created.
        $aPayload = [
            'type' => 'A',
            'name' => $hostname,
            'content' => $allocation->ip,
            'ttl' => 1,
            'proxied' => false,
        ];
        $aResult = $this->upsertProviderRecord($cf, $zone, $hostname, 'A', $aPayload);

        $records = [
            $this->persistRecord($server, $zone, $hostname, 'A', $allocation->ip, $aResult, null),
        ];

        // 2. SRV record for Minecraft-style port mapping when port != 25565.
        // Lets users connect to "myserver.play.gynx.gg" without ":2566" on the end.
        if ($this->isMinecraftLike($server) && (int) $allocation->port !== 25565) {
            $srvName = '_minecraft._tcp.' . $hostname;
            $srvPayload = [
                'type' => 'SRV',
                'name' => $srvName,
                'data' => [
                    'service' => '_minecraft',
                    'proto' => '_tcp',
                    'name' => $hostname,
                    'priority' => 0,
                    'weight' => 5,
                    'port' => (int) $allocation->port,
                    'target' => $hostname . '.' . $zone->domain . '.',
                ],
                'ttl' => 1,
            ];
            $srvResult = $this->upsertProviderRecord($cf, $zone, $srvName, 'SRV', $srvPayload);
            $records[] = $this->persistRecord(
                $server, $zone, $srvName, 'SRV',
                json_encode(['port' => (int) $allocation->port]),
                $srvResult,
                ['priority' => 0, 'weight' => 5, 'port' => (int) $allocation->port],
            );
        }

        return $records;
    }

    public function release(SubdomainRecord $record): void
    {
        $cf = CloudflareDnsProvider::forZone($record->zone);
        try {
            $cf->deleteRecord($record->provider_record_id);
        } catch (\Throwable $e) {
            // Upstream record may already be gone — log but proceed with
            // the local delete so the row doesn't strand.
            report($e);
        }
        $record->delete();
    }

    /**
     * Release every record this server holds. Called from the server's
     * delete pipeline so we don't leave orphan DNS entries.
     */
    public function releaseAllForServer(Server $server): void
    {
        foreach (SubdomainRecord::query()->where('server_id', $server->id)->get() as $record) {
            $this->release($record);
        }
    }

    private function upsertProviderRecord(
        CloudflareDnsProvider $cf,
        SubdomainZone $zone,
        string $hostname,
        string $type,
        array $payload,
    ): array {
        $existing = SubdomainRecord::query()
            ->where('zone_id', $zone->id)
            ->where('hostname', $hostname)
            ->where('record_type', $type)
            ->first();

        if ($existing) {
            return $cf->updateRecord($existing->provider_record_id, $payload);
        }
        return $cf->createRecord($payload);
    }

    private function persistRecord(
        Server $server,
        SubdomainZone $zone,
        string $hostname,
        string $type,
        string $content,
        array $providerResult,
        ?array $meta,
    ): SubdomainRecord {
        return $this->connection->transaction(
            fn () => SubdomainRecord::query()->updateOrCreate(
                [
                    'zone_id' => $zone->id,
                    'hostname' => $hostname,
                    'record_type' => $type,
                ],
                [
                    'server_id' => $server->id,
                    'content' => $content,
                    'provider_record_id' => (string) ($providerResult['id'] ?? ''),
                    'meta' => $meta,
                ],
            )
        );
    }

    private function normalizeHostname(string $name): string
    {
        $name = strtolower(trim($name));
        if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $name)) {
            throw new ConflictHttpException(
                'Subdomain must be 1–63 characters of letters, numbers, or hyphens (no leading/trailing hyphen).'
            );
        }
        return $name;
    }

    private function isMinecraftLike(Server $server): bool
    {
        $haystack = ($server->image ?? '') . ' ' . ($server->startup ?? '');
        return (bool) preg_match('/java|yolks?|minecraft|paper|spigot|fabric|forge/i', $haystack);
    }
}
