<?php

namespace Pterodactyl\Services\Addons\SlotSources;

use RuntimeException;

/**
 * Thrown by {@see SlotSource::write()} when a slot update can't go through.
 * Carries an HTTP status so the controller can `abort($e->status, $e->getMessage())`
 * without each strategy having to know about HTTP.
 */
class SlotSourceException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }
}
