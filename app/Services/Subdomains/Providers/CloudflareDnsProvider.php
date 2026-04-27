<?php

namespace Pterodactyl\Services\Subdomains\Providers;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Pterodactyl\Models\SubdomainZone;
use Symfony\Component\HttpKernel\Exception\BadGatewayHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Thin wrapper around Cloudflare's DNS-record API for the subdomain manager.
 *
 * Docs: https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-list-dns-records
 *
 * One adapter instance per zone — instantiate via `forZone($zone)`. The token
 * lives on the zone row in the panel DB; we send it as a Bearer token here.
 *
 * The interface is deliberately small: create/update/delete a single record,
 * plus a list call for the admin "what's already here" view. Anything fancier
 * (bulk imports, page rules, SSL, etc.) belongs in a different service.
 */
class CloudflareDnsProvider
{
    private const API = 'https://api.cloudflare.com/client/v4/';

    private Client $http;
    private string $zoneId;

    private function __construct(string $token, string $zoneId)
    {
        $this->zoneId = $zoneId;
        $this->http = new Client([
            'base_uri' => self::API,
            'timeout' => 10,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'User-Agent' => 'gynx.gg panel (+https://gynx.gg)',
            ],
        ]);
    }

    public static function forZone(SubdomainZone $zone): self
    {
        return new self($zone->provider_token, $zone->provider_zone_id);
    }

    /**
     * @param array $payload See CF API docs. Required keys: type, name, content.
     *                       Optional: ttl (default 1 = auto), proxied, priority/data for SRV.
     * @return array         The created record (CF response.result).
     */
    public function createRecord(array $payload): array
    {
        return $this->call('POST', "zones/{$this->zoneId}/dns_records", ['json' => $payload]);
    }

    public function updateRecord(string $recordId, array $payload): array
    {
        return $this->call('PUT', "zones/{$this->zoneId}/dns_records/{$recordId}", ['json' => $payload]);
    }

    public function deleteRecord(string $recordId): void
    {
        $this->call('DELETE', "zones/{$this->zoneId}/dns_records/{$recordId}");
    }

    /**
     * List records under this zone. Useful for the admin "what subdomains
     * are already taken" view. Optionally filter by name.
     */
    public function listRecords(?string $name = null, int $perPage = 100): array
    {
        $query = ['per_page' => $perPage];
        if ($name) $query['name'] = $name;
        return $this->call('GET', "zones/{$this->zoneId}/dns_records", ['query' => $query]);
    }

    /**
     * Verify the token works against the configured zone. Returns true if
     * we can list records, false (with a thrown exception) otherwise.
     */
    public function verifyAccess(): bool
    {
        try {
            $this->listRecords(null, 1);
            return true;
        } catch (\Throwable $e) {
            throw new ConflictHttpException('Cloudflare token rejected for this zone: ' . $e->getMessage());
        }
    }

    private function call(string $method, string $path, array $options = []): array
    {
        try {
            $res = $this->http->request($method, $path, $options);
        } catch (TransferException $e) {
            throw new BadGatewayHttpException('Cloudflare API call failed: ' . $e->getMessage());
        }

        $body = json_decode((string) $res->getBody(), true) ?: [];
        // CF returns { success: bool, errors: [...], result: ... } on every call.
        if (empty($body['success'])) {
            $msg = $body['errors'][0]['message'] ?? 'unknown Cloudflare error';
            throw new ConflictHttpException("Cloudflare: {$msg}");
        }

        return is_array($body['result'] ?? null) ? $body['result'] : [];
    }
}
