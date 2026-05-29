{{--
    Gynx "Aurora" branded notification email.

    Every panel notification renders through Laravel's MailMessage API into
    THIS single template, so all outgoing mail (welcome, password reset,
    verification, server deployed, suspension, billing, support) inherits the
    Gynx identity from one place. Notification classes pass:
        $greeting, $introLines[], $actionText, $actionUrl, $outroLines[], $level

    Branding (logo, site name, footer copy) is read live from the
    `settings::gynx:*` namespace so admins can rebrand without touching code.

    Hostile-client rules followed here:
      - table layout + inline styles (Outlook/Word engine)
      - VML bulletproof button for Outlook gradients
      - web fonts via <link> (Apple Mail) with web-safe fallback stacks
      - animations only via @keyframes (Apple Mail/iOS) -> static fallback
      - dark forced via explicit bgcolor + color-scheme meta
--}}
@php
    // --- Branding (read live, never let a DB hiccup break delivery) -------
    $siteName = (string) config('app.name', 'gynx.gg');
    $logoUrl = '';
    $footerCopy = '';
    $tagline = '';
    try {
        $settings = app(\Pterodactyl\Contracts\Repository\SettingsRepositoryInterface::class);
        $siteName = (string) ($settings->get('settings::gynx:site_name', $siteName) ?: $siteName);
        $logoUrl = trim((string) $settings->get('settings::gynx:logo_url', ''));
        $footerCopy = trim((string) $settings->get('settings::gynx:footer_copy', ''));
        $tagline = trim((string) $settings->get('settings::gynx:tagline', 'host smarter. play harder.'));
    } catch (\Throwable $e) {
        // settings table unavailable (fresh install / migration) — defaults only.
    }
    $panelUrl = rtrim((string) config('app.url', url('/')), '/') ?: url('/');

    // --- Level -> accent palette -----------------------------------------
    // pink (#EC4899) is the brand's reserved destructive/CTA highlight.
    $lvl = $level ?? 'default';
    $accents = [
        'success' => ['grad' => 'linear-gradient(135deg, #34D399 0%, #22D3EE 100%)', 'solid' => '#10B981', 'glow' => 'rgba(52,211,153,0.45)'],
        'error'   => ['grad' => 'linear-gradient(135deg, #EC4899 0%, #EF4444 100%)', 'solid' => '#EC4899', 'glow' => 'rgba(236,72,153,0.45)'],
        'default' => ['grad' => 'linear-gradient(135deg, #7C3AED 0%, #22D3EE 100%)', 'solid' => '#7C3AED', 'glow' => 'rgba(124,58,237,0.45)'],
    ];
    $a = $accents[$lvl] ?? $accents['default'];
    $headerGrad = 'linear-gradient(120deg, #7C3AED 0%, #6D28D9 45%, #22D3EE 100%)';

    // --- Preheader (inbox preview) ---------------------------------------
    $preheader = '';
    if (!empty($introLines) && is_iterable($introLines)) {
        foreach ($introLines as $l) { $preheader = trim((string) $l); if ($preheader !== '') break; }
    }
    if ($preheader === '') { $preheader = $siteName; }

    // --- Inline style tokens ---------------------------------------------
    $fontDisplay = "font-family: 'Space Grotesk', 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif;";
    $fontBody    = "font-family: 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif;";
    $fontMono    = "font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;";
@endphp
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>{{ $siteName }}</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style type="text/css">
        :root { color-scheme: dark; supported-color-schemes: dark; }
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
        a { color: #67E8F9; }

        /* graceful animation — Apple Mail / iOS Mail honor @keyframes; every
           other client just sees the resting (static) state, still premium. */
        @keyframes gxAurora { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes gxGlow   { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.9; } }
        .gx-aurora { background-size: 220% 220%; animation: gxAurora 9s ease infinite; }
        .gx-glow   { animation: gxGlow 3.4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
            .gx-aurora, .gx-glow { animation: none !important; }
        }

        @media only screen and (max-width: 600px) {
            .gx-container { width: 100% !important; }
            .gx-pad       { padding-left: 24px !important; padding-right: 24px !important; }
            .gx-pad-v     { padding-top: 28px !important; padding-bottom: 28px !important; }
            .gx-h1        { font-size: 22px !important; line-height: 30px !important; }
            .gx-btn-cell  { width: 100% !important; }
            .gx-btn       { display: block !important; width: 100% !important; box-sizing: border-box !important; }
            .gx-header-pad { padding: 28px 24px !important; }
        }
    </style>
</head>
<body style="margin:0; padding:0; width:100%; background-color:#0B0B0F;" bgcolor="#0B0B0F">
    <!-- preheader: shows in the inbox list, hidden in the body -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#0B0B0F; opacity:0;">
        {{ $preheader }}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0B0F;" bgcolor="#0B0B0F">
        <tr>
            <td align="center" style="padding: 32px 12px;">

                <!-- ===================== CARD ===================== -->
                <table role="presentation" class="gx-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#14141C; border-radius:18px; overflow:hidden; border:1px solid rgba(255,255,255,0.07);" bgcolor="#14141C">

                    <!-- Header band: aurora gradient -->
                    <tr>
                        <td class="gx-aurora gx-header-pad" align="center" valign="middle"
                            style="padding:34px 40px; background-color:#6D28D9; background-image:{{ $headerGrad }}; text-align:center;"
                            bgcolor="#6D28D9">
                            @if ($logoUrl !== '')
                                <a href="{{ $panelUrl }}" target="_blank" style="text-decoration:none; border:0;">
                                    <img src="{{ $logoUrl }}" alt="{{ $siteName }}" height="38" style="height:38px; max-height:38px; width:auto; display:inline-block; border:0;">
                                </a>
                            @else
                                <a href="{{ $panelUrl }}" target="_blank" style="{{ $fontDisplay }} font-size:26px; font-weight:700; letter-spacing:-0.02em; color:#FFFFFF; text-decoration:none; text-shadow:0 1px 2px rgba(0,0,0,0.25);">
                                    {{ $siteName }}
                                </a>
                            @endif
                        </td>
                    </tr>

                    <!-- Level accent strip -->
                    <tr>
                        <td style="font-size:0; line-height:0; height:4px; background-color:{{ $a['solid'] }}; background-image:{{ $a['grad'] }};" bgcolor="{{ $a['solid'] }}">&nbsp;</td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td class="gx-pad gx-pad-v" style="padding:40px 44px 36px 44px;">

                            @if (!empty($greeting))
                                <h1 class="gx-h1" style="{{ $fontDisplay }} margin:0 0 18px 0; color:#F4F4F6; font-size:24px; line-height:32px; font-weight:600; letter-spacing:-0.01em;">
                                    {{ $greeting }}
                                </h1>
                            @else
                                <h1 class="gx-h1" style="{{ $fontDisplay }} margin:0 0 18px 0; color:#F4F4F6; font-size:24px; line-height:32px; font-weight:600; letter-spacing:-0.01em;">
                                    @if ($lvl == 'error') Heads up @else Hello @endif
                                </h1>
                            @endif

                            @foreach ($introLines as $line)
                                <p style="{{ $fontBody }} margin:0 0 16px 0; color:#AEB4C0; font-size:15px; line-height:25px;">
                                    {{ $line }}
                                </p>
                            @endforeach

                            @isset($actionText)
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 26px 0;">
                                    <tr>
                                        <td align="center">
                                            <!--[if mso]>
                                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ $actionUrl }}" style="height:50px; v-text-anchor:middle; width:300px;" arcsize="24%" strokecolor="{{ $a['solid'] }}" fillcolor="{{ $a['solid'] }}">
                                                <w:anchorlock/>
                                                <center style="color:#ffffff; font-family:'Segoe UI',Arial,sans-serif; font-size:15px; font-weight:bold;">{{ $actionText }}</center>
                                            </v:roundrect>
                                            <![endif]-->
                                            <!--[if !mso]><!-->
                                            <table role="presentation" class="gx-btn-cell" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                                                <tr>
                                                    <td class="gx-glow" align="center"
                                                        style="border-radius:12px; background-color:{{ $a['solid'] }}; background-image:{{ $a['grad'] }}; box-shadow:0 8px 26px -8px {{ $a['glow'] }};">
                                                        <a href="{{ $actionUrl }}" target="_blank" class="gx-btn"
                                                           style="{{ $fontBody }} display:inline-block; padding:15px 38px; color:#FFFFFF; font-size:15px; font-weight:600; line-height:20px; text-decoration:none; border-radius:12px; letter-spacing:0.01em;">
                                                            {{ $actionText }}
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                            <!--<![endif]-->
                                        </td>
                                    </tr>
                                </table>
                            @endisset

                            @foreach ($outroLines as $line)
                                <p style="{{ $fontBody }} margin:0 0 16px 0; color:#AEB4C0; font-size:15px; line-height:25px;">
                                    {{ $line }}
                                </p>
                            @endforeach

                            <!-- Salutation -->
                            <p style="{{ $fontBody }} margin:26px 0 0 0; color:#AEB4C0; font-size:15px; line-height:25px;">
                                — The {{ $siteName }} team
                            </p>

                            @isset($actionText)
                                <!-- Fallback URL -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px; border-top:1px solid rgba(255,255,255,0.07);">
                                    <tr>
                                        <td style="padding-top:20px;">
                                            <p style="{{ $fontBody }} margin:0 0 8px 0; color:#6B7280; font-size:12px; line-height:18px;">
                                                If the &ldquo;{{ $actionText }}&rdquo; button doesn&rsquo;t work, paste this link into your browser:
                                            </p>
                                            <p style="{{ $fontMono }} margin:0; font-size:12px; line-height:18px; word-break:break-all;">
                                                <a href="{{ $actionUrl }}" target="_blank" style="color:#67E8F9; text-decoration:none;">{{ $actionUrl }}</a>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            @endisset
                        </td>
                    </tr>
                </table>
                <!-- =================== /CARD =================== -->

                <!-- Footer -->
                <table role="presentation" class="gx-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
                    <tr>
                        <td class="gx-pad" style="padding:24px 44px 8px 44px; text-align:center;">
                            <p style="{{ $fontDisplay }} margin:0 0 6px 0; color:#9CA3AF; font-size:13px; font-weight:600; letter-spacing:0.02em;">
                                {{ $siteName }}
                            </p>
                            <p style="{{ $fontBody }} margin:0 0 14px 0; color:#6B7280; font-size:12px; line-height:18px;">
                                @if ($footerCopy !== ''){{ $footerCopy }}@else{{ $tagline }}@endif
                            </p>
                            <p style="{{ $fontBody }} margin:0; color:#4B5563; font-size:11px; line-height:16px;">
                                &copy; {{ date('Y') }} <a href="{{ $panelUrl }}" target="_blank" style="color:#6B7280; text-decoration:none;">{{ $siteName }}</a>. All rights reserved.<br>
                                You&rsquo;re receiving this because you have an account on {{ $siteName }}.
                            </p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>
</html>
