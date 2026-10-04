<?php

namespace Modules\Documents\Providers;

use Modules\Core\Support\ModuleServiceProvider;

class DocumentsServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'documents';

    protected function bootModule(): void
    {
        $this->loadViewsFrom($this->modulePath('Resources/views'), 'documents');
    }
}
