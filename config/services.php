<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // gynx.ai — diagnostic assistant. Provider abstraction defaults to
    // Gemini for v1; swap to claude or openai by changing GYNX_AI_PROVIDER.
    'gynx_ai' => [
        'enabled' => env('GYNX_AI_ENABLED', false),
        'provider' => env('GYNX_AI_PROVIDER', 'gemini'),
        'gemini' => [
            'api_key' => env('GEMINI_API_KEY'),
            'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),
        ],
        // Per-server, per-day cap. Trips a 429 once exceeded; resets at
        // midnight server-time. Tune via env if real usage diverges.
        'daily_cap_per_server' => (int) env('GYNX_AI_DAILY_CAP', 20),
        // Hard ceiling on user-supplied context (console + crash) so a
        // 50MB log dump can't blow the request size.
        'max_context_chars' => (int) env('GYNX_AI_MAX_CONTEXT_CHARS', 60000),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
];
