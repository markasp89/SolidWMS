<?php

namespace Modules\Inventory\Enums;

enum MovementType: string
{
    case In = 'in';
    case Out = 'out';
    case Move = 'move';
    case Adjust = 'adjust';

    public function label(): string
    {
        return match ($this) {
            self::In => 'Przyjęcie',
            self::Out => 'Wydanie',
            self::Move => 'Przesunięcie',
            self::Adjust => 'Korekta',
        };
    }
}
