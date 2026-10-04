<?php

namespace Modules\Alerts\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Modules\Inventory\Models\Product;

class LowStockNotification extends Notification
{
    public function __construct(
        public readonly Product $product,
        public readonly float $total,
        public readonly float $minimum,
    ) {}

    public function via(object $notifiable): array
    {
        return config('alerts.mail') ? ['database', 'mail'] : ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'low_stock',
            'title' => "Niski stan: {$this->product->name}",
            'message' => sprintf('Zostało %s %s (minimum %s).', $this->format($this->total), $this->product->unit, $this->format($this->minimum)),
            'product_id' => $this->product->id,
            'sku' => $this->product->sku,
            'url' => "/products/{$this->product->id}",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $data = $this->toArray($notifiable);

        return (new MailMessage)
            ->subject('[SolidWMS] '.$data['title'])
            ->line($data['message'])
            ->line("SKU: {$this->product->sku}")
            ->action('Otwórz produkt', rtrim((string) config('alerts.frontend_url'), '/').$data['url']);
    }

    private function format(float $value): string
    {
        return rtrim(rtrim(number_format($value, 3, ',', ' '), '0'), ',');
    }
}
