## This project is intended for GenAI Zurich Hackathon 2026


## Agent Pipeline

The pipeline runs as a LangGraph state machine with parallel branches. Each box is an agent node; arrows show data flow.

`evaluation_agent` and `review_agent` run in parallel — both receive the candidate list from `transit_calculator` simultaneously. LangGraph merges their outputs before `orchestrator_agent` runs.

<img src="agent_workflow.png" alt="Agent Workflow" width="300"/>





| Agent | Role |
|---|---|
| **intent_parser** | Takes the user's raw text and calls GPT-4o to extract structured fields: `category`, `requested_time`, `radius_km`, and `constraints`. |
| **crawling_search** | Calls Apify Google Maps scraper to find real businesses near the user. Filters by opening hours. Falls back to local seed file if no Apify token. |
| **transit_calculator** | Calls SBB public transit API to get real ETA for each candidate. Marks providers as `reachable`, `closing_soon`, or `unreachable`. Drops unreachable ones. Retries with wider radius if no candidates remain. |
| **evaluation_agent** | Scores every reachable provider on a weighted sum of price, distance, and rating — each normalised to [0, 1]. |
| **review_agent** | Fetches up to 10 real Google reviews per provider (via Apify) and uses GPT-4o to summarise into advantages and disadvantages. Falls back to LLM-generated summaries when reviews are unavailable. |
| **orchestrator_agent** | LLM brain: reads user intent + hard scores + review summaries and generates a `one_sentence_recommendation` for each of the top 10 places. |
| **output_ranking** | Formats the final top-10 list into `PlaceSummary[]` for the API response. |

---

## Stack

| Layer | Tech |
|---|---|
| Framework | FastAPI (Python 3.11+) |
| Agent orchestration | LangGraph |
| LLM | OpenAI GPT-4o |
| Web scraping | Apify (Google Maps) |
| Transit | SBB OpenData API |
| Database | Supabase (PostgreSQL) — optional, falls back to in-memory |

---

## API

`POST /api/requests/` — run the full pipeline, returns top-10 recommendations

```json
{
  "query": "find a good haircut near me",
  "location": { "lat": 47.3769, "lng": 8.5417 }
}
```

Response: `{ "request": {...}, "results": [PlaceSummary x10] }`

See `backend/README.md` for full setup instructions.
