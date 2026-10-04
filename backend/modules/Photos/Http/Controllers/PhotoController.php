<?php

namespace Modules\Photos\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Modules\Photos\Models\Photo;
use Modules\Photos\Services\PhotoStorage;
use Symfony\Component\HttpFoundation\Response as BaseResponse;

class PhotoController extends Controller
{
    public function __construct(private readonly PhotoStorage $storage) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(Photo::SUBJECTS))],
            'subject_id' => ['required', 'integer'],
        ]);

        $photos = Photo::with('user')
            ->where($data)
            ->latest()
            ->get();

        return response()->json($photos->map(fn (Photo $p) => $this->present($p)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(Photo::SUBJECTS))],
            'subject_id' => ['required', 'integer'],
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:15360'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        abort_unless(
            DB::table(Photo::SUBJECTS[$data['subject_type']])->where('id', $data['subject_id'])->exists(),
            422,
            'Nie znaleziono obiektu, do którego dodajesz zdjęcie.',
        );

        $stored = $this->storage->store($request->file('photo'));

        $photo = Photo::create([
            'subject_type' => $data['subject_type'],
            'subject_id' => $data['subject_id'],
            'caption' => $data['caption'] ?? null,
            'user_id' => $request->user()->id,
            ...$stored,
        ]);

        return response()->json($this->present($photo->load('user')), 201);
    }

    public function destroy(Request $request, Photo $photo): Response
    {
        $user = $request->user();
        abort_unless($photo->user_id === $user->id || in_array($user->role->value, ['admin', 'manager'], true), 403);

        $this->storage->delete($photo->path);
        $photo->delete();

        return response()->noContent();
    }

    public function file(Photo $photo): BaseResponse
    {
        abort_unless(Storage::disk('local')->exists($photo->path), 404);

        return Storage::disk('local')->response($photo->path, null, ['Cache-Control' => 'private, max-age=86400']);
    }

    private function present(Photo $photo): array
    {
        return [
            'id' => $photo->id,
            'subject_type' => $photo->subject_type,
            'subject_id' => $photo->subject_id,
            'url' => $photo->url(),
            'width' => $photo->width,
            'height' => $photo->height,
            'caption' => $photo->caption,
            'user' => $photo->user?->only(['id', 'name']),
            'created_at' => $photo->created_at?->toIso8601String(),
        ];
    }
}
