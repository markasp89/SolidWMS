<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<style>
    * { font-family: "DejaVu Sans", sans-serif; }
    body { font-size: 11px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .muted { color: #555; }
    .header { width: 100%; margin-bottom: 18px; }
    .header td { vertical-align: top; }
    .box { border: 1px solid #999; padding: 8px; }
    table.lines { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table.lines th, table.lines td { border: 1px solid #999; padding: 5px 6px; text-align: left; }
    table.lines th { background: #eee; font-size: 10px; text-transform: uppercase; }
    .num { text-align: right !important; white-space: nowrap; }
    .signatures { width: 100%; margin-top: 60px; }
    .signatures td { width: 50%; text-align: center; padding-top: 6px; border-top: 1px solid #999; }
    .draft { color: #b45309; font-weight: bold; }
</style>
</head>
<body>
<table class="header">
    <tr>
        <td>
            <h1>{{ $document->type }} {{ $document->number }}</h1>
            <div class="muted">{{ \Modules\Documents\Models\Document::TYPES[$document->type] }}</div>
            @if ($document->status !== 'posted')
                <div class="draft">SZKIC – dokument niezatwierdzony</div>
            @endif
        </td>
        <td style="text-align:right">
            <div>Data wystawienia: {{ $document->created_at?->format('d.m.Y H:i') }}</div>
            @if ($document->posted_at)
                <div>Data zatwierdzenia: {{ $document->posted_at->format('d.m.Y H:i') }}</div>
            @endif
        </td>
    </tr>
</table>

<table class="header">
    <tr>
        <td class="box" style="width:50%">
            <strong>Magazyn</strong><br>
            {{ $document->warehouse->code }} – {{ $document->warehouse->name }}<br>
            <span class="muted">{{ $document->warehouse->address }}</span>
        </td>
        <td style="width:4%"></td>
        <td class="box">
            <strong>{{ $document->type === 'PZ' ? 'Dostawca' : 'Odbiorca' }}</strong><br>
            {{ $document->counterparty ?: '—' }}
        </td>
    </tr>
</table>

<table class="lines">
    <thead>
    <tr>
        <th>Lp.</th>
        <th>SKU</th>
        <th>Nazwa</th>
        <th class="num">Ilość</th>
        <th>J.m.</th>
        <th>Lokalizacja</th>
        <th>Partia / ważność</th>
    </tr>
    </thead>
    <tbody>
    @foreach ($document->lines as $line)
        <tr>
            <td>{{ $line->position }}</td>
            <td>{{ $line->product->sku }}</td>
            <td>{{ $line->product->name }}@if ($line->note)<br><span class="muted">{{ $line->note }}</span>@endif</td>
            <td class="num">{{ rtrim(rtrim(number_format($line->quantity, 3, ',', ' '), '0'), ',') }}</td>
            <td>{{ $line->product->unit }}</td>
            <td>
                @if ($line->posted_locations)
                    @foreach ($line->posted_locations as $loc)
                        {{ $loc['label'] }}@if (count($line->posted_locations) > 1) ({{ rtrim(rtrim(number_format($loc['quantity'], 3, ',', ' '), '0'), ',') }})@endif<br>
                    @endforeach
                @elseif ($line->sector)
                    {{ $line->sector->code }}{{ $line->slot ? '-'.$line->slot : '' }}
                @else
                    <span class="muted">automatycznie (FEFO)</span>
                @endif
            </td>
            <td>{{ $line->batch }}{{ $line->batch && $line->expires_at ? ' / ' : '' }}{{ $line->expires_at?->format('d.m.Y') }}</td>
        </tr>
    @endforeach
    </tbody>
</table>

@if ($document->note)
    <p><strong>Uwagi:</strong> {{ $document->note }}</p>
@endif

<table class="signatures">
    <tr>
        <td>{{ $document->type === 'PZ' ? 'Przyjął' : 'Wydał' }}: {{ $document->postedBy?->name ?? $document->createdBy?->name }}</td>
        <td style="border:0;width:10%"></td>
        <td>{{ $document->type === 'PZ' ? 'Dostarczył' : 'Odebrał' }}</td>
    </tr>
</table>
</body>
</html>
