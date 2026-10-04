<?php

namespace Modules\Photos\Providers;

use Modules\Core\Support\ModuleServiceProvider;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\StockItem;
use Modules\Photos\Models\Photo;
use Modules\Photos\Services\PhotoStorage;

class PhotosServiceProvider extends ModuleServiceProvider
{
    protected string $module = 'photos';

    protected function bootModule(): void
    {
        // Photos disappear together with what they show.
        $cleanup = function (string $type) {
            return function ($model) use ($type) {
                Photo::where('subject_type', $type)->where('subject_id', $model->getKey())->get()
                    ->each(function (Photo $photo) {
                        app(PhotoStorage::class)->delete($photo->path);
                        $photo->delete();
                    });
            };
        };

        Product::deleted($cleanup('product'));
        StockItem::deleted($cleanup('stock_item'));
    }
}
