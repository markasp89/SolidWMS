<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'app' => 'SolidWMS API',
    'docs' => 'See README.md in the repository root.',
]));
