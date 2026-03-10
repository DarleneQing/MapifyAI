## IntelligentLocalBid RESTful API 设计文档

### 1. 概览

**Base URL**：`/api`  
**风格**：RESTful + SSE（用于流式结果 / 实时报价）  
**数据格式**：请求 & 响应均为 `application/json`（SSE 为 `text/event-stream`）  

**认证（MVP）**：  
- 支持匿名访问；
- 如有用户体系，可在后续加入 `Authorization: Bearer <token>`。

---

### 2. 核心数据模型

#### 2.1 Request 模型（搜索请求）

**说明**：每一次自然语言搜索都会生成一条 Request 记录，是后续推荐结果、报价等实体的统一锚点。

```json
{
  "id": "req_123",
  "user_id": "u_abc",
  "intent": {
    "intent_type": "search",
    "service_category": "haircut",
    "location": {
      "type": "current_gps",
      "lat": 47.3769,
      "lng": 8.5417,
      "radius_km": 3
    },
    "time_window": {
      "type": "today",
      "from": "now",
      "to": "20:00"
    },
    "budget_level": "medium",
    "special_requirements": ["kid_friendly"]
  },
  "status": "in_progress",
  "created_at": "2026-03-05T10:00:00Z",
  "completed_at": null
}
```

`status` 取值：

- `created`
- `in_progress`
- `completed`
- `expired`

---

#### 2.2 PlaceSummary 模型（排行榜列表条目）

```json
{
  "place_id": "gmp_123",
  "name": "Awesome Hair Salon",
  "address": "Some street 1, City",
  "distance_km": 1.2,
  "price_level": "medium",
  "rating": 4.6,
  "rating_count": 123,
  "recommendation_score": 0.92,
  "status": "open_now",
  "transit": {
    "duration_minutes": 22,
    "transport_types": ["tram", "bus"],
    "departure_time": "17:45",
    "summary": "22 min — Tram 4 → Bus 33",
    "connections": [
      {
        "transport_type": "tram",
        "line": "4",
        "departure_time": "17:45",
        "arrival_time": "17:58",
        "duration_minutes": 13,
        "from_stop": "Zürich HB",
        "to_stop": "Stauffacher"
      },
      {
        "transport_type": "bus",
        "line": "33",
        "departure_time": "18:01",
        "arrival_time": "18:07",
        "duration_minutes": 6,
        "from_stop": "Stauffacher",
        "to_stop": "Schmiede Wiedikon"
      }
    ]
  },
  "reason_tags": [
    "符合您的预算",
    "距离您仅 1.2km",
    "好评率较高"
  ],
  "one_sentence_recommendation": "高性价比且交通便利的理发店，好评率极高，乘坐电车 12 分钟即达。"
}
```

`status` 取值：

- `open_now`
- `closing_soon`
- `closed`

`transport_types` 为数组，包含本次行程涉及的所有交通方式，取值：

- `train`
- `bus`
- `tram`
- `walk`

当数组长度 > 1 时，`connections` 数组包含每段换乘的详细信息（交通方式、线路、出发/到达时间、站点）。

---

#### 2.3 PlaceDetail 模型（地点详情）

```json
{
  "place": {
    "place_id": "gmp_123",
    "name": "Awesome Hair Salon",
    "address": "Some street 1, City",
    "phone": "+41 12 345 67 89",
    "website": "https://example.com",
    "location": { "lat": 47.3769, "lng": 8.5417 },
    "rating": 4.6,
    "rating_count": 123,
    "price_level": "medium",
    "status": "open_now",
    "opening_hours": {
      "today_open": "10:00",
      "today_close": "20:00",
      "is_open_now": true
    }
  },
  "review_summary": {
    "advantages": [
      "理发师技术专业、态度友好",
      "环境干净整洁",
      "性价比高，定价合理"
    ],
    "disadvantages": [
      "高峰期等待时间较长",
      "个别技师服务态度有待改善"
    ],
    "star_reasons": {
      "five_star": [
        "性价比高",
        "理发效果满意"
      ],
      "one_star": [
        "个别技师服务态度差"
      ]
    }
  },
  "rating_distribution": {
    "1": 3,
    "2": 5,
    "3": 10,
    "4": 40,
    "5": 65
  },
  "recommendation_reasons": [
    "价格符合您的预算",
    "当前营业中，预计 15 分钟可到达"
  ]
}
```

---

#### 2.4 UserProfile 模型（用户画像与偏好）

```json
{
  "user_id": "u_abc",
  "persona": "student_saver",
  "budget_level": "medium",
  "distance_preference": "nearby_first",
  "has_kids": false,
  "needs_wheelchair_access": false,
  "weights": {
    "price": 0.3,
    "distance": 0.3,
    "rating": 0.3,
    "popularity": 0.1
  },
  "created_at": "...",
  "updated_at": "..."
}
```

---

#### 2.5 Offer 模型（V2：服务商报价）

```json
{
  "id": "offer_1",
  "request_id": "req_123",
  "provider_id": "prov_1",
  "price": 45.0,
  "currency": "CHF",
  "eta_minutes": 30,
  "slot": {
    "from": "2026-03-05T18:00:00Z",
    "to": "2026-03-05T19:00:00Z"
  },
  "status": "pending"
}
```

`status` 取值：`pending` / `accepted` / `rejected` / `expired`

---

#### 2.6 统一错误返回

```json
{
  "error": {
    "code": "PLACES_RATE_LIMIT",
    "message": "Upstream Google Places API rate-limited.",
    "details": null
  }
}
```

---

#### 2.7 DeviceLocation 模型（匿名 MVP - 设备级位置）

```json
{
  "device_id": "device_123",
  "lat": 47.3769,
  "lng": 8.5417,
  "accuracy_m": 12.3,
  "updated_at": "2026-03-10T10:00:00Z"
}
```

---

### 3. 搜索 & 推荐接口

#### 3.1 创建搜索请求 +（可选）流式结果

**POST** `/api/requests`

**说明**：  
- 创建新的 Request，触发 Multi-Agent 流程；
- 支持一次性返回全部结果，也支持通过 SSE 流式返回。

**请求体：**

```json
{
  "query": "帮我找附近三公里内评价不错的理发店，8 点前能去的",
  "location": {
    "lat": 47.3769,
    "lng": 8.5417
  },
  "language": "zh-CN",
  "stream": true
}
```

**非流式响应（`stream=false` 或缺省）：**

- 状态码：`201 Created`

```json
{
  "request": { /* Request */ },
  "results": [ /* PlaceSummary[]，有可能为空（异步处理中） */ ]
}
```

**流式模式（推荐 for US-21）：**

- 客户端设置 `Accept: text/event-stream` 或 `?stream=true`
- 状态码：`200 OK`，SSE 事件示例：

```json
// event: intent_parsed — Input Agent 完成意图解析
{
  "type": "intent_parsed",
  "request_id": "req_123",
  "intent": { /* Intent JSON */ }
}

// event: stores_crawled — Crawling Agent Sub-1 (Apify) 完成店铺搜索
{
  "type": "stores_crawled",
  "request_id": "req_123",
  "store_count": 18,
  "results": [ /* PlaceSummary[] 基础信息，尚无评分和评论 */ ]
}

// event: transit_computed — Crawling Agent Sub-2 (SBB API) 完成交通计算
{
  "type": "transit_computed",
  "request_id": "req_123",
  "results": [ /* PlaceSummary[] 含 transit 字段 */ ]
}

// event: reviews_fetched — Review Agent 完成评论抓取与 LLM 摘要
{
  "type": "reviews_fetched",
  "request_id": "req_123",
  "reviews": [ /* { place_id, advantages, disadvantages } */ ]
}

// event: scores_computed — Evaluation Agent 完成评分计算
{
  "type": "scores_computed",
  "request_id": "req_123",
  "results": [ /* PlaceSummary[] 含 recommendation_score */ ]
}

// event: recommendations_ready — Orchestrator Agent 完成聚合与优化
{
  "type": "recommendations_ready",
  "request_id": "req_123",
  "results": [ /* PlaceSummary[] 含推荐理由 */ ]
}

// event: completed — Output Agent 完成，最终结果
{
  "type": "completed",
  "request_id": "req_123",
  "results": [ /* 最终 Top 10，含 one_sentence_recommendation */ ]
}
```

---

#### 3.2 查询 Request 状态与当前结果

**GET** `/api/requests/{request_id}`

**说明**：前端轮询 / 页面刷新时使用。

**响应：**

```json
{
  "request": { /* Request */ },
  "results": [ /* PlaceSummary[] */ ]
}
```

---

#### 3.3 订阅某 Request 的结果流（单独 SSE）

**GET** `/api/requests/{request_id}/stream`

**说明**：  
已有 `request_id` 的情况下，单独开启 SSE 通道接收结果更新。  
事件格式与 3.1 中流式返回一致。

---

### 4. 地点详情与评论

#### 4.1 获取地点详情（聚合 + 摘要）

**GET** `/api/places/{place_id}`

**查询参数：**

- `request_id`（可选）：用于基于当前 Request 上下文生成推荐理由等。

**响应：**

```json
{
  "request_id": "req_123",
  "detail": { /* PlaceDetail */ }
}
```

---

#### 4.2 获取地点原始评论（分页）

**GET** `/api/places/{place_id}/reviews`

**查询参数：**

- `page`: 默认 `1`
- `page_size`: 默认 `20`，最大 `50`
- `sort`: `"newest" | "highest_rating" | "lowest_rating"`

**响应：**

```json
{
  "place_id": "gmp_123",
  "page": 1,
  "page_size": 20,
  "total": 123,
  "reviews": [
    {
      "author_name": "Alice",
      "rating": 5,
      "text": "Very good...",
      "time": "2026-02-01T10:00:00Z",
      "language": "zh-CN"
    }
  ]
}
```

---

### 5. 个性化与用户画像

#### 5.1 冷启动问卷提交（US-09）

**POST** `/api/profile/cold-start-survey`

**请求体：**

```json
{
  "budget_level": "medium",
  "distance_preference": "nearby_first",
  "priority": "rating",
  "persona": "family_with_kids",
  "has_kids": true,
  "needs_wheelchair_access": false
}
```

**响应：**

```json
{
  "profile": { /* UserProfile */ }
}
```

---

#### 5.2 获取 / 更新用户画像与权重（US-10, US-11, US-12）

**GET** `/api/profile`

```json
{
  "profile": { /* UserProfile */ }
}
```

**PUT** `/api/profile`

**请求体（局部更新示例）：**

```json
{
  "persona": "office_worker_premium",
  "weights": {
    "price": 0.1,
    "distance": 0.2,
    "rating": 0.5,
    "popularity": 0.2
  }
}
```

**响应：**

```json
{
  "profile": { /* updated UserProfile */ }
}
```

---

### 6. Provider 端与报价（V2 可选）

#### 6.1 Provider 端：查询附近 Request 列表

**GET** `/api/providers/requests`

**查询参数：**

- `lat`, `lng`：必填（或由 Provider Profile 推断）
- `radius_km`：默认 `5`
- `service_category`：可选

**响应：**

```json
{
  "items": [
    {
      "request": { /* Request 子集：id, service_category, time_window, location */ },
      "summary": {
        "distance_km": 2.1,
        "expected_price_range": "medium"
      }
    }
  ]
}
```

---

#### 6.2 Provider 端：对某 Request 提交 Offer（US-24）

**POST** `/api/requests/{request_id}/offers`

**请求体：**

```json
{
  "price": 45.0,
  "currency": "CHF",
  "eta_minutes": 30,
  "slot": {
    "from": "2026-03-05T18:00:00Z",
    "to": "2026-03-05T19:00:00Z"
  }
}
```

**响应：**

```json
{
  "offer": { /* Offer */ }
}
```

---

#### 6.3 用户端：查看某 Request 的 Offer 列表（US-24）

**GET** `/api/requests/{request_id}/offers`

**响应：**

```json
{
  "request_id": "req_123",
  "offers": [ /* Offer[] */ ]
}
```

---

#### 6.4 Offer 实时更新 SSE（US-25）

**GET** `/api/requests/{request_id}/offers/stream`

**说明**：  
- 当有新 Offer 创建或状态更新时，推送到当前 Request 的前端会话。

**事件示例：**

```json
// event: offer_created
{
  "type": "offer_created",
  "offer": { /* Offer */ }
}

// event: offer_updated
{
  "type": "offer_updated",
  "offer": { /* Offer with new status */ }
}
```

---

### 7. Debug / Trace 接口（US-27）

#### 7.1 获取某次调用的 Agent Trace

**GET** `/api/traces/{trace_id}`

**响应：**

```json
{
  "trace_id": "trace_abc",
  "request_id": "req_123",
  "graph": {
    "nodes": [
      { "id": "input_agent", "type": "agent" },
      { "id": "crawling_agent_search", "type": "agent" },
      { "id": "crawling_agent_transit", "type": "agent" },
      { "id": "evaluation_agent", "type": "agent" },
      { "id": "review_agent", "type": "agent" },
      { "id": "orchestrator_agent", "type": "agent" },
      { "id": "output_agent_ranking", "type": "agent" },
      { "id": "output_agent_recommendation", "type": "agent" }
    ],
    "edges": [
      { "from": "input_agent", "to": "crawling_agent_search" },
      { "from": "input_agent", "to": "review_agent" },
      { "from": "crawling_agent_search", "to": "crawling_agent_transit" },
      { "from": "crawling_agent_transit", "to": "evaluation_agent" },
      { "from": "evaluation_agent", "to": "orchestrator_agent" },
      { "from": "review_agent", "to": "orchestrator_agent" },
      { "from": "orchestrator_agent", "to": "output_agent_ranking" },
      { "from": "orchestrator_agent", "to": "output_agent_recommendation" }
    ]
  },
  "steps": [
    {
      "agent_name": "input_agent",
      "status": "success",
      "duration_ms": 850,
      "input_summary": "帮我找附近三公里内评价不错的理发店...",
      "output_summary": "解析为 haircut 类别，半径 3km，预算 medium"
    },
    {
      "agent_name": "crawling_agent_search",
      "status": "success",
      "duration_ms": 2100,
      "input_summary": "Apify Google Maps scraper: haircut, 47.37°N 8.54°E, 3km",
      "output_summary": "返回 18 家店铺，过滤营业时间后剩余 12 家"
    },
    {
      "agent_name": "crawling_agent_transit",
      "status": "success",
      "duration_ms": 1500,
      "input_summary": "SBB API: 12 个目的地",
      "output_summary": "已计算 12 条公共交通路线（tram/bus/train）"
    },
    {
      "agent_name": "review_agent",
      "status": "success",
      "duration_ms": 3200,
      "input_summary": "Apify review scraper: 12 家店铺",
      "output_summary": "已生成 12 份优劣势摘要"
    },
    {
      "agent_name": "evaluation_agent",
      "status": "success",
      "duration_ms": 200,
      "input_summary": "12 家店铺，用户权重 price=0.3 distance=0.3 rating=0.3",
      "output_summary": "评分完成，最高分 0.94"
    },
    {
      "agent_name": "orchestrator_agent",
      "status": "success",
      "duration_ms": 1100,
      "input_summary": "聚合 12 家店铺的评分、评论和交通数据",
      "output_summary": "精炼为 Top 10 推荐，已生成推荐理由"
    },
    {
      "agent_name": "output_agent_ranking",
      "status": "success",
      "duration_ms": 50,
      "input_summary": "Top 10 推荐列表",
      "output_summary": "排名列表已格式化"
    },
    {
      "agent_name": "output_agent_recommendation",
      "status": "success",
      "duration_ms": 600,
      "input_summary": "Top 10 推荐列表",
      "output_summary": "已为每家店铺生成一句话推荐"
    }
  ],
  "created_at": "2026-03-09T14:30:00Z"
}
```

---

### 8. 位置同步接口（匿名 MVP - 设备级）

#### 8.1 更新当前设备位置

**PUT** `/api/location/current`

**查询参数：**

- `device_id`: string（必填；前端生成的稳定设备/会话 ID，例如保存在 `localStorage` 中的 UUID）

**请求体：**

```json
{
  "lat": 47.3769,
  "lng": 8.5417,
  "accuracy_m": 12.3,
  "timestamp": "2026-03-10T10:00:00Z"
}
```

**响应：**

```json
{
  "device_id": "device_123",
  "lat": 47.3769,
  "lng": 8.5417,
  "accuracy_m": 12.3,
  "updated_at": "2026-03-10T10:00:00Z"
}
```

#### 8.2 获取当前设备位置

**GET** `/api/location/current`

**查询参数：**

- `device_id`: string（必填）

**成功响应（存在位置数据）：**

```json
{
  "device_id": "device_123",
  "lat": 47.3769,
  "lng": 8.5417,
  "accuracy_m": 12.3,
  "updated_at": "2026-03-10T10:00:00Z"
}
```

**错误响应示例：**

- 未提供 `device_id`：

```json
{
  "detail": "device_id query parameter is required"
}
```

- 未找到对应位置：

```json
{
  "detail": "Location not found for this device_id"
}
```

