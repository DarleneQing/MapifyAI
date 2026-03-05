# IntelligentLocalBid Controller – 前端对齐文档

> 角色定位：本文件从 **前端视角** 描述各个页面/功能会调用哪些 Controller 接口、请求参数与响应结构（含 SSE 事件），帮助你（Controller 负责人）和前端同学对齐联调契约。  
> 参考文档：`api-intelligent-local-bid.md`、`PRD_IntelligentLocalBid.md`、`backend/controller-service-contract.md`。

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
// event: request_created
{
  "type": "request_created",
  "request": { /* Request */ }
}

// event: partial_results
{
  "type": "partial_results",
  "request_id": "req_123",
  "results": [ /* PlaceSummary[] 子集 */ ]
}

// event: completed
{
  "type": "completed",
  "request_id": "req_123",
  "results": [ /* 最终 Top 10 */ ]
}
```

- **前端处理建议**：
  - 首次收到 `request_created`：
    - 保存 `request_id`；
    - 显示“正在为你搜索…”之类的状态。
  - 每次收到 `partial_results`：
    - 增量更新列表（按 `recommendation_score` 降序合并）。
    - 可逐步填充骨架屏中的卡片信息。
  - 收到 `completed`：
    - 用最终 `results` 替换本地列表。
    - 关闭 loading / 显示“已为你找到 X 个地点”。

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
- **事件格式**：与 2.1.2 中 `request_created` / `partial_results` / `completed` 一致。

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
  - `eta_minutes`: number
  - `reason_tags`: string[]（用于列表卡片上的“推荐理由标签”）

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
      }
    },
    "review_summary": {
      "positive_highlights": [ "理发师技术专业、态度友好" ],
      "negative_highlights": [ "高峰期等待时间较长" ],
      "star_reasons": {
        "five_star": [ "性价比高", "理发效果满意" ],
        "one_star": [ "个别技师服务态度差" ]
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
}
```

- **前端约定**：
  - 详情页顶部展示 `place` 的基础信息和营业状态。
  - 中间区域展示评论摘要、好/差评要点、评分分布图。
  - 推荐理由区域使用 `recommendation_reasons` 渲染“为什么推荐这家”。

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
      { "id": "orchestrator", "type": "agent" },
      { "id": "search_agent", "type": "agent" },
      { "id": "realtime_validator", "type": "agent" }
    ],
    "edges": [
      { "from": "orchestrator", "to": "search_agent" },
      { "from": "orchestrator", "to": "realtime_validator" }
    ]
  },
  "steps": [
    {
      "node_id": "search_agent",
      "status": "success",
      "duration_ms": 320,
      "input_summary": "...",
      "output_summary": "返回 25 个候选地点..."
    }
  ],
  "created_at": "..."
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

## 9. 总结：前端主要使用的接口列表

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
- Provider 竞价（可选）：
  - `GET /api/requests/{request_id}/offers`
  - `GET /api/requests/{request_id}/offers/stream`
- Debug & 隐私：
  - `GET /api/traces/{trace_id}`
  - `GET /api/meta/privacy`

这份文档可以直接分享给前端同学，用作联调时的“接口合同”。如后续 API 有调整，可以在这里同步更新，保持 Controller 与前端对齐。

