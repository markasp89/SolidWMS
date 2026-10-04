<?php

namespace Modules\Integrations\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Webhook extends Model
{
    /** Events a webhook can subscribe to. */
    public const EVENTS = [
        'stock.movement' => 'Każda zmiana stanu (przyjęcie, wydanie, przesunięcie, korekta)',
        'product.saved' => 'Dodanie lub zmiana produktu',
        'product.deleted' => 'Usunięcie produktu',
        'pallet.moved' => 'Przeniesienie palety',
        'document.posted' => 'Zatwierdzenie dokumentu PZ/WZ',
        'stocktake.completed' => 'Zakończenie inwentaryzacji',
        'picking.completed' => 'Zakończenie kompletacji',
    ];

    protected $fillable = ['name', 'url', 'events', 'secret', 'active'];

    protected $hidden = ['secret'];

    protected $casts = [
        'events' => 'array',
        'active' => 'boolean',
    ];

    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class)->latest('id');
    }

    public function listensTo(string $event): bool
    {
        return in_array('*', $this->events, true) || in_array($event, $this->events, true);
    }
}
