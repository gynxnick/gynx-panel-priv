<?php

namespace Pterodactyl\Services\Mail;

use Illuminate\Database\QueryException;
use Illuminate\Notifications\Messages\MailMessage;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

/**
 * Loads admin-editable email template parts (subject / greeting / body
 * lines / action button) for each notification type, fills placeholder
 * tokens like {user_name}, and returns a Laravel MailMessage ready to
 * be returned from a Notification::toMail() method.
 *
 * Storage: each template is one panel-settings row with a JSON-encoded
 * payload of all five parts. Empty / missing settings fall back to the
 * hardcoded DEFAULTS below — admins only persist the parts they
 * actually changed.
 *
 * Tokens use single-brace `{name}` syntax. Unknown tokens are left in
 * place so a typo is visible in the rendered email instead of silently
 * turning into an empty string.
 */
class MailTemplateService
{
    /**
     * @var array<string, array{
     *   label:string,
     *   description:string,
     *   placeholders:array<int,string>,
     *   subject:string,
     *   greeting:string,
     *   lines:string,
     *   action_label:string,
     *   action_url:string,
     * }>
     */
    private const DEFAULTS = [
        'account_created' => [
            'label' => 'Account Created',
            'description' => 'Sent when a new user account is created. The action button only renders when an invite token is included.',
            'placeholders' => ['app_name', 'name', 'username', 'email', 'action_url'],
            'subject' => 'Welcome to {app_name}',
            'greeting' => 'Hello {name}!',
            'lines' => "You are receiving this email because an account has been created for you on {app_name}.\nUsername: {username}\nEmail: {email}",
            'action_label' => 'Setup Your Account',
            'action_url' => '{action_url}',
        ],
        'added_to_server' => [
            'label' => 'Added to Server',
            'description' => 'Sent when a user is added as a subuser on a server.',
            'placeholders' => ['name', 'server_name', 'action_url'],
            'subject' => 'Added to a server',
            'greeting' => 'Hello {name}!',
            'lines' => "You have been added as a subuser for the following server, allowing you certain control over the server.\nServer Name: {server_name}",
            'action_label' => 'Visit Server',
            'action_url' => '{action_url}',
        ],
        'removed_from_server' => [
            'label' => 'Removed from Server',
            'description' => 'Sent when a user is removed as a subuser on a server.',
            'placeholders' => ['name', 'server_name', 'action_url'],
            'subject' => 'Removed from a server',
            'greeting' => 'Hello {name}.',
            'lines' => "You have been removed as a subuser for the following server.\nServer Name: {server_name}",
            'action_label' => 'Visit Panel',
            'action_url' => '{action_url}',
        ],
        'server_installed' => [
            'label' => 'Server Installed',
            'description' => 'Sent to the server owner when the install script finishes successfully.',
            'placeholders' => ['name', 'server_name', 'action_url'],
            'subject' => 'Your server is ready',
            'greeting' => 'Hello {name}.',
            'lines' => "Your server has finished installing and is now ready for you to use.\nServer Name: {server_name}",
            'action_label' => 'Login and Begin Using',
            'action_url' => '{action_url}',
        ],
        'password_reset' => [
            'label' => 'Password Reset',
            'description' => 'Sent when the user requests a password reset.',
            'placeholders' => ['action_url'],
            'subject' => 'Reset Password',
            'greeting' => '',
            'lines' => "You are receiving this email because we received a password reset request for your account.\nIf you did not request a password reset, no further action is required.",
            'action_label' => 'Reset Password',
            'action_url' => '{action_url}',
        ],
        'mail_test' => [
            'label' => 'Mail Test',
            'description' => 'Sent by Settings → Mail → Test to verify the SMTP setup. Editing here lets you tailor the test message; the test action itself is hardcoded to fire this notification.',
            'placeholders' => ['name', 'app_name'],
            'subject' => '{app_name} Test Message',
            'greeting' => 'Hello {name}!',
            'lines' => 'This is a test of the {app_name} mail system. You\'re good to go!',
            'action_label' => '',
            'action_url' => '',
        ],
    ];

    /** The four parts an admin can override per template. */
    public const EDITABLE_PARTS = ['subject', 'greeting', 'lines', 'action_label', 'action_url'];

    /** In-process cache so the same template isn't deserialized twice in a request. */
    private array $loaded = [];

    public function __construct(private SettingsRepositoryInterface $settings)
    {
    }

    /** Registered template keys, in display order for the admin UI. */
    public static function templateKeys(): array
    {
        return array_keys(self::DEFAULTS);
    }

    /** Metadata bundle for the admin form. */
    public static function templateMeta(string $key): ?array
    {
        return self::DEFAULTS[$key] ?? null;
    }

    /**
     * Resolve the five parts for a template. DB row wins per-field;
     * blank or missing parts fall back to the hardcoded default.
     */
    public function load(string $key): array
    {
        if (!isset(self::DEFAULTS[$key])) {
            throw new \InvalidArgumentException("Unknown mail template key: {$key}");
        }
        if (isset($this->loaded[$key])) {
            return $this->loaded[$key];
        }

        $defaults = self::DEFAULTS[$key];
        $stored = [];
        try {
            $raw = $this->settings->get('settings::mail_templates:' . $key, null);
            if (is_string($raw) && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    $stored = $decoded;
                }
            }
        } catch (QueryException $e) {
            // settings table missing on a fresh install — defaults only.
        }

        $resolved = [];
        foreach (self::EDITABLE_PARTS as $part) {
            $val = $stored[$part] ?? null;
            $resolved[$part] = ($val === null || $val === '') ? $defaults[$part] : (string) $val;
        }

        return $this->loaded[$key] = $resolved;
    }

    /**
     * Persist edits. Stores ONLY parts that diverge from the default
     * so reverting the panel name (or any default-affecting change)
     * still flows through to admin-customized templates that haven't
     * changed those particular fields.
     */
    public function save(string $key, array $parts): void
    {
        if (!isset(self::DEFAULTS[$key])) {
            throw new \InvalidArgumentException("Unknown mail template key: {$key}");
        }

        $defaults = self::DEFAULTS[$key];
        $diff = [];
        foreach (self::EDITABLE_PARTS as $part) {
            $value = isset($parts[$part]) ? (string) $parts[$part] : '';
            if ($value !== '' && $value !== $defaults[$part]) {
                $diff[$part] = $value;
            }
        }

        $settingKey = 'settings::mail_templates:' . $key;
        if ($diff === []) {
            $this->settings->forget($settingKey);
        } else {
            $this->settings->set($settingKey, json_encode($diff));
        }

        unset($this->loaded[$key]);
    }

    /** Build a complete MailMessage from a template + caller-supplied tokens. */
    public function build(string $key, array $context): MailMessage
    {
        $tpl = $this->load($key);
        $msg = new MailMessage();

        if ($tpl['subject'] !== '') {
            $msg->subject($this->fill($tpl['subject'], $context));
        }
        if ($tpl['greeting'] !== '') {
            $msg->greeting($this->fill($tpl['greeting'], $context));
        }
        foreach (preg_split('/\r?\n/', $tpl['lines']) ?: [] as $line) {
            $line = trim($line);
            if ($line !== '') {
                $msg->line($this->fill($line, $context));
            }
        }
        if ($tpl['action_label'] !== '' && $tpl['action_url'] !== '') {
            $msg->action(
                $this->fill($tpl['action_label'], $context),
                $this->fill($tpl['action_url'], $context),
            );
        }

        return $msg;
    }

    /**
     * Substitute {placeholder} tokens using $context. Unknown tokens are
     * left intact (visible in the rendered email) so typos surface
     * rather than silently disappearing.
     */
    public function fill(string $template, array $context): string
    {
        $context = array_merge(['app_name' => (string) config('app.name', 'Pterodactyl')], $context);
        return preg_replace_callback('/\{(\w+)\}/', function ($m) use ($context) {
            return array_key_exists($m[1], $context) ? (string) $context[$m[1]] : $m[0];
        }, $template) ?? $template;
    }
}
