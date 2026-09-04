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
npm run seed:scholen   # sample scholen in SQLite
npm run smoke          # 5 adressen end-to-end
npm run calibrate      # ~50 adressen, scoreverdeling → data/calibration.json
```

## Docker

```bash
docker compose up --build
```

(Vereist Docker; lokaal werkt ook gewoon Node 24.)

## Bronnen

BAG, EP-Online, WOZ-waardeloket, CBS, Politie open data, officiële bekendmakingen (SRU), RIVM, Klimaateffectatlas, DUO-scholen (sample).

Indicatief — geen taxatie of bouwkundig advies.
