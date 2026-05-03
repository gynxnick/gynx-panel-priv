<?php

namespace Pterodactyl\Services\Ai;

/**
 * Provider-agnostic interface for the gynx.ai diagnostic assistant.
 *
 * v1 ships only the Gemini implementation (cheapest at our expected
 * volume — see the cost projection in the implementation PR), but the
 * shape here is deliberately the LCD across Gemini / Claude / OpenAI
 * so adding either later is a class, not a refactor.
 */
interface AiProvider
{
    /**
     * Whether this provider has the credentials it needs to actually run.
     * The controller checks this before accepting a request so a missing
     * key surfaces as a clean "AI is disabled" error instead of an HTTP
     * blow-up deep inside the SDK.
     */
    public function available(): bool;

    /**
     * Send a single-turn diagnostic request.
     *
     * @param string $systemPrompt   The role-setting prompt. Treated by
     *                               Gemini as a systemInstruction; for
     *                               Claude/OpenAI it'll map to system role.
     * @param string $userPrompt     The user-facing message. Already
     *                               composed by GynxAiService — includes
     *                               the question + any console / crash
     *                               context the frontend supplied.
     * @return array{text:string, tokens_in:int, tokens_out:int}
     */
    public function complete(string $systemPrompt, string $userPrompt): array;

    /** Provider slug for logging / activity events. */
    public function slug(): string;
}
