<?php

namespace Pterodactyl\Services\Addons;

use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use GuzzleHttp\Cookie\SetCookie;
use GuzzleHttp\Exception\TransferException;

/**
 * Solves Cloudflare challenges (SpigotMC's anti-bot is the canonical
 * reason this exists) using a sidecar FlareSolverr container.
 *
 * The customer enables this by passing `--with-flaresolverr` to
 * install.sh, which runs the FlareSolverr Docker container locally on
 * the panel host and writes `CRATE_FLARESOLVERR_URL` into the panel's
 * .env. When that env var is set, `available()` returns true and
 * `PluginInstallerService::install` routes Spigot downloads through
 * `fetchViaCloudflareBypass()` instead of handing the URL straight to
 * Wings.
 *
 * Pipeline:
 *   1. POST to FlareSolverr's /v1 endpoint with `cmd=request.get` for
 *      the resource's domain. FlareSolverr launches Chromium, solves
 *      the JS challenge, and returns session cookies + the User-Agent
 *      that satisfied Cloudflare.
 *   2. Re-fetch the actual file URL with those cookies + UA via a
 *      regular Guzzle GET. Stream the response body to a temp file
 *      under `storage/app/crate-staging/`.
 *   3. Hand the staged file path back to the caller, which uploads
 *      its contents to Wings via `DaemonFileRepository::putContent()`.
 *      No public URL exposure — Wings receives the bytes from PHP
 *      directly, never touches Cloudflare.
 *   4. Caller calls `deleteStaged()` after upload (or on failure).
 *
 * If FlareSolverr is not configured, `available()` is false and
 * adapters fall back to the direct-URL path (which 502s on
 * CF-blocked resources, with a helpful "install --with-flaresolverr"
 * message in the BadGateway wrap).
 */
class CrateFlareSolverrService
{
    private ?string $endpoint;

    private Client $http;

    private string $stagingDir;

    public function __construct()
    {
        $url = (string) env('CRATE_FLARESOLVERR_URL', '');
        $this->endpoint = $url !== '' ? rtrim($url, '/') : null;
        $this->http = new Client(['timeout' => 90]);
        $this->stagingDir = storage_path('app/crate-staging');
    }

    /**
     * True if CRATE_FLARESOLVERR_URL is configured. Existence-only
     * check; the actual connectivity test happens at fetch time so we
     * don't pay a probe cost on every page load.
     */
    public function available(): bool
    {
        return $this->endpoint !== null;
    }

    /**
     * Solve Cloudflare for a target URL, then download the file using
     * the resulting session. Returns the on-disk staged path + size +
     * sha256 hash so the caller can verify and upload to Wings.
     *
     * @return array{
     *   staged_path: string, file_size: int, file_hash: string,
     * }
     *
     * @throws \LogicException when FlareSolverr is not configured.
     * @throws \RuntimeException when the bypass fails — message is
     *   safe to surface to the customer (premium/login required,
     *   FlareSolverr unreachable, target server returned an error).
     */
    public function fetchViaCloudflareBypass(string $url): array
    {
        if (! $this->available()) {
            throw new \LogicException('FlareSolverr is not configured. Re-run install.sh with --with-flaresolverr to enable Cloudflare bypass for SpigotMC downloads.');
        }

        // Step 1: solve CF for the target domain — gives us cookies + UA
        // that the Cloudflare edge will accept on subsequent requests.
        $session = $this->solveCloudflare($url);

        // Step 2: ensure staging dir exists, generate a unique path.
        if (! is_dir($this->stagingDir)) {
            @mkdir($this->stagingDir, 0700, true);
        }
        $token = bin2hex(random_bytes(16));
        $stagedPath = $this->stagingDir . '/' . $token . '.bin';

        // Step 3: download the actual file with the CF session.
        $cookieJar = new CookieJar();
        foreach ($session['cookies'] as $cookie) {
            $cookieJar->setCookie(new SetCookie([
                'Name' => (string) ($cookie['name'] ?? ''),
                'Value' => (string) ($cookie['value'] ?? ''),
                'Domain' => (string) ($cookie['domain'] ?? ''),
                'Path' => (string) ($cookie['path'] ?? '/'),
            ]));
        }

        try {
            $this->http->get($url, [
                'cookies' => $cookieJar,
                'headers' => [
                    'User-Agent' => $session['userAgent'],
                    'Accept' => '*/*',
                ],
                'sink' => $stagedPath,
                'allow_redirects' => true,
                'timeout' => 120,
            ]);
        } catch (TransferException $e) {
            @unlink($stagedPath);
            throw new \RuntimeException(
                'Cloudflare was bypassed but the file fetch failed afterwards: ' . $e->getMessage()
                . '. The resource may be premium (requires a logged-in SpigotMC account) or hosted off-site on a dead link. Download manually from spigotmc.org and upload via your panel\'s File Manager.',
                0,
                $e,
            );
        }

        $fileSize = (int) (@filesize($stagedPath) ?: 0);
        if ($fileSize === 0) {
            @unlink($stagedPath);
            throw new \RuntimeException(
                'Cloudflare bypass returned an empty file. This usually means the resource is premium and requires a logged-in SpigotMC account, or the author hosts it on an off-site link that is no longer reachable. Download manually from spigotmc.org and upload via your panel\'s File Manager.',
            );
        }

        // Quick sanity check: HTML responses indicate we landed on the
        // CF challenge page or a "you need to log in" page rather than
        // an actual jar/zip. Detect by reading the first few bytes.
        $sniff = (string) (@file_get_contents($stagedPath, false, null, 0, 64) ?: '');
        $sniffLower = strtolower($sniff);
        if (str_contains($sniffLower, '<!doctype html') || str_contains($sniffLower, '<html')) {
            @unlink($stagedPath);
            throw new \RuntimeException(
                'Bypass returned an HTML page instead of a download. Possible causes: (1) the resource is premium and requires a logged-in SpigotMC account; (2) the author hosts the file on an external site (Discord, MediaFire, etc.) that has its own gate; (3) the redirect target uses a different Cloudflare-protected domain than the one we solved. Download manually from spigotmc.org and upload via your panel\'s File Manager.',
            );
        }

        return [
            'staged_path' => $stagedPath,
            'file_size' => $fileSize,
            'file_hash' => hash_file('sha256', $stagedPath) ?: '',
        ];
    }

    /**
     * Delete a file previously returned by fetchViaCloudflareBypass.
     * Safe to call on a path that no longer exists. Path-validates that
     * we don't delete outside the staging directory.
     */
    public function deleteStaged(string $path): void
    {
        $real = realpath($path) ?: $path;
        $stagingReal = realpath($this->stagingDir) ?: $this->stagingDir;
        if ($stagingReal && str_starts_with($real, $stagingReal) && is_file($real)) {
            @unlink($real);
        }
    }

    /**
     * @return array{cookies: array<int, array<string, mixed>>, userAgent: string}
     */
    private function solveCloudflare(string $url): array
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (! is_string($host) || $host === '') {
            throw new \RuntimeException('Cannot extract domain from URL for Cloudflare bypass: ' . $url);
        }

        // Domain-routing for redirect chains:
        //   - api.spiget.org doesn't itself sit behind Cloudflare. Its
        //     /resources/{id}/download endpoint 302-redirects to
        //     spigotmc.org, which DOES have CF. Solving CF for
        //     api.spiget.org returns useless cookies; solving for
        //     spigotmc.org gives cookies that satisfy the redirect target.
        //   - Same goes for any other indirection: solve CF on the
        //     domain that actually serves the file, not the API gateway.
        $cfDomain = str_ends_with($host, 'spiget.org') ? 'www.spigotmc.org' : $host;

        try {
            $res = $this->http->post($this->endpoint . '/v1', [
                'json' => [
                    'cmd' => 'request.get',
                    'url' => "https://{$cfDomain}/",
                    'maxTimeout' => 60000,
                ],
                'timeout' => 90,
            ]);
        } catch (TransferException $e) {
            throw new \RuntimeException(
                'FlareSolverr is unreachable at ' . $this->endpoint . '. Verify the container is running (docker ps | grep flaresolverr) and CRATE_FLARESOLVERR_URL points at the right port.',
                0,
                $e,
            );
        }

        $body = json_decode((string) $res->getBody(), true) ?: [];
        $solution = $body['solution'] ?? null;

        if (! is_array($solution) || (int) ($solution['status'] ?? 0) >= 400) {
            $msg = (string) ($body['message'] ?? 'Cloudflare challenge could not be solved.');
            throw new \RuntimeException(
                'Cloudflare bypass failed: ' . $msg . ' The resource may be premium or otherwise unavailable to anonymous users — download manually from the source page and upload via your panel\'s File Manager.',
            );
        }

        return [
            'cookies' => is_array($solution['cookies'] ?? null) ? $solution['cookies'] : [],
            'userAgent' => (string) ($solution['userAgent'] ?? ''),
        ];
    }
}
