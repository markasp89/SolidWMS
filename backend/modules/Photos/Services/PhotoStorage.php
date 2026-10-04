<?php

namespace Modules\Photos\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Stores photos on the private disk. Large phone photos are scaled down
 * (longest side 1600 px) when the GD extension is available.
 */
class PhotoStorage
{
    private const MAX_SIDE = 1600;

    /** @return array{path: string, width: int|null, height: int|null} */
    public function store(UploadedFile $file): array
    {
        $contents = (string) file_get_contents($file->getRealPath());
        [$width, $height] = @getimagesizefromstring($contents) ?: [null, null];
        $extension = strtolower($file->guessExtension() ?: 'jpg');

        if ($width && $height && max($width, $height) > self::MAX_SIDE && function_exists('imagecreatefromstring')) {
            $source = @imagecreatefromstring($contents);
            if ($source !== false) {
                $scale = self::MAX_SIDE / max($width, $height);
                [$width, $height] = [(int) round($width * $scale), (int) round($height * $scale)];
                $resized = imagescale($source, $width, $height);
                ob_start();
                imagejpeg($resized, null, 82);
                $contents = (string) ob_get_clean();
                $extension = 'jpg';
            }
        }

        $path = 'photos/'.Str::uuid().'.'.$extension;
        Storage::disk('local')->put($path, $contents);

        return ['path' => $path, 'width' => $width, 'height' => $height];
    }

    public function delete(string $path): void
    {
        Storage::disk('local')->delete($path);
    }
}
