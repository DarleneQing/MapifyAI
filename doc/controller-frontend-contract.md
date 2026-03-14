# IntelligentLocalBid Controller – 前端对齐文档

> 角色定位：本文件从 **前端视角** 描述各个页面/功能会调用哪些 Controller 接口、请求参数与响应结构（含 SSE 事件），帮助你（Controller 负责人）和前端同学对齐联调契约。  
> 参考文档：`api-intelligent-local-bid.md`、`PRD_IntelligentLocalBid.md`、`doc/controller-service-contract.md`。

---

## 1. 全局约定

- **Base URL**：`/api`
- **认证**：
  - MVP 允许匿名访问；如有登录体系，前端通过 `Authorization: Bearer <token>` 传递用户 JWT。
- **数据格式**：
  - 普通接口：`Content-Type: application/json`
  - SSE 流：`Content-Type: text/event-stream`

---

## 2. 首页 / 搜索页（输入自然语言，看到 Top N 推荐）

### 2.1 创建搜索请求 + 获取初始推荐列表

- **URL**：`POST /api/requests`
- **用途**：
  - 用户在首页输入自然语言（中/英/混合）后，前端调用此接口。
  - 后端会创建 `Request` 对象，并触发 Multi-Agent 推荐流程。
  - 前端可选择：
    - 直接拿一次性结果渲染列表；或
    - 配合 SSE 流式获取更加实时的更新。

#### 2.1.1 非流式模式（推荐作为兜底）

- **请求头**：
  - `Content-Type: application/json`
- **请求体示例**：

```json
{
  "query": "帮我找附近三公里内评价不错的理发店，8 点前能去的",
  "location": {
    "lat": 47.3769,
    "lng": 8.5417
  },
  "language": "zh-CN",
  "stream": false
}
```

- **响应**（`201 Created`）：

```json
{
  "request": { /* Request 对象，见 API 设计文档 2.1 */ },
  "results": [ /* PlaceSummary[]，最多 10 条 */ ]
}
```

- **前端约定**：
  - 保存 `request.id`（记作 `requestId`），后续用于轮询、详情页上下文、报价流等。
  - `results` 用于初始化推荐列表 + 地图标注。

#### 2.1.2 流式模式（推荐用于 Demo，体验更好）

前端可以在请求体中设置 `"stream": true`，并使用 SSE 接收渐进式结果。

**方式 A：同一个 `POST /api/requests` 就返回 SSE**

- **请求头**：
  - `Content-Type: application/json`
  - `Accept: text/event-stream`
- **请求体**：

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

- **SSE 事件格式**（事件名 + data，Controller 负责按此格式输出）：

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
  "results": [ /* PlaceSummary[] 基础信息 */ ]
}

// event: transit_computed — Crawling Agent Sub-2 (Swiss Transit API) 完成交通计算
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

- **前端处理建议**：
  - 收到 `intent_parsed`：
    - 保存 `request_id`；
    - 显示“已理解你的需求，正在搜索…”。
  - 收到 `stores_crawled`：
    - 用基础信息初始化列表骨架屏和地图标注。
  - 收到 `transit_computed`：
    - 为每个卡片填充公共交通信息（时长、交通方式）。
  - 收到 `reviews_fetched`：
    - 填充优势 / 劣势摘要标签。
  - 收到 `scores_computed`：
    - 按 `recommendation_score` 重新排序列表。
  - 收到 `recommendations_ready`：
    - 填充推荐理由标签。
  - 收到 `completed`：
    - 用最终 `results` 替换本地列表（含 `one_sentence_recommendation`）。
    - 关闭 loading / 显示“已为你找到 X 个地点”。

- **前端结果缓存策略（ChatContext）**：
  - 搜索结果存入 React Context（`ChatContext`），在用户切换 Tab 时保持数据。
  - 当用户从其他页面返回时，前端优先使用 `ChatContext` 中的缓存数据，避免重复调用 API。
  - 数据源优先级：Navigation State > ChatContext > API 调用。
  - 详见 `frontend-architecture.md` § 9 State Management - ChatContext。

**方式 B：先 `POST` 拿 `request_id`，再用 `GET /api/requests/{id}/stream` 开 SSE**  
见下文 2.3。

---

### 2.2 刷新当前 Request 状态与结果（轮询/页面重进）

- **URL**：`GET /api/requests/{request_id}`
- **用途**：
  - 用户刷新页面或从别的入口重新进入某次搜索时，前端用 `request_id` 拉取最新状态与结果。

- **响应示例**：

```json
{
  "request": { /* Request */ },
  "results": [ /* PlaceSummary[] */ ]
}
```

- **前端约定**：
  - 根据 `request.status` 显示不同状态（搜索中/已完成/已过期）。
  - 对 `results` 渲染列表和地图联动。

---

### 2.3 单独订阅某 Request 的搜索结果流（SSE）

- **URL**：`GET /api/requests/{request_id}/stream`
- **用途**：
  - 前端在已经拿到 `request_id` 的情况下（如从历史记录点进），再开启 SSE 通道获取最新搜索进度。

- **请求方式**：
  - `GET`，`Accept: text/event-stream`
- **事件格式**：与 2.1.2 中 7 阶段事件一致（`intent_parsed` → `stores_crawled` → `transit_computed` → `reviews_fetched` → `scores_computed` → `recommendations_ready` → `completed`）。

---

## 3. 排行榜列表 / 地图联动

> 列表 & 地图所需数据主要来自 2.x 的 `PlaceSummary[]`。  
> 这里补充几点前端需要关注的字段：

- **`PlaceSummary` 关键字段**（来自 `api-intelligent-local-bid.md` 2.2）：
  - `place_id`: string
  - `name`: string
  - `address`: string
  - `distance_km`: number
  - `price_level`: `"low" | "medium" | "high" | ...`
  - `rating`: number
  - `rating_count`: number
  - `recommendation_score`: number（用于排序）
  - `status`: `"open_now" | "closing_soon" | "closed"`
  - `transit`: object — 公共交通信息（来自 Swiss Transit API）
    - `duration_minutes`: number
    - `transport_types`: string[]（如 `["tram"]` 或 `["tram", "bus"]`）
    - `departure_time`: string（如 `"17:45"`）
    - `summary`: string（如 `"22 min — Tram 4 → Bus 33"`）
    - `connections`: array | null — 当 `transport_types` 含多种方式时，包含每段换乘详情
  - `reason_tags`: string[]
  - `one_sentence_recommendation`: string（用于列表卡片上的“推荐理由标签”）

- **前端使用建议**：
  - 地图标注：用 `place_id` / 坐标（需由后端扩展 `PlaceSummary` 或详情接口返回）作为唯一标识。
  - 列表 & 地图联动：
    - 悬停/点击列表项：高亮对应地图 pin。
    - 点击地图 pin：滚动并高亮对应列表项。

---

## 4. 服务商详情页

从排行榜或地图进入详情页时，前端会调用以下接口。

### 4.1 获取地点详情（含评论摘要、评分分布等）

- **URL**：`GET /api/places/{place_id}`
- **可选查询参数**：
  - `request_id`: string（如从某次搜索结果点进，前端应带上，用于生成“与你当前需求的匹配度”类推荐理由）

- **响应示例**：

```json
{
  "request_id": "req_123",
  "detail": {
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
      },
      "social_profiles": {
        "facebook": "https://facebook.com/awesome-hair-salon",
        "instagram": "https://instagram.com/awesome-hair-salon"
      },
      "popular_times": {
        "mon": [0, 10, 30, 50, 40, 20],
        "tue": [0, 5, 15, 35, 45, 25]
      },
      "detailed_characteristics": [
        "Kid-friendly",
        "Outdoor seating",
        "Wheelchair accessible"
      ]
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
        "five_star": ["性价比高", "理发效果满意"],
        "one_star": ["个别技师服务态度差"]
      }
    },
    "rating_distribution": {
      "1": 3,
      "2": 5,
      "3": 10,
      "4": 40,
      "5": 65
    },
    "questions_and_answers": [
      {
        "question": "Do you have Wi‑Fi?",
        "answer": "Yes, free Wi‑Fi is available for customers."
      }
    ],
    "customer_updates": [
      {
        "text": "Now open on Sundays from 10:00–16:00",
        "language": "en"
      }
    ],
    "recommendation_reasons": [
      "价格符合您的预算",
      "当前营业中，预计 15 分钟可到达"
    ]
  }
}
```

- **前端约定**：
  - 详情页顶部展示 `place` 的基础信息和营业状态，并提供社交媒体跳转按钮。
  - 中间区域展示评论摘要（优势 `advantages` / 劣势 `disadvantages`）、评分分布图以及热门时段（`popular_times`）可视化。
  - 推荐理由区域使用 `recommendation_reasons` 渲染“为什么推荐这家”，并在合适位置展示 `questions_and_answers` 与 `customer_updates` 精选内容。

---

### 4.2 加载地点原始评论（分页）

- **URL**：`GET /api/places/{place_id}/reviews`
- **查询参数**：
  - `page`: 默认 `1`
  - `page_size`: 默认 `20`，最大 `50`
  - `sort`: `"newest" | "highest_rating" | "lowest_rating"`

- **响应示例**：

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

- **前端约定**：
  - 用 `total` + `page` + `page_size` 控制“加载更多”。
  - 评论列表支持按 `sort` 切换排序。

---

## 5. 个性化 & 用户画像（设置页 / 首次进入弹窗）

### 5.1 冷启动偏好问卷提交

- **URL**：`POST /api/profile/cold-start-survey`
- **用途**：首次使用时的 3–5 个问题问卷结果提交。

- **请求体示例**：

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

- **响应示例**：

```json
{
  "profile": { /* UserProfile 对象，见 API 文档 2.4 */ }
}
```

- **前端约定**：
  - 提交成功后，将 `profile` 存到前端状态中，后续推荐理由/排序可展示与该画像的匹配点。

---

### 5.2 获取 / 更新用户画像与权重（设置页滑块）

- **URL（获取）**：`GET /api/profile`
- **URL（更新）**：`PUT /api/profile`

- **获取响应示例**：

```json
{
  "profile": {
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
}
```

- **更新请求示例**（部分字段更新）：

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

- **更新响应**：

```json
{
  "profile": { /* updated UserProfile */ }
}
```

- **前端约定**：
  - 设置页加载时先 `GET /api/profile` 填充滑块初始值。
  - 用户调整滑块后 `PUT /api/profile`，成功后可触发一次重新搜索或本地重新排序提示。

---

## 6. Provider 竞价 & 实时报价（V2 / Demo 可选）

> 若本期实现 Provider 端 Demo，前端还会用到以下接口；否则可以忽略。

### 6.1 用户端：查看某 Request 的 Offer 列表

- **URL**：`GET /api/requests/{request_id}/offers`

- **响应示例**：

```json
{
  "request_id": "req_123",
  "offers": [
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
  ]
}
```

- **前端约定**：
  - 可在“竞价”侧边栏或底部弹层展示 `offers` 列表。
  - 按价格、eta 或系统提供的综合分排序（如后端计算）。

---

### 6.2 Offer 实时更新 SSE

- **URL**：`GET /api/requests/{request_id}/offers/stream`
- **用途**：在用户停留在某次 Request 的详情/竞价页面时，实时收到新报价或状态变化。

- **请求**：
  - `GET`，`Accept: text/event-stream`

- **事件示例**：

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

- **前端约定**：
  - 收到 `offer_created`：插入新的报价卡片并重新排序。
  - 收到 `offer_updated`：更新对应 `offer.id` 的卡片状态。

---

## 7. Debug / Trace 面板（仅内部调试）

前端若实现隐藏的 Debug Panel，可调用以下接口：

- **URL**：`GET /api/traces/{trace_id}`

- **响应示例**：

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
      "input_summary": "Swiss Transit API: 12 个目的地",
      "output_summary": "已计算 12 条公共交通路线（tram/bus/train）"
    }
  ],
  "created_at": "2026-03-09T14:30:00Z"
}
```

- **前端约定**：
  - 仅在 `?debug=true` 或内部调试模式下展示。
  - 可将 `graph` 渲染为简单的节点/边图，`steps` 以列表形式展示。

---

## 8. 隐私与数据使用页面

- **URL**：`GET /api/meta/privacy`

- **响应示例**：

```json
{
  "permissions": [
    {
      "name": "location",
      "description": "用于推荐离你最近、当前营业的商家",
      "required": true
    }
  ],
  "data_collected": [
    "偏好配置（预算、权重等）",
    "画像标签（学生 / 上班族等）",
    "基础日志（Request id, trace id, 错误码）"
  ],
  "data_not_collected": [
    "敏感个人身份信息",
    "精确历史轨迹（MVP 不存储）"
  ]
}
```

- **前端约定**：
  - 在“隐私说明”/“关于”页面展示这些信息。
  - 在首次请求定位权限前，可结合 `permissions` 中的描述给出用途说明。

---

## 9. 设备级位置同步（匿名 MVP）

> 目标：在没有登录体系的前提下，让前端通过设备/会话 ID 把“当前 GPS 位置”同步给后端，用于后续推荐、分析等。地图本身依然由前端基于 `navigator.geolocation.watchPosition` 等 API 直接驱动。

### 9.1 前端职责

前端在应用启动时：

- 生成并持久化一个稳定的 `device_id`：
  - 建议使用 `crypto.randomUUID()` 或等价方案；
  - 存储在 `localStorage` 或 IndexedDB 中；
  - 所有与位置相关的请求都携带同一个 `device_id`。
- 使用浏览器 / 宿主环境的定位 API 获取实时位置：
  - Web：`navigator.geolocation.watchPosition`；
  - React Native / 小程序等：使用各自平台的持续定位接口；
  - 监听位置变化（例如距离变化超过 50–100m 或固定时间间隔 N 秒）。

当监听到位置发生“足够变化”时：

- 调用 `PUT /api/location/current?device_id=<device_id>`，请求体为当前 `{ lat, lng, accuracy_m, timestamp }`。
- 地图视图使用最新的前端本地坐标即时更新（不依赖后端）。

### 9.2 接口约定

- **URL（更新）**：`PUT /api/location/current?device_id=<device_id>`
  - 请求体：  
    - `lat: number`  
    - `lng: number`  
    - `accuracy_m?: number`  
    - `timestamp?: string`（ISO，前端可选）
  - 响应体（简化）：  
    - `device_id: string`  
    - `lat: number`  
    - `lng: number`  
    - `accuracy_m?: number`  
    - `updated_at: string`（由后端生成，ISO）

- **URL（读取，可选调试用）**：`GET /api/location/current?device_id=<device_id>`
  - 成功返回：同上 `DeviceLocation` 结构；
  - 404：当前设备尚未上报位置（前端可以据此提示用户开启定位）。

> 注意：  
> - 搜索请求 `POST /api/requests` 在 MVP 阶段仍然要求前端显式传入 `location: { lat, lng }`，避免引入隐式依赖。  
> - 设备级位置同步是“辅助通道”，为未来的隐式位置回退、分析、个性化留接口，不改变现有搜索契约。

### 9.3 对前端工程的建议

- 在前端项目中封装一个统一的 `useDeviceLocation` hook / store：
  - 负责：
    - 初始化和持久化 `device_id`；
    - 管理 `currentLocation` 状态；
    - 节流/防抖向 `/api/location/current` 上报；
  - 地图组件、搜索表单都从该 hook 中读取当前 `lat/lng`，保证一致性。

### 9.4 当前实现：位置获取策略

当前 `useDeviceLocation` hook 采用以下策略获取用户位置：

1. **默认位置**：瑞士苏黎世（lat: 47.3769, lng: 8.5417）
2. **获取顺序**：
   - 若为安全上下文（HTTPS 或 localhost）：尝试浏览器 `getCurrentPosition`（一次性获取，非持续追踪）
   - 若浏览器定位失败或非安全上下文：使用 IP 地理定位（`ip-api.com`，城市级精度）
   - 若 IP 定位也失败：回退到默认位置（苏黎世）
3. **单例模式**：位置仅获取一次并全局缓存，避免重复请求和 UI 抖动

```
┌─────────────────────────────────────┐
│     Start: Get User Location        │
└─────────────────┬───────────────────┘
                  │
        ┌─────────────────┐
        │ Secure Context? │
        │ (HTTPS/localhost)│
        └────────┬────────┘
                 │
         ┌───────┴───────┐
         │ No            │ Yes
         ▼               ▼
┌─────────────┐  ┌──────────────────┐
│ Try IP API  │  │ Try Browser GPS  │
└──────┬──────┘  └────────┬─────────┘
       │                  │
       │           ┌──────┴──────┐
       │           │ Success?    │
       │           └──────┬──────┘
       │            No    │ Yes
       │            ▼     ▼
       │     ┌──────────┐ ┌──────────┐
       │     │Try IP API│ │Use GPS   │
       │     └────┬─────┘ │Location  │
       │          │       └──────────┘
       └──────────┼───────────────────┘
                  │
         ┌────────┴────────┐
         │ IP Success?     │
         └────────┬────────┘
           No     │ Yes
           ▼      ▼
    ┌──────────┐ ┌──────────────┐
    │ Zurich   │ │ IP Location  │
    │ Default  │ │ (City-level) │
    └──────────┘ └──────────────┘
```

> **注意**：
> - 本地开发（HTTP）时，浏览器 Geolocation API 可能返回 403 错误，此时自动回退到 IP 定位。
> - 位置模块不再使用 `watchPosition` 持续追踪，改为一次性获取，适合原型开发场景。
> - 如需恢复持续追踪功能，可修改 `useDeviceLocation.ts` 中的实现。

---

## 10. 总结：前端主要使用的接口列表

- 搜索 & 推荐：
  - `POST /api/requests`（创建 Request + 一次性或流式结果）
  - `GET /api/requests/{request_id}`（刷新状态/结果）
  - `GET /api/requests/{request_id}/stream`（仅拉取流式结果）
- 地点详情 & 评论：
  - `GET /api/places/{place_id}`（聚合详情）
  - `GET /api/places/{place_id}/reviews`（原始评论分页）
- 个性化 & 画像：
  - `POST /api/profile/cold-start-survey`
  - `GET /api/profile`
  - `PUT /api/profile`
- 设备级位置同步（匿名 MVP）：
  - `PUT /api/location/current`
  - `GET /api/location/current`
- Provider 竞价（可选）：
  - `GET /api/requests/{request_id}/offers`
  - `GET /api/requests/{request_id}/offers/stream`
- Debug & 隐私：
  - `GET /api/traces/{trace_id}`
  - `GET /api/meta/privacy`

这份文档可以直接分享给前端同学，用作联调时的“接口合同”。如后续 API 有调整，可以在这里同步更新，保持 Controller 与前端对齐。

---

## 10. TypeScript 类型契约（与后端实体对齐）

> 说明：本小节给出前端可直接复用的 TypeScript 类型定义，字段命名与后端 `pydantic` 模型（见 `backend/app/models/schemas.py` 等）保持一致，用于保证数据通信的一致性。可在前端项目中单独建立 `contracts/intelligent-local-bid.ts` 并复制以下内容。

```ts
// 基础 Geo 坐标，与 schemas.LatLng 对齐
export interface LatLng {
  lat: number;
  lng: number;
}

// 用户偏好权重，与 schemas.UserPreferences 对齐
export interface UserPreferences {
  weight_price: number;
  weight_distance: number;
  weight_rating: number;
}

// 创建搜索请求 payload，与 schemas.CreateRequestPayload 对齐
export interface CreateRequestPayload {
  raw_input: string;
  location: LatLng;
  preferences?: UserPreferences | null;
  // 控制是否使用 SSE 流式返回，Controller 层扩展字段
  stream?: boolean;
  // 语言（如 "zh-CN" / "en-US"），与文档示例保持一致
  language?: string;
}

// 后端内部的结构化请求，与 schemas.StructuredRequest 对齐
export interface StructuredRequest {
  id: string;
  raw_input: string;
  category: string; // 例如 "haircut" | "massage"
  requested_time: string; // ISO datetime
  location: LatLng;
  radius_km: number;
  constraints: Record<string, unknown>;
  status: string; // "pending" | "open" | "closed"
  created_at: string | null; // ISO datetime
}

// Swiss Transit 公共交通换乘段
export type TransportType = "train" | "bus" | "tram" | "walk";

export interface TransitConnection {
  transport_type: TransportType;
  line?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  duration_minutes: number;
  from_stop?: string | null;
  to_stop?: string | null;
}

// Swiss Transit 公共交通信息
export interface TransitInfo {
  duration_minutes: number;
  transport_types: TransportType[];
  departure_time?: string | null;
  summary?: string | null;
  connections?: TransitConnection[] | null;
}

// 列表 / 地图使用的聚合结果，来自本文件 3. PlaceSummary 约定
export interface PlaceSummary {
  place_id: string;
  name: string;
  address: string;
  distance_km: number;
  price_level: "low" | "medium" | "high" | string;
  rating: number;
  rating_count: number;
  recommendation_score: number;
  status: "open_now" | "closing_soon" | "closed" | string;
  transit?: TransitInfo | null;
  reason_tags: string[];
  one_sentence_recommendation?: string | null;
}

// 2.1 / 2.2 接口统一的返回体
export interface RequestWithResults {
  request: StructuredRequest;
  results: PlaceSummary[];
}

// SSE 事件（2.1.2 / 2.3），前端可据此做类型收窄 — 7 阶段 Agent 管道
export interface ReviewFetchedItem {
  place_id: string;
  advantages: string[];
  disadvantages: string[];
}

export type RequestSseEvent =
  | {
      type: "intent_parsed";
      request_id: string;
      intent: Record<string, unknown>;
    }
  | {
      type: "stores_crawled";
      request_id: string;
      store_count: number;
      results: PlaceSummary[];
    }
  | {
      type: "transit_computed";
      request_id: string;
      results: PlaceSummary[];
    }
  | {
      type: "reviews_fetched";
      request_id: string;
      reviews: ReviewFetchedItem[];
    }
  | {
      type: "scores_computed";
      request_id: string;
      results: PlaceSummary[];
    }
  | {
      type: "recommendations_ready";
      request_id: string;
      results: PlaceSummary[];
    }
  | {
      type: "completed";
      request_id: string;
      results: PlaceSummary[];
    };

// 详情页所需结构，来自 4.1 响应示例
export interface OpeningHoursToday {
  today_open: string;
  today_close: string;
  is_open_now: boolean;
}

export interface PlaceBasic {
  place_id: string;
  name: string;
  address: string;
  phone?: string | null;
  website?: string | null;
  location: LatLng;
  rating: number;
  rating_count: number;
  price_level: "low" | "medium" | "high" | string;
  status: "open_now" | "closing_soon" | "closed" | string;
  opening_hours?: OpeningHoursToday | null;
}

export interface ReviewSummary {
  advantages: string[];
  disadvantages: string[];
  star_reasons: Record<string, string[]>;
}

export type RatingDistribution = Record<"1" | "2" | "3" | "4" | "5" | string, number>;

export interface PlaceDetail {
  place: PlaceBasic;
  review_summary: ReviewSummary;
  rating_distribution: RatingDistribution;
  recommendation_reasons: string[];
}

export interface PlaceDetailResponse {
  request_id: string;
  detail: PlaceDetail;
}

// 4.2 原始评论分页
export interface PlaceReview {
  author_name: string;
  rating: number;
  text: string;
  time: string; // ISO datetime
  language: string;
}

export interface PlaceReviewsPage {
  place_id: string;
  page: number;
  page_size: number;
  total: number;
  reviews: PlaceReview[];
}

// 5. 个性化画像（与文档 & 未来 schemas.UserProfile 对齐）
export interface UserProfileWeights {
  price: number;
  distance: number;
  rating: number;
  popularity: number;
}

export interface UserProfile {
  user_id: string;
  persona: string; // 如 "student_saver" / "family_with_kids"
  budget_level: "low" | "medium" | "high" | string;
  distance_preference: string; // 如 "nearby_first"
  has_kids: boolean;
  needs_wheelchair_access: boolean;
  weights: UserProfileWeights;
  created_at: string;
  updated_at: string;
}

export interface ColdStartSurveyPayload {
  budget_level: "low" | "medium" | "high" | string;
  distance_preference: string;
  priority: string;
  persona: string;
  has_kids: boolean;
  needs_wheelchair_access: boolean;
}

export interface ProfileResponse {
  profile: UserProfile;
}

// 6. Provider 竞价（与 Offer+Request 契约对齐）
export interface OfferSlot {
  from: string; // ISO datetime
  to: string; // ISO datetime
}

export interface Offer {
  id: string;
  request_id: string;
  provider_id: string;
  price: number;
  currency: string;
  eta_minutes: number;
  slot: OfferSlot;
  status: string; // "pending" | "accepted" | ...
}

export interface OffersResponse {
  request_id: string;
  offers: Offer[];
}

export type OfferSseEvent =
  | {
      type: "offer_created";
      offer: Offer;
    }
  | {
      type: "offer_updated";
      offer: Offer;
    };

// 7. Debug / Trace 面板（与 AgentTrace 对齐的简化前端视图）
export interface TraceGraphNode {
  id: string;
  type: string;
}

export interface TraceGraphEdge {
  from: string;
  to: string;
}

export interface TraceStepView {
  agent_name: string;
  status: string;
  duration_ms: number;
  input_summary: string;
  output_summary: string;
}

export interface TraceResponse {
  trace_id: string;
  request_id: string;
  graph: {
    nodes: TraceGraphNode[];
    edges: TraceGraphEdge[];
  };
  steps: TraceStepView[];
  created_at: string;
}

// 8. 隐私说明接口
export interface PrivacyPermission {
  name: string;
  description: string;
  required: boolean;
}

export interface PrivacyMeta {
  permissions: PrivacyPermission[];
  data_collected: string[];
  data_not_collected: string[];
}
```

