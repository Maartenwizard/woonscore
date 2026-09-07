# Woonscore

Open-data woonrapport voor Nederland: consumenten-Woonscore, zakelijke due diligence, en een publieke API.

## Starten

```bash
cp .env.example .env.local   # of gebruik bestaande .env.local
npm install
npm run seed:scholen
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Consument: `/`
- Zakelijk: `/zakelijk`
- Prijzen: `/prijzen`
- Account / API-keys: `/account`
- API docs: `/docs`
- Adapter-status: `/status`
- Permalinks: `/rapport/{nummeraanduidingId}`

## Accounts en betalingen

Clerk voor inloggen. Stripe Checkout voor het Zakelijk-abonnement (€29/mnd) en extra rapport-credits (€19 / 50).

```bash
# Clerk-keys staan in .env.local na `npx clerk init`
# Stripe-producten (aparte producten per plan):
npm run setup:stripe
```

Zet daarna `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ZAKELIJK`, `STRIPE_PRICE_CREDITS`, `STRIPE_WEBHOOK_SECRET` en `NEXT_PUBLIC_APP_URL`. Webhook-events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Voor EU-btw: eerst Stripe Tax-registratie, daarna pas `automatic_tax`.

## API

```bash
curl -H "X-API-Key: ws_jouw_key" \
  "http://localhost:3000/api/v1/score?address=Dam%201%20Amsterdam"
```

Eigen keys via `/account`. Omgevingskeys (`API_KEYS`) blijven voor lokale tests. Planlimieten: gratis 50/maand en 60/uur (bulk 5); zakelijk 500/maand en 300/uur (bulk 20).

## Scripts

```bash
npm run seed:scholen   # importeer alle DUO-scholen (bo+vo) met PDOK-geocoding (~5 min)
npm run smoke          # 5 adressen end-to-end
npm run calibrate      # ~50 adressen, scoreverdeling → data/calibration.json
npm run check:wms      # controleer of RIVM/Klimaateffectatlas-lagen nog bestaan
npm run setup:stripe   # maak Stripe-producten en print price-id's
npm run test           # unit tests (vitest)
```

`seed:scholen` hervat automatisch waar hij bleef; gebruik `-- --fresh` voor een schone import.

## Docker

```bash
docker compose up --build
```

(Vereist Docker; lokaal werkt ook gewoon Node 24.)

## Bronnen

BAG, EP-Online, WOZ-waardeloket, CBS (wijken/buurten + PBK prijsindex), Politie open data (incl. inbraak/fiets/mishandeling), officiële bekendmakingen (SRU), RIVM (GCN lucht + ALO geluid, incl. per bron), Klimaateffectatlas (overstroming, hoosbui, hitte, fundering), DUO-scholen (alle bo/vo-vestigingen, CC-BY 4.0), Kadastrale kaart (percelen, PDOK), Rijksmonumentenregister (RCE), OpenStreetMap (OV-haltes, groen, beschermd gezicht).

Indicatief — geen taxatie of bouwkundig advies.
