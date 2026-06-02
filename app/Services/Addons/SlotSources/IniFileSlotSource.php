<?php

namespace Pterodactyl\Services\Addons\SlotSources;

use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;

/**
 * Slot count lives in an INI-style file scoped to a `[Section]`. Used by
 * ARK GameUserSettings.ini (`[ServerSettings]` → `MaxPlayers`) and any
 * Unreal-engine-style game whose server caps live in a sectioned config.
 *
 * Configuration shape in the AddonGameRegistry game profile:
 *
 *     'slot_source' => [
 *         'type'    => 'ini_file',
 *         'path'    => '/ShooterGame/Saved/Config/LinuxServer/GameUserSettings.ini',
 *         'section' => 'ServerSettings',
 *         'key'     => 'MaxPlayers',
 *         'min'     => 1,
 *         'max'     => 1000,
 *     ]
 *
 * Editing semantics: same line-preserving approach as the properties
 * strategy, but scoped to the right [Section]. If the section doesn't
 * exist, we append a new one at the end of the file. If the section
 * exists but the key doesn't, we add the key as the last line of the
 * section (before the next `[` header) so it sits visually with its
 * siblings.
 */
class IniFileSlotSource implements SlotSource
{
    public function __construct(
        private readonly DaemonFileRepository $files,
        private readonly string $path,
        private readonly string $section,
        private readonly string $key,
        private readonly int $min = 1,
        private readonly int $max = 999,
    ) {
    }

    public function read(Server $server): ?SlotState
    {
        $contents = $this->safeRead($server);
        if ($contents === null) {
            return new SlotState(
                value: null,
                min: $this->min,
                max: $this->max,
                userEditable: true,
                sourceLabel: $this->buildSourceLabel(),
                variableName: $this->key,
            );
        }

        $value = $this->extractValue($contents);

        return new SlotState(
            value: $value,
            min: $this->min,
            max: $this->max,
            userEditable: true,
            sourceLabel: $this->buildSourceLabel(),
            variableName: $this->key,
        );
    }

    public function write(Server $server, int $value): SlotState
    {
        if ($value < $this->min || $value > $this->max) {
            throw new SlotSourceException("Value must be between {$this->min} and {$this->max}.", 422);
        }

        $contents = $this->safeRead($server) ?? '';
        $updated = $this->upsert($contents, $value);

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
            sourceLabel: $this->buildSourceLabel(),
            variableName: $this->key,
        );
    }

    private function safeRead(Server $server): ?string
    {
        try {
            return $this->files->setServer($server)->getContent($this->path);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function buildSourceLabel(): string
    {
        return trim($this->path, '/') . ' [' . $this->section . '] ' . $this->key;
    }

    private function isSectionHeader(string $line, ?string &$name = null): bool
    {
        if ($line === '' || $line[0] !== '[') return false;
        $end = strpos($line, ']');
        if ($end === false) return false;
        $name = trim(substr($line, 1, $end - 1));
        return true;
    }

    private function extractValue(string $contents): ?int
    {
        $inSection = false;
        foreach (preg_split('/\r?\n/', $contents) as $raw) {
            $line = trim($raw);
            if ($line === '' || $line[0] === ';' || $line[0] === '#') continue;

            $name = null;
            if ($this->isSectionHeader($line, $name)) {
                $inSection = ($name !== null && strcasecmp($name, $this->section) === 0);
                continue;
            }
            if (!$inSection) continue;

            $eq = strpos($line, '=');
            if ($eq === false) continue;

            $k = trim(substr($line, 0, $eq));
            if (strcasecmp($k, $this->key) !== 0) continue;

            $v = trim(substr($line, $eq + 1));
            $parsed = filter_var($v, FILTER_VALIDATE_INT);
            return $parsed === false ? null : $parsed;
        }

        return null;
    }

    /** Insert/replace the key inside the matching section, appending the section if missing. */
    private function upsert(string $contents, int $value): string
    {
        $newAssign = $this->key . '=' . $value;
        $lines = preg_split('/\r?\n/', $contents);

        $inSection = false;
        $sectionStart = -1;
        $sectionEnd = -1; // exclusive — index of first line AFTER the section
        $replaced = false;

        foreach ($lines as $i => $raw) {
            $line = trim($raw);
            $name = null;
            if ($this->isSectionHeader($line, $name)) {
                if ($inSection) {
                    // Hit the next section before finding the key — note where to insert.
                    $sectionEnd = $i;
                    break;
                }
                if ($name !== null && strcasecmp($name, $this->section) === 0) {
                    $inSection = true;
                    $sectionStart = $i;
                }
                continue;
            }
            if (!$inSection) continue;

            $eq = strpos($line, '=');
            if ($eq === false) continue;
            $k = trim(substr($line, 0, $eq));
            if (strcasecmp($k, $this->key) === 0) {
                $lines[$i] = $newAssign;
                $replaced = true;
                break;
            }
        }

        if ($replaced) {
            return implode("\n", $lines);
        }

        if ($sectionStart < 0) {
            // Section missing entirely — append a new block at the end.
            if (end($lines) === '') array_pop($lines);
            if (!empty($lines)) $lines[] = '';
            $lines[] = '[' . $this->section . ']';
            $lines[] = $newAssign;
            return implode("\n", $lines);
        }

        // Section exists but key doesn't. Insert just before the next section
        // (or at the file end if this section runs to EOF).
        $insertAt = $sectionEnd >= 0 ? $sectionEnd : count($lines);
        array_splice($lines, $insertAt, 0, [$newAssign]);
        return implode("\n", $lines);
    }
}
