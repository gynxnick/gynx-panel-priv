<?php

namespace Pterodactyl\Services\Ai;

use Pterodactyl\Models\Server;

/**
 * Domain service for the gynx.ai diagnostic assistant. Composes a
 * system prompt + the user's question + caller-supplied context
 * (recent console lines, a crash report) into a single Gemini turn.
 *
 * Stays provider-agnostic — the AiProvider implementation is
 * injected. Swapping Gemini for Claude/OpenAI later is a binding
 * change, not a service rewrite.
 */
class GynxAiService
{
    public function __construct(
        private AiProvider $provider,
    ) {
    }

    public function provider(): AiProvider
    {
        return $this->provider;
    }

    /**
     * @param Server  $server          The server the question is about.
     * @param string  $question        The user's natural-language ask.
     * @param string  $consoleSnippet  Recent console lines (already trimmed).
     * @param ?string $crashContent    Optional crash report payload.
     *
     * @return array{text:string, tokens_in:int, tokens_out:int}
     */
    public function diagnose(
        Server $server,
        string $question,
        string $consoleSnippet = '',
        ?string $crashContent = null,
    ): array {
        $maxChars = (int) config('services.gynx_ai.max_context_chars', 60000);
        $consoleSnippet = $this->truncate($consoleSnippet, $maxChars);
        $crashContent = $crashContent !== null ? $this->truncate($crashContent, $maxChars) : null;

        $system = $this->systemPrompt($server);
        $user = $this->userPrompt($question, $consoleSnippet, $crashContent);

        return $this->provider->complete($system, $user);
    }

    private function systemPrompt(Server $server): string
    {
        $eggName = optional($server->egg)->name ?? 'unknown egg';
        $nestName = optional(optional($server->egg)->nest)->name ?? 'unknown nest';

        return <<<PROMPT
            You are gynx.ai, the in-panel diagnostic assistant for gynx.gg, a game-server hosting platform.

            Your job: when a user reports a problem (server won't start, crashing, performance issue, mod conflict), look at the console output and crash logs they share with you, and give them a focused, actionable answer.

            Format every response as:
            1. **Diagnosis** — one or two sentences naming the root cause. Be specific. Quote the line that gave it away.
            2. **Fix** — the exact steps to resolve it, in order. Mention specific files/paths/commands the user can act on inside the panel (the file manager, the startup variables page, etc.).
            3. **If you're not sure** — say so plainly. Ask for the *one* most useful additional input (a specific log file, the startup command, etc.) instead of guessing.

            Hard rules:
            - Don't fabricate mod names, file paths, or version numbers. If the log doesn't say it, don't claim it.
            - Don't suggest the user contact gynx support unless you've genuinely exhausted what you can diagnose from the data.
            - Skip preamble. Skip "great question!". Skip safety disclaimers about modifying files — the user owns the server.
            - Markdown is fine. No emoji.

            Server context:
            - egg: {$eggName} (nest: {$nestName})
            - server id: {$server->uuid}
            PROMPT;
    }

    private function userPrompt(string $question, string $consoleSnippet, ?string $crashContent): string
    {
        $sections = [];

        if ($consoleSnippet !== '') {
            $sections[] = "## Recent console output\n```\n" . $consoleSnippet . "\n```";
        }

        if ($crashContent !== null && $crashContent !== '') {
            $sections[] = "## Crash report\n```\n" . $crashContent . "\n```";
        }

        $sections[] = "## Question\n" . $question;

        return implode("\n\n", $sections);
    }

    /**
     * Cap a string to $max bytes, preserving the *tail* (most recent
     * lines) since that's where the failure usually lives. Adds a
     * one-line ellipsis marker so the model knows there was more.
     */
    private function truncate(string $s, int $max): string
    {
        if (strlen($s) <= $max) return $s;
        $tail = substr($s, -$max);
        return "... [truncated " . (strlen($s) - $max) . " bytes from the start] ...\n" . $tail;
    }
}
