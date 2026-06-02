<?php

namespace Pterodactyl\Services\Addons\SlotSources;

use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;

/**
 * Slot count lives in a Java-properties file on the server's filesystem
 * (`key=value` pairs, `#` and `!` comments). This is how the default
 * Pterodactyl Minecraft eggs work — they don't expose a `MAX_PLAYERS`
 * panel variable; the value is set directly in `server.properties`.
 *
 * Configuration shape in the AddonGameRegistry game profile:
 *
 *     'slot_source' => [
 *         'type' => 'properties_file',
 *         'path' => '/server.properties',
 *         'key'  => 'max-players',
 *         'min'  => 1,
 *         'max'  => 1000,
 *     ]
 *
 * Editing semantics: we read the file, find the line whose key matches,
 * rewrite that single line in place (preserving everything else),
 * and write the file back. If the key is missing, we append it. The
 * file's other lines + comments + ordering are preserved.
 */
class PropertiesFileSlotSource implements SlotSource
{
    public function __construct(
        private readonly DaemonFileRepository $files,
        private readonly string $path,
        private readonly string $key,
        private readonly int $min = 1,
        private readonly int $max = 999,
    ) {
    }

    public function read(Server $server): ?SlotState
    {
        $contents = $this->safeRead($server);
        if ($contents === null) {
            // File doesn't exist yet (fresh server). Surface as "no value
            // detected" rather than null-the-strategy so the card still
            // renders with the range and the user can set a value, which
            // will create the file on save (Wings' put auto-creates).
            return new SlotState(
                value: null,
                min: $this->min,
                max: $this->max,
                userEditable: true,
                sourceLabel: trim($this->path, '/') . ':' . $this->key,
                variableName: $this->key,
            );
        }

        $value = $this->extractValue($contents);

        return new SlotState(
            value: $value,
            min: $this->min,
            max: $this->max,
            userEditable: true,
            sourceLabel: trim($this->path, '/') . ':' . $this->key,
            variableName: $this->key,
        );
    }

    public function write(Server $server, int $value): SlotState
    {
        if ($value < $this->min || $value > $this->max) {
            throw new SlotSourceException("Value must be between {$this->min} and {$this->max}.", 422);
        }

        $contents = $this->safeRead($server) ?? '';
        $updated = $this->replaceOrAppend($contents, $value);

        try {
            $this->files->setServer($server)->putContent($this->path, $updated);
        } catch (\Throwable $e) {
            throw new SlotSourceException(
                'Could not write ' . $this->path . ': ' . $e->getMessage(),
                502,
            );
        }

        return new SlotState(
            value: $value,
            min: $this->min,
            max: $this->max,
            userEditable: true,
            sourceLabel: trim($this->path, '/') . ':' . $this->key,
            variableName: $this->key,
        );
    }

    /** Returns the file contents, or null when the file is missing / unreadable. */
    private function safeRead(Server $server): ?string
    {
        try {
            return $this->files->setServer($server)->getContent($this->path);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Pull the integer value of the matching key from a properties file.
     * Returns null when the key isn't present or its value isn't an int.
     */
    private function extractValue(string $contents): ?int
    {
        foreach (preg_split('/\r?\n/', $contents) as $raw) {
            $line = ltrim($raw);
            if ($line === '' || $line[0] === '#' || $line[0] === '!') continue;

            // Java properties accept `=` or `:` as the separator.
            $eq = strpos($line, '=');
            $cn = strpos($line, ':');
            $sep = ($eq === false) ? $cn : (($cn === false) ? $eq : min($eq, $cn));
            if ($sep === false) continue;

            $k = rtrim(substr($line, 0, $sep));
            if (strcasecmp($k, $this->key) !== 0) continue;

            $v = trim(substr($line, $sep + 1));
            $parsed = filter_var($v, FILTER_VALIDATE_INT);
            return $parsed === false ? null : $parsed;
        }

        return null;
    }

    /**
     * Replace the matching line in place if present, otherwise append a
     * new `key=value` line. Everything else — comments, ordering, even
     * trailing whitespace — is preserved untouched.
     */
    private function replaceOrAppend(string $contents, int $value): string
    {
        $newLine = $this->key . '=' . $value;
        $lines = preg_split('/\r?\n/', $contents);

        $found = false;
        foreach ($lines as $i => $raw) {
            $line = ltrim($raw);
            if ($line === '' || $line[0] === '#' || $line[0] === '!') continue;

            $eq = strpos($line, '=');
            $cn = strpos($line, ':');
            $sep = ($eq === false) ? $cn : (($cn === false) ? $eq : min($eq, $cn));
            if ($sep === false) continue;

            $k = rtrim(substr($line, 0, $sep));
            if (strcasecmp($k, $this->key) === 0) {
                $lines[$i] = $newLine;
                $found = true;
                break; // properties files: first occurrence wins, others are ignored anyway
            }
        }

        if (!$found) {
            // Trim a single trailing empty line, append, then re-add the newline.
            if (end($lines) === '') array_pop($lines);
            $lines[] = $newLine;
        }

        return implode("\n", $lines);
    }
}
