# Mock stores: queue and discount

This document records which seed places (from `backend/seed/zurich_providers.json` / `frontend/src/data/zurich_providers.json`) have **queue** or **discount** in the frontend mock. Queue and discount stores are disjoint.

**Source of truth (update this doc when changing mock sets):**
- **Queue:** `frontend/src/hooks/useQueueStatus.ts` → `MOCK_QUEUE_DATA`
- **Discount:** `frontend/src/data/providers.ts` → `DISCOUNT_PLACE_IDS`

---

## Queue (12 stores)

Only these places show queue status and “Join queue” on detail/explore.

| ID    | Name                           | Level  | Wait (min) | People ahead |
|-------|--------------------------------|--------|------------|--------------|
| p001  | Europa Restaurant & Live Music | low    | 2          | 1            |
| p002  | Frida Seefeld                  | medium | 10         | 4            |
| p003  | Afghan Anar                    | busy   | 25         | 9            |
| p004  | Widder Restaurant              | low    | 0          | 0            |
| p005  | Wolfbach                       | medium | 15         | 6            |
| p006  | Guetä Eggä                    | busy   | 20         | 7            |
| p007  | Oberhof                        | low    | 3          | 1            |
| p008  | Restaurant Rosengarten         | medium | 12         | 5            |
| p009  | Kafi Paradiesli                | busy   | 30         | 11           |
| p010  | Römerblick                     | low    | 0          | 0            |
| p081  | Home Massage Zürich            | medium | 18         | 7            |
| p082  | Acosta Therapy Massage Stern   | busy   | 28         | 10           |

---

## Discount (30 stores)

Only these places get a mock flash deal (discount banner on detail, discount pin on home map). No overlap with queue IDs.

### Restaurant / cafe / bar (22)

| ID    | Name                             | Category  |
|-------|----------------------------------|-----------|
| p011  | Grain Craft Bar & Restaurant     | restaurant |
| p012  | Restaurant Oase                  | restaurant |
| p013  | Co Chin Chin Brasserie           | restaurant |
| p014  | Differente                       | restaurant |
| p015  | Royal Panda                      | restaurant |
| p016  | Hero Pedia Cafe                  | cafe      |
| p017  | Babu's                           | cafe      |
| p018  | Cafe Bar Meierei                 | cafe      |
| p019  | Café Elena                       | cafe      |
| p020  | Hausamann Cafe                   | cafe      |
| p021  | Amiamo Caffè                     | cafe      |
| p022  | Kreuzkirche                      | cafe      |
| p023  | betahouse Self-Check In Hostel   | cafe      |
| p024  | Café & Conditorei 1842           | cafe      |
| p025  | MAME Seefeld                     | cafe      |
| p026  | Café Tartines - Römerhofplatz    | cafe      |
| p027  | Auer & Co.                       | cafe      |
| p028  | FLAVOUR COFFEE & PLANTS          | cafe      |
| p029  | ViCAFE Röschibach                | cafe      |
| p030  | Bean Bank Coffee & CO            | cafe      |
| p031  | MANY'S Coffeeshop & Social Club  | cafe      |
| p032  | MAME Josef                       | cafe      |

### Haircut (4)

| ID    | Name                |
|-------|---------------------|
| p057  | Organic Hair Studio  |
| p058  | Mirlanda Coiffure    |
| p059  | HAIR TO GO ASIA      |
| p060  | Schnittvergnügen     |

### Massage (4)

| ID    | Name                        |
|-------|-----------------------------|
| p077  | Elements Thai Spa Zürich    |
| p078  | Ruanthai Wellness & Spa     |
| p079  | Kaya Massage & Beauty       |
| p080  | Sunflower Thai Massage Wellness |

---

## Summary

| Type     | Count | IDs                                      |
|----------|-------|------------------------------------------|
| Queue    | 12    | p001–p010, p081–p082                     |
| Discount | 30    | p011–p032, p057–p060, p077–p080          |

No place has both queue and discount in the mock.
