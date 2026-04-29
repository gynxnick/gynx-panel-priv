<?php

namespace Pterodactyl\Services\Ai;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Symfony\Component\HttpKernel\Exception\BadGatewayHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Gemini provider for gynx.ai. Talks to the Generative Language API
 * (generativelanguage.googleapis.com) — single-shot generateContent
 * call, batched JSON, no streaming for v1.
 *
 * Endpoint: POST /v1beta/models/{model}:generateContent?key=...
 * Docs:     https://ai.google.dev/api/generate-content
 */
class GeminiProvider implements AiProvider
{
    private Client $http;
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = (string) config('services.gynx_ai.gemini.api_key', '');
        $this->model = (string) config('services.gynx_ai.gemini.model', 'gemini-2.0-flash');

        $this->http = new Client([
            'base_uri' => 'https://generativelanguage.googleapis.com/',
            'timeout' => 25,
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
        ]);
    }

    public function available(): bool
    {
        return $this->apiKey !== '';
    }

    public function slug(): string
    {
        return 'gemini';
    }

    public function complete(string $systemPrompt, string $userPrompt): array
    {
        if (!$this->available()) {
            throw new HttpException(503, 'Gemini provider is not configured (missing GEMINI_API_KEY).');
        }

        $body = [
            'systemInstruction' => [
                'parts' => [['text' => $systemPrompt]],
            ],
            'contents' => [[
                'role' => 'user',
                'parts' => [['text' => $userPrompt]],
            ]],
            'generationConfig' => [
                // Lower temperature = more deterministic; useful for
                // diagnostic answers where we want consistent reasoning,
                // not creative tangents.
                'temperature' => 0.3,
                'maxOutputTokens' => 1024,
                'topP' => 0.95,
            ],
            // Loosen the safety filters to BLOCK_ONLY_HIGH — the default
            // BLOCK_MEDIUM trips on swear words in console output and
            // returns an empty response with a vague reason.
            'safetySettings' => [
                ['category' => 'HARM_CATEGORY_HARASSMENT',        'threshold' => 'BLOCK_ONLY_HIGH'],
                ['category' => 'HARM_CATEGORY_HATE_SPEECH',       'threshold' => 'BLOCK_ONLY_HIGH'],
                ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_ONLY_HIGH'],
                ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_ONLY_HIGH'],
            ],
        ];

        try {
            $res = $this->http->post(
                'v1beta/models/' . urlencode($this->model) . ':generateContent',
                [
                    'query' => ['key' => $this->apiKey],
                    'json' => $body,
                ],
            );
        } catch (TransferException $e) {
            throw new BadGatewayHttpException('Gemini request failed: ' . $e->getMessage());
        }

        $data = json_decode((string) $res->getBody(), true);
        if (!is_array($data)) {
            throw new BadGatewayHttpException('Gemini returned a non-JSON response.');
        }

        // Gemini returns candidates[0].content.parts[*].text. Concat parts
        // because the API can split a response across multiple text parts.
        $candidate = $data['candidates'][0] ?? null;
        if (!$candidate || !isset($candidate['content']['parts']) || !is_array($candidate['content']['parts'])) {
            // Safety filter trip → finishReason is SAFETY and content is empty.
            $reason = $candidate['finishReason'] ?? ($data['promptFeedback']['blockReason'] ?? 'unknown');
            throw new HttpException(502, "Gemini returned no content (reason: {$reason}).");
        }

        $text = '';
        foreach ($candidate['content']['parts'] as $part) {
            if (isset($part['text']) && is_string($part['text'])) {
                $text .= $part['text'];
            }
        }

        $usage = $data['usageMetadata'] ?? [];
        return [
            'text' => trim($text),
            'tokens_in' => (int) ($usage['promptTokenCount'] ?? 0),
            'tokens_out' => (int) ($usage['candidatesTokenCount'] ?? 0),
        ];
    }
}
