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
- API docs: `/docs`
- Adapter-status: `/status`
- Permalinks: `/rapport/{nummeraanduidingId}`

## API

```bash
curl -H "X-API-Key: demo-key-1" \
  "http://localhost:3000/api/v1/score?address=Dam%201%20Amsterdam"
```

Keys via `API_KEYS` in `.env.local`. Rate limit: 60 req/uur per key.

## Scripts

```bash
npm run seed:scholen   # importeer alle DUO-scholen (bo+vo) met PDOK-geocoding (~5 min)
npm run smoke          # 5 adressen end-to-end
npm run calibrate      # ~50 adressen, scoreverdeling → data/calibration.json
npm run check:wms      # controleer of RIVM/Klimaateffectatlas-lagen nog bestaan
npm run test           # unit tests (vitest)
```

`seed:scholen` hervat automatisch waar hij bleef; gebruik `-- --fresh` voor een schone import.

## Docker

```bash
docker compose up --build
```

(Vereist Docker; lokaal werkt ook gewoon Node 24.)

## Bronnen

BAG, EP-Online, WOZ-waardeloket, CBS, Politie open data, officiële bekendmakingen (SRU), RIVM (GCN lucht + ALO geluid, incl. per bron), Klimaateffectatlas, DUO-scholen (alle bo/vo-vestigingen, CC-BY 4.0), Kadastrale kaart (percelen, PDOK), Rijksmonumentenregister (RCE).

Indicatief — geen taxatie of bouwkundig advies.
