<?php

namespace Modules\Core\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Knows every module of the installation and which of them are switched on.
 */
class ModuleManager
{
    private const CACHE_KEY = 'solidwms.module_states';

    /** @var array<string, bool>|null */
    private ?array $states = null;

    /**
     * @return array<string, array<string, mixed>>
     */
    public function definitions(): array
    {
        return config('modules.modules', []);
    }

    public function exists(string $key): bool
    {
        return isset($this->definitions()[$key]);
    }

    public function isRequired(string $key): bool
    {
        return (bool) ($this->definitions()[$key]['required'] ?? false);
    }

    public function enabled(string $key): bool
    {
        if (! $this->exists($key)) {
            return false;
        }
        if ($this->isRequired($key)) {
            return true;
        }

        $states = $this->states();
        $enabled = $states[$key] ?? (bool) ($this->definitions()[$key]['default'] ?? true);

        // A module is only active when everything it depends on is active too.
        foreach ($this->dependencies($key) as $dependency) {
            if (! $this->enabled($dependency)) {
                return false;
            }
        }

        return $enabled;
    }

    /** @return list<string> */
    public function dependencies(string $key): array
    {
        return array_values($this->definitions()[$key]['depends'] ?? []);
    }

    /** @return list<string> modules that depend on $key */
    public function dependents(string $key): array
    {
        return array_keys(array_filter(
            $this->definitions(),
            fn (array $definition) => in_array($key, $definition['depends'] ?? [], true),
        ));
    }

    public function set(string $key, bool $enabled): void
    {
        if (! $this->exists($key)) {
            throw ValidationException::withMessages(['module' => "Nieznany moduł {$key}."]);
        }
        if ($this->isRequired($key)) {
            throw ValidationException::withMessages(['module' => 'Tego modułu nie można wyłączyć.']);
        }

        if ($enabled) {
            $missing = array_filter($this->dependencies($key), fn ($d) => ! $this->enabled($d));
            if ($missing !== []) {
                throw ValidationException::withMessages([
                    'module' => 'Najpierw włącz: '.implode(', ', array_map(fn ($d) => $this->name($d), $missing)).'.',
                ]);
            }
        } else {
            $active = array_filter($this->dependents($key), fn ($d) => $this->enabled($d));
            if ($active !== []) {
                throw ValidationException::withMessages([
                    'module' => 'Najpierw wyłącz: '.implode(', ', array_map(fn ($d) => $this->name($d), $active)).'.',
                ]);
            }
        }

        DB::table('module_states')->updateOrInsert(
            ['key' => $key],
            ['enabled' => $enabled, 'updated_at' => now(), 'created_at' => now()],
        );

        $this->flush();
    }

    public function name(string $key): string
    {
        return $this->definitions()[$key]['name'] ?? $key;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function all(): array
    {
        $list = [];
        foreach ($this->definitions() as $key => $definition) {
            $list[] = [
                'key' => $key,
                'name' => $definition['name'] ?? $key,
                'description' => $definition['description'] ?? null,
                'group' => $definition['group'] ?? 'Podstawowe',
                'required' => (bool) ($definition['required'] ?? false),
                'depends' => $this->dependencies($key),
                'enabled' => $this->enabled($key),
            ];
        }

        return $list;
    }

    public function flush(): void
    {
        $this->states = null;
        Cache::forget(self::CACHE_KEY);
    }

    /** @return array<string, bool> */
    private function states(): array
    {
        if ($this->states !== null) {
            return $this->states;
        }

        try {
            return $this->states = Cache::rememberForever(self::CACHE_KEY, function () {
                if (! Schema::hasTable('module_states')) {
                    return [];
                }

                return DB::table('module_states')->pluck('enabled', 'key')->map(fn ($v) => (bool) $v)->all();
            });
        } catch (Throwable) {
            // Database not ready (fresh install) - fall back to defaults.
            return $this->states = [];
        }
    }
}
