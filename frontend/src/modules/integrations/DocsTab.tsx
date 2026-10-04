import type { ReactNode } from 'react'
import { apiUrl } from '@/core/api/client'
import { Card } from '@/core/ui/misc'
import { CodeBlock } from './components'

const API_PATH = '/api/integration/v1'

/** Absolute base URL of the integration API (VITE_API_URL when the API runs on another host). */
function baseUrl(): string {
  const url = apiUrl(API_PATH)
  return /^https?:\/\//.test(url) ? url : `${window.location.origin}${url}`
}

const json = (value: unknown) => JSON.stringify(value, null, 2)

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="docs-section">
      <Card title={title}>
        <div className="docs-body">{children}</div>
      </Card>
    </div>
  )
}

function Endpoint({ method, path, children }: { method: 'GET' | 'POST'; path: string; children: ReactNode }) {
  return (
    <div className="docs-endpoint">
      <h3>
        <span className={`badge ${method === 'GET' ? 'badge-move' : 'badge-in'}`}>{method}</span> <code>{path}</code>
      </h3>
      {children}
    </div>
  )
}

export function DocsTab() {
  const base = baseUrl()
  const key = 'swms_TWOJ_KLUCZ'

  const productsCurl = `curl "${base}/products?updated_since=2026-01-01T00:00:00Z&per_page=100&page=1" \\
  -H "X-Api-Key: ${key}" \\
  -H "Accept: application/json"`

  const productsResponse = json({
    data: [
      {
        id: 12,
        sku: 'ABC-001',
        name: 'Śruba M6x20',
        barcode: '5901234123457',
        unit: 'szt',
        description: null,
        min_quantity: 100,
        total_quantity: 1250,
        updated_at: '2026-10-01T08:15:00+02:00',
      },
    ],
    meta: { current_page: 1, last_page: 3, total: 245 },
  })

  const upsertCurl = `curl -X POST "${base}/products" \\
  -H "X-Api-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -d '{
    "products": [
      { "sku": "ABC-001", "name": "Śruba M6x20", "barcode": "5901234123457", "unit": "szt", "min_quantity": 100 },
      { "sku": "ABC-002", "name": "Nakrętka M6" }
    ]
  }'`

  const stockCurl = `curl "${base}/stock?sku=ABC-001&warehouse=MAG1" \\
  -H "X-Api-Key: ${key}"`

  const stockResponse = json([
    {
      id: 301,
      product_id: 12,
      sector_id: 4,
      slot: 'R1-P2',
      batch: null,
      expires_at: null,
      pallet_id: null,
      quantity: 250,
      note: null,
      product: { id: 12, sku: 'ABC-001', name: 'Śruba M6x20', unit: 'szt', barcode: '5901234123457' },
      sector: { id: 4, code: 'A1', name: 'Regał A1', color: '#0ea5e9', warehouse: { id: 1, code: 'MAG1', name: 'Magazyn główny' } },
      updated_at: '2026-10-01T08:15:00+02:00',
    },
  ])

  const movementsCurl = `curl "${base}/movements?since_id=1520&limit=200" \\
  -H "X-Api-Key: ${key}"`

  const movementsResponse = json({
    data: [
      {
        id: 1521,
        type: 'in',
        type_label: 'Przyjęcie',
        quantity: 50,
        reference: 'FZ 12/2026',
        product: { id: 12, sku: 'ABC-001', name: 'Śruba M6x20', unit: 'szt' },
        from_sector: null,
        to_sector: { id: 4, code: 'A1', name: 'Regał A1', color: '#0ea5e9', warehouse: { id: 1, code: 'MAG1', name: 'Magazyn główny' } },
        user: { id: 3, name: 'Jan Kowalski' },
        created_at: '2026-10-01T08:15:00+02:00',
      },
    ],
    last_id: 1521,
  })

  const webhookPayload = `POST /twoj-endpoint HTTP/1.1
Content-Type: application/json
User-Agent: SolidWMS-Webhooks/1.0
X-SolidWMS-Event: stock.movement
X-SolidWMS-Signature: sha256=5d41402abc4b2a76b9719d911017c592...

${json({
  id: '9b2f6c1e-7d4a-4e0b-9a51-2f8f3c7d1a20',
  event: 'stock.movement',
  occurred_at: '2026-10-01T08:15:00+02:00',
  data: {
    movement_id: 1521,
    product_id: 12,
    type: 'in',
    quantity: 50,
    total_delta: 50,
    from_sector_id: null,
    to_sector_id: 4,
    pallet_id: null,
    reference: 'FZ 12/2026',
    user_id: 3,
  },
})}`

  const verifyPhp = `<?php
$secret = getenv('SOLIDWMS_WEBHOOK_SECRET');
$body = file_get_contents('php://input'); // surowa treść, przed json_decode
$expected = 'sha256=' . hash_hmac('sha256', $body, $secret);
$received = $_SERVER['HTTP_X_SOLIDWMS_SIGNATURE'] ?? '';

if (!hash_equals($expected, $received)) {
    http_response_code(401);
    exit('Nieprawidłowy podpis');
}

$event = json_decode($body, true);
// ... obsługa $event['event'] i $event['data'] ...
http_response_code(204);`

  const verifyNode = `import express from 'express'
import crypto from 'node:crypto'

const app = express()
const secret = process.env.SOLIDWMS_WEBHOOK_SECRET

// express.raw - podpis liczony jest z surowej treści żądania
app.post('/solidwms/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex')
  const received = req.get('X-SolidWMS-Signature') ?? ''
  const valid =
    expected.length === received.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  if (!valid) return res.status(401).send('Nieprawidłowy podpis')

  const event = JSON.parse(req.body.toString('utf8'))
  // ... obsługa event.event i event.data ...
  res.sendStatus(204)
})

app.listen(3000)`

  const erpAgent = `<?php
// Agent synchronizacji uruchamiany co 15 minut (Harmonogram zadań Windows / cron).
// Czyta kartoteki towarów z bazy ERP (np. Subiekt GT - SQL Server) i wysyła je do SolidWMS.
$pdo = new PDO('sqlsrv:Server=SERWER\\\\INSERTGT;Database=FIRMA', 'uzytkownik', 'haslo');
$rows = $pdo->query("SELECT tw_Symbol AS sku, tw_Nazwa AS name, tw_PodstKodKresk AS barcode,
                            tw_JednMiary AS unit, tw_StanMin AS min_quantity
                     FROM tw__Towar WHERE tw_Usuniety = 0")->fetchAll(PDO::FETCH_ASSOC);

foreach (array_chunk($rows, 500) as $chunk) {   // maks. 1000 produktów na żądanie
    $ch = curl_init('${base}/products');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['X-Api-Key: ${key}', 'Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['products' => $chunk], JSON_UNESCAPED_UNICODE),
    ]);
    echo curl_exec($ch), PHP_EOL;  // {"created":3,"updated":497}
}`

  return (
    <div className="docs">
      <nav className="docs-toc card" aria-label="Spis treści">
        <strong>Spis treści</strong>
        <a href="#docs-auth">Adres i uwierzytelnianie</a>
        <a href="#docs-products">Produkty</a>
        <a href="#docs-stock">Stany magazynowe</a>
        <a href="#docs-movements">Ruchy magazynowe</a>
        <a href="#docs-webhooks">Webhooki</a>
        <a href="#docs-erp">Synchronizacja z ERP</a>
      </nav>

      <Section id="docs-auth" title="Adres i uwierzytelnianie">
        <p>Wszystkie adresy API integracyjnego zaczynają się od:</p>
        <CodeBlock code={base} />
        <p>
          Każde żądanie musi zawierać klucz API (zakładka „Klucze API”) w nagłówku <code>X-Api-Key</code> (alternatywnie{' '}
          <code>Authorization: Bearer swms_…</code>). Klucz z uprawnieniem <em>odczyt</em> pozwala na żądania GET, zapis
          (POST) wymaga uprawnienia <em>zapis</em>.
        </p>
        <CodeBlock code={`X-Api-Key: ${key}\nAccept: application/json`} title="Nagłówki" />
        <ul className="docs-list">
          <li>Odpowiedzi są w formacie JSON (UTF-8), daty w ISO 8601.</li>
          <li>
            Kody błędów: <code>401</code> – brak lub nieprawidłowy klucz, <code>403</code> – klucz tylko do odczytu,{' '}
            <code>422</code> – błędy walidacji (pole <code>errors</code>), <code>429</code> – przekroczony limit 120
            żądań na minutę.
          </li>
          <li>SKU i kody magazynów są porównywane bez rozróżniania wielkości liter (zapisywane wielkimi literami).</li>
        </ul>
      </Section>

      <Section id="docs-products" title="Produkty">
        <Endpoint method="GET" path="/products">
          <p>
            Lista produktów z łączną ilością na stanie, stronicowana. Parametry: <code>updated_since</code> (zmienione od
            daty – do synchronizacji przyrostowej), <code>sku</code>, <code>page</code>, <code>per_page</code> (1–500,
            domyślnie 100).
          </p>
          <CodeBlock code={productsCurl} title="Żądanie" />
          <CodeBlock code={productsResponse} title="Odpowiedź" />
        </Endpoint>
        <Endpoint method="POST" path="/products">
          <p>
            Dodaje lub aktualizuje produkty według SKU (maks. 1000 w jednym żądaniu, wymaga uprawnienia <em>zapis</em>).
            Wymagane pola: <code>sku</code>, <code>name</code>; opcjonalne: <code>barcode</code>, <code>unit</code>,{' '}
            <code>description</code>, <code>min_quantity</code>. Pominięte pola nie są zmieniane.
          </p>
          <CodeBlock code={upsertCurl} title="Żądanie" />
          <CodeBlock code={json({ created: 1, updated: 1 })} title="Odpowiedź" />
        </Endpoint>
      </Section>

      <Section id="docs-stock" title="Stany magazynowe">
        <Endpoint method="GET" path="/stock">
          <p>
            Stany w lokalizacjach (sektor, miejsce, partia, paleta). Filtry: <code>sku</code>, <code>warehouse</code> (kod
            magazynu). Zwraca maks. 5000 pozycji.
          </p>
          <CodeBlock code={stockCurl} title="Żądanie" />
          <CodeBlock code={stockResponse} title="Odpowiedź" />
        </Endpoint>
      </Section>

      <Section id="docs-movements" title="Ruchy magazynowe">
        <Endpoint method="GET" path="/movements">
          <p>
            Kolejne ruchy (przyjęcia, wydania, przesunięcia, korekty) o identyfikatorze większym niż <code>since_id</code>,
            rosnąco; <code>limit</code> 1–1000 (domyślnie 200). Zapamiętaj zwrócone <code>last_id</code> i przekaż je jako{' '}
            <code>since_id</code> w następnym zapytaniu – to prosty i niezawodny sposób odpytywania o zmiany.
          </p>
          <CodeBlock code={movementsCurl} title="Żądanie" />
          <CodeBlock code={movementsResponse} title="Odpowiedź" />
        </Endpoint>
      </Section>

      <Section id="docs-webhooks" title="Webhooki">
        <p>
          Po wystąpieniu wybranego zdarzenia SolidWMS wysyła żądanie POST z JSON-em na adres webhooka (limit czasu 5 s).
          Odpowiedź 2xx oznacza sukces; wynik każdej wysyłki widać w historii webhooka. Pole <code>id</code> jest unikalne
          – użyj go, aby nie przetworzyć tego samego zdarzenia dwa razy. Przycisk „Testuj” wysyła zdarzenie{' '}
          <code>ping</code>.
        </p>
        <CodeBlock code={webhookPayload} title="Przykładowe żądanie" />
        <h3 className="docs-subtitle">Weryfikacja podpisu</h3>
        <p>
          Nagłówek <code>X-SolidWMS-Signature</code> zawiera <code>sha256=</code> oraz HMAC-SHA256 surowej treści żądania
          obliczony z sekretem webhooka. Oblicz go po swojej stronie i porównaj w czasie stałym; odrzuć żądanie, jeśli
          podpisy się różnią.
        </p>
        <CodeBlock code={verifyPhp} title="PHP" />
        <CodeBlock code={verifyNode} title="Node.js (Express)" />
      </Section>

      <Section id="docs-erp" title="Synchronizacja z Subiektem GT / ERP">
        <p>
          Programy takie jak Subiekt GT nie wysyłają danych same, dlatego synchronizację realizuje mały agent uruchamiany
          cyklicznie na serwerze firmy (np. skrypt PHP, PowerShell lub usługa .NET korzystająca ze Sfery):
        </p>
        <ol className="docs-list">
          <li>Utwórz klucz API z uprawnieniami odczyt i zapis, np. „Subiekt GT – synchronizacja”.</li>
          <li>
            Agent czyta kartoteki towarów z bazy ERP i wysyła je partiami do <code>POST /products</code> – produkty są
            dopasowywane po SKU (symbolu towaru), więc wysyłkę można bezpiecznie powtarzać.
          </li>
          <li>
            Zmiany stanów w magazynie agent pobiera z <code>GET /movements</code> (z zapamiętanym <code>last_id</code>) lub
            odbiera przez webhook <code>stock.movement</code> i na ich podstawie tworzy dokumenty w ERP.
          </li>
        </ol>
        <CodeBlock code={erpAgent} title="Przykładowy agent (PHP)" />
        <p className="muted">
          Nazwy tabel i kolumn zależą od wersji programu – sprawdź je w dokumentacji swojego ERP.
        </p>
      </Section>
    </div>
  )
}
