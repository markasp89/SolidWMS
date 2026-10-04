<?php

namespace Modules\Integrations\Models;

use Illuminate\Database\Eloquent\Model;

class WebhookDelivery extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['webhook_id', 'event', 'status_code', 'error', 'duration_ms'];
}
