<?php

namespace Modules\Core\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\Services\ModuleManager;

class ModuleController extends Controller
{
    public function __construct(private readonly ModuleManager $modules) {}

    public function index(): JsonResponse
    {
        return response()->json($this->modules->all());
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);

        $this->modules->set($key, $data['enabled']);

        return response()->json($this->modules->all());
    }
}
