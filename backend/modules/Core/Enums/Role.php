<?php

namespace Modules\Core\Enums;

enum Role: string
{
    /** Defines warehouses, floor plans, sectors, users and modules. */
    case Admin = 'admin';

    /** Shift manager: everything a worker does plus approvals, reports and deleting products. */
    case Manager = 'manager';

    /** Manages products and stock levels. */
    case Worker = 'worker';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Administrator',
            self::Manager => 'Kierownik zmiany',
            self::Worker => 'Pracownik',
        };
    }
}
