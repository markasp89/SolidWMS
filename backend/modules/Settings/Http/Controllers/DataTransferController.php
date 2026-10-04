<?php

namespace Modules\Settings\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Settings\Http\Requests\ImportRequest;
use Modules\Settings\Services\DataTransferService;

class DataTransferController extends Controller
{
    public function __construct(private readonly DataTransferService $transfer) {}

    public function export(Request $request): JsonResponse
    {
        $data = $this->transfer->export($request->boolean('include_images', true));
        $filename = 'solidwms-export-'.now()->format('Y-m-d-His').'.json';

        return response()
            ->json($data, 200, [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ->header('Content-Disposition', 'attachment; filename="'.$filename.'"');
    }

    public function import(ImportRequest $request): JsonResponse
    {
        $summary = $this->transfer->import($request->validated('data'), $request->validated('mode'));

        return response()->json(['summary' => $summary]);
    }
}
