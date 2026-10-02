<?php

namespace Modules\Core\Enums;

enum Role: string
{
    /** Defines warehouses, floor plans, sectors and users. */
    case Admin = 'admin';

    /** Manages products and stock levels. */
    case Worker = 'worker';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Administrator',
            self::Worker => 'Pracownik',
        };
    }
}
