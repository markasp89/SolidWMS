<?php

namespace Modules\Warehouses\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Stores floor plans (top-down images) on the private "local" disk.
 * Works with any model having floor_plan_path / floor_plan_width / floor_plan_height
 * columns (warehouses, floors).
 */
class FloorPlanStorage
{
    public const DISK = 'local';

    public const DIRECTORY = 'floor-plans';

    /** @var array<string, string> */
    public const MIME_EXTENSIONS = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    public function storeUpload(Model $warehouse, UploadedFile $file): Model
    {
        return $this->storeContents($warehouse, (string) file_get_contents($file->getRealPath()));
    }

    public function storeContents(Model $warehouse, string $contents): Model
    {
        $info = @getimagesizefromstring($contents);

        if ($info === false || ! isset(self::MIME_EXTENSIONS[$info['mime']])) {
            throw ValidationException::withMessages([
                'floor_plan' => 'Rzut magazynu musi być obrazem PNG, JPG, WEBP lub GIF.',
            ]);
        }

        $path = self::DIRECTORY.'/'.Str::uuid().'.'.self::MIME_EXTENSIONS[$info['mime']];
        Storage::disk(self::DISK)->put($path, $contents);

        $this->deleteFile($warehouse);

        $warehouse->forceFill([
            'floor_plan_path' => $path,
            'floor_plan_width' => $info[0],
            'floor_plan_height' => $info[1],
        ])->save();

        return $warehouse;
    }

    public function remove(Model $warehouse): Model
    {
        $this->deleteFile($warehouse);

        $warehouse->forceFill([
            'floor_plan_path' => null,
            'floor_plan_width' => null,
            'floor_plan_height' => null,
        ])->save();

        return $warehouse;
    }

    public function contents(Model $warehouse): ?string
    {
        if (! $warehouse->floor_plan_path || ! Storage::disk(self::DISK)->exists($warehouse->floor_plan_path)) {
            return null;
        }

        return Storage::disk(self::DISK)->get($warehouse->floor_plan_path);
    }

    public function deleteFile(Model $warehouse): void
    {
        if ($warehouse->floor_plan_path) {
            $this->deletePath($warehouse->floor_plan_path);
        }
    }

    public function deletePath(string $path): void
    {
        Storage::disk(self::DISK)->delete($path);
    }
}
