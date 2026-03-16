# IntelligentLocalBid Controller 接口与 Service 依赖说明

> 角色定位：本文件只定义 **Controller 层（FastAPI 路由函数）** 与 **Service 层函数** 的依赖关系，用于你（Controller 负责人）与另外两位 Service 负责人的协作对齐。  
> 参考文档：`api-intelligent-local-bid.md`、`PRD_IntelligentLocalBid.md`。

---

## 1. 模块与路由划分建议

为方便协作，按资源/领域拆分为多个 router（Controller 模块），每个 router 内由你负责定义 FastAPI 路由函数，调用相应的 service 函数：

- `requests_controller`（搜索 & 推荐主流程）
  - 路由前缀：`/api/requests`
- `places_controller`（地点详情与评论）
  - 路由前缀：`/api/places`
- `profile_controller`（用户画像 & 偏好）
  - 路由前缀：`/api/profile` 或复用现有 `/api/users/me*`
- `provider_bid_controller`（Provider 端 & 报价 Offer，V2）
  - 路由前缀：`/api/providers`、`/api/requests/{request_id}/offers`
- `debug_trace_controller`（Agent Trace / Debug）
  - 路由前缀：`/api/traces`
- `meta_controller`（隐私与数据说明）
  - 路由前缀：`/api/meta`
- `location_controller`（设备级位置同步，匿名 MVP）
  - 路由前缀：`/api/location`

下面逐个接口说明 Controller 需要的函数，以及需要调用哪些 Service 函数（由其他两位同学实现）。

---

## 2. 搜索 & 推荐接口（Requests）

### 2.1 创建搜索请求（支持流式返回）

**接口**

- 方法：`POST /api/requests`
- 用途：前端输入自然语言查询后，创建 `StructuredRequest`，并触发 6-Agent 推荐流程（Input → Crawling → Evaluation / Review → Orchestrator → Output）。  
  - `stream=false` 或缺省：一次性返回结果  
  - `stream=true` 或 SSE：流式推送结果（按 Agent 执行阶段逐步推送）
- 请求体：`CreateRequestPayload`
  - 字段：`raw_input: str`、`location: LatLng`、`preferences: UserPreferences | None`
- 非流式返回体建议：`RankedOffersResponse`
  - 字段：`request: StructuredRequest`、`offers: list[Offer]`、`trace: AgentTrace | None`

**Controller 函数（你负责）**

- 函数名建议：`create_request`
- 职责：
  - 校验请求体（`raw_input`、`location`、`preferences`、`stream`）
  - 获取当前用户（如有登录）：可通过 `auth_service`
  - 调用服务层：创建 `StructuredRequest`、启动推荐/报价排序流程
  - 根据 `stream` 决定返回 JSON 还是返回 SSE 流

**需要调用的 Service 函数（由其他人实现）**

- `intent_service.parse_natural_query(query: str, language: str) -> Intent`
  - 自然语言 → 结构化意图 JSON（PRD 4.1.1）
- `request_service.create_request(payload: CreateRequestPayload, user_id: str | None) -> StructuredRequest`
  - 创建并持久化一条 `StructuredRequest` 记录（PRD 4.1.0）
- 非流式模式时：
  - `orchestrator_service.run_recommendation_pipeline(request_id: str) -> RankedOffersResponse`
    - 触发整个 6-Agent DAG（Input Agent → Crawling Agent → Evaluation Agent / Review Agent → Orchestrator Agent → Output Agent），返回排好序的 `offers` + `request` + 可选 `trace`（PRD 4.1.2 / 4.1.4 / 4.1.5）
- 流式模式（SSE）时（**当前已实现**）：
  - Controller 调用 `request_service.create_request` 拿到 `request_id`，再在后台线程中调用 `app.agents.graph.stream_pipeline(raw_input, location, preferences, on_node_start=push_to_queue)`。
  - `stream_pipeline` 在每个节点**开始前**通过 `on_node_start` 回调立即推送 `{ "type": "progress", "status": "starting", "agent": "<name>", "message": "..." }` 到 async 队列，前端可实时切换当前步骤；节点**完成后** yield `{ "type": "progress", "status": "done", "agent": "<name>", "duration_ms": <ms>, "message": "..." }`；最后 yield `{ "type": "result", "state": ... }`，Controller 将其转为 `{ "type": "result", "request", "results" }` 推送给前端。
  - 事件格式详见 `controller-frontend-contract.md` §2.1.2 与 `backend-analysis.md` §5.2。
  - （预留）若未来需要 `GET /api/requests/{id}/stream`，可复用上述事件格式或 7 阶段命名事件（`intent_parsed` → `completed`）。

---

### 2.2 查询某个 Request 状态 + 当前结果

**接口**

- 方法：`GET /api/requests/{request_id}`

**Controller 函数**

- 已有实现：`backend/app/api/requests.py#get_request`
- 职责：
  - 从 path 中拿到 `request_id`
  - 调用 service（例如 `marketplace.get_request` / `marketplace.get_offers`）查询 `StructuredRequest` + 当前 `Offer` 列表
  - 统一封装为 JSON 返回（可以直接返回字段结构与 `RankedOffersResponse` 对齐，或拆成 `request` + `offers`）

**需要调用的 Service 函数（建议）**

- `marketplace.get_request(request_id: str) -> dict`  
  - 返回字段结构等价于 `StructuredRequest`
- `marketplace.get_offers(request_id: str) -> list[dict]`  
  - 返回字段结构等价于 `Offer`（含 `score`、`score_breakdown`、`reasons`、`time_label` 等）
- （可选组合形式）`request_service.get_ranked_offers_response(request_id: str) -> RankedOffersResponse`

---

### 2.3 订阅某 Request 的结果流（SSE，预留能力）

> 当前代码库中尚未实现该 SSE 路由，保留为 V2 能力设计；若未来需要，可在 `requests_controller` 中新增对应接口并复用 `RankedOffersResponse` 作为事件负载。

**接口（建议）**

- 方法：`GET /api/requests/{request_id}/stream`

**Controller 函数（建议）**

- 函数名建议：`stream_request_results`
- 职责：
  - 验证 `request_id` 是否存在
  - 调用 service，返回 SSE 流

**需要调用的 Service 函数（建议）**

- `request_service.ensure_request_exists(request_id: str)`
- `orchestrator_service.attach_to_request_stream(request_id: str, emitter: SseEmitter)`
  - 按 `api-intelligent-local-bid.md` 中的 7 阶段事件格式推送（`intent_parsed` → `stores_crawled` → `transit_computed` → `reviews_fetched` → `scores_computed` → `recommendations_ready` → `completed`），事件负载中承载 `RankedOffersResponse` 或其子集

---

## 3. 地点详情 & 评论接口（Places）

### 3.1 获取地点详情（聚合 + 摘要）

**接口**

- 方法：`GET /api/places/{place_id}`
- 查询参数：
  - `request_id`（可选）
  - `rating_mode`（可选，前端可控切换评分分布来源）
    - `"apify_raw"`：使用 Apify 爬虫返回的原始评分直方图（来自 `reviewsPerRating` / `reviewsPerScore`）
    - `"review_pipeline"`：使用高级 review_analysis 管道基于最近一批已分析评论计算的评分分布

**Controller 函数**

- 已实现：`backend/app/api/places.py#get_place_detail`
- 职责：
  - 接收 `place_id`、`request_id`
  - 调用 `place_service.get_place_detail()` 获取原始数据
  - **转换为 `PlaceDetailResponse` 契约结构**：Controller 负责将 Service 返回的扁平化数据转换为前端期望的嵌套结构
  - 根据 `rating_mode` 选择评分分布来源，并返回 `{ request_id, detail: { place, review_summary, rating_distribution, ... } }`

**响应结构转换**

Controller 从 `place_service` 获取的原始数据结构：

```python
{
    "id": "...",
    "name": "...",
    "address": "...",
    "location": {...},
           "rating": 4.6,
           "review_count": 123,
           "price_range": "$10–20",
    "opening_hours": {"mon": "09:00-18:00", ...},
    "website_url": "...",
    "social_profiles": {...},
   "popular_times": {...},
   "images": ["url1", "url2", ...],  # 最多 4 张，来自 Apify 爬虫
   "review_summary": {...},
   # Apify / 原始评分直方图（来自爬虫 reviewsPerRating / reviewsPerScore）
   "review_distribution": {...},
   "review_distribution_apify": {...},
   # 高级 review_analysis 管道基于最近一批评论计算的评分分布（如已存在）
   "review_distribution_pipeline": {...} | null,
   "one_sentence_recommendation": "..."
}
```

Controller 转换为前端契约 `PlaceDetailResponse`：

```python
{
    "request_id": request_id,
    "detail": {
        "place": {
            "place_id": raw["id"],
            "name": raw["name"],
            "address": raw["address"],
            "phone": None,
            "website": raw["website_url"],
            "location": raw["location"],
           "rating": raw["rating"],
           "rating_count": raw["review_count"],
           "price_level": raw["price_range"],
            "status": _compute_status(raw["opening_hours"]),
            "opening_hours": _format_opening_hours(raw["opening_hours"]),
            "social_profiles": raw["social_profiles"],
            "popular_times": raw["popular_times"],
            "images": raw.get("images", []),
            "detailed_characteristics": None,
        },
        "review_summary": raw["review_summary"],
        # 评分分布选择逻辑：
        # - rating_mode="review_pipeline" 时优先使用 review_distribution_pipeline
        # - 否则（默认或 rating_mode="apify_raw"）使用 review_distribution_apify / review_distribution
        "rating_distribution": (
            raw.get("review_distribution_pipeline")
            if rating_mode == "review_pipeline"
            else (raw.get("review_distribution_apify") or raw.get("review_distribution"))
        ),
        "questions_and_answers": None,
        "customer_updates": None,
        "recommendation_reasons": [raw["one_sentence_recommendation"]] if raw.get("one_sentence_recommendation") else [],
    }
}
```

**辅助函数（Controller 层）**

 - `_price_range_to_level(price_range: str) -> str` — （内部可选）将价格字符串转换为 `"low" | "medium" | "high"` 等离散等级，用于评分；**不再直接暴露到 `price_level` 字段，前端收到的是原始价格字符串（例如 `"$10–20"` 或 `"CHF 30–60"`）。**
- `_compute_status(opening_hours: dict) -> str` — 根据当前时间和营业时间计算 `"open_now" | "closing_soon" | "closed"`
- `_format_opening_hours(opening_hours: dict) -> dict` — 格式化为 `{ today_open, today_close, is_open_now }`

**需要调用的 Service 函数**

- `place_service.get_place_detail(place_id: str, request_id: str | None) -> dict`
  - 内部由 Service 负责：
    - 优先从内存缓存读取（推荐流程后自动填充）
    - 缓存未命中时回退到 **Apify Google Maps scraper** 获取店铺详情
    - 返回中需包含 `images`：最多 4 张地点图片 URL 列表（Crawling Agent 在 Apify 中设置 `maxImages: 4`，`transform_apify_result` 从 `imageUrls` / `images[].imageUrl` 取前 4 条写入 provider，经 `cache_places` 与详情接口透传）
    - 评论聚合：从缓存的 reviews 列表生成 `advantages` / `disadvantages` 摘要
    - Transit 计算（如有用户位置）：基于 **Swiss Transit API（transport.opendata.ch）**
    - 生成 `one_sentence_recommendation`
- （可选）`request_service.append_place_view_log(request_id, place_id)`

---

### 3.2 获取地点原始评论（分页）

**接口**

- 方法：`GET /api/places/{place_id}/reviews`
- 查询参数：`page`、`page_size`、`sort`

**Controller 函数**

- 函数名建议：`list_place_reviews`
- 职责：
  - 解析分页和排序参数
  - 调用 service 获取评论 + 总数
  - 封装分页响应

**需要调用的 Service 函数**

- `place_service.list_reviews(place_id: str, page: int, page_size: int, sort: str) -> PagedReviews`
  - 返回字段参考 `api-intelligent-local-bid.md` 4.2

---

## 4. 个性化 & 用户画像接口（Profile / Users）

当前代码库已经提供了以 `UserPreferences`（见 `schemas.py`）为核心的用户偏好接口，路径为 `/api/users/me` 和 `/api/users/me/preferences`。  
如果后续需要更丰富的画像（persona、标签等），可以在此基础上再扩展 `/api/profile` 相关接口。

### 4.1 获取当前用户画像 + 偏好权重

**接口**

- 方法：`GET /api/users/me`

**Controller 函数**

- 已有实现：`backend/app/api/users.py#get_me`
- 职责：
  - 从 JWT / 认证中解析当前用户 ID
  - 调用 service 获取用户基础信息 + `UserPreferences`
  - 返回 JSON，至少包含：
    - `preferences: UserPreferences`（`weight_price` / `weight_distance` / `weight_rating`）

**需要调用的 Service 函数（建议）**

- `auth_service.get_current_user_id() -> str`
- `profile_service.get_or_create_user_preferences(user_id: str) -> UserPreferences`

---

### 4.2 更新用户偏好权重

**接口**

- 方法：`PUT /api/users/me/preferences`

**Controller 函数**

- 已有实现：`backend/app/api/users.py#update_preferences`
- 职责：
  - 从认证中取 `user_id`
  - 接收并校验请求体 `UserPreferences`
  - 调用 service 将偏好权重持久化到数据库
  - 返回更新后的 `UserPreferences`

**需要调用的 Service 函数（建议）**

- `auth_service.get_current_user_id() -> str`
- `profile_service.update_user_preferences(user_id: str, prefs: UserPreferences) -> UserPreferences`

> 若未来需要冷启动问卷（cold-start survey）或更复杂的画像结构，可以在此基础上新增：
> - `POST /api/profile/cold-start-survey`（payload 自定义）  
> - `GET/PUT /api/profile`（返回更丰富的 `profile` 对象），对应的 `UserProfile` / `ColdStartSurveyPayload` / `ProfileUpdatePayload` 可再在 `schemas.py` 中补充定义。

---

## 5. Provider 端 & 报价接口

本节同时覆盖 **Provider 列表/详情**（基于 `Provider` 模型）、**Provider 提交报价 `Offer`**（`SubmitOfferPayload` / `Offer`）、以及 **用户侧查看某 Request 的报价列表**。

### 5.1 Provider 列表 & 详情

**接口**

- 方法：`GET /api/providers`
  - 查询参数：`category`, `lat`, `lng`, `radius_km`（与 `providers.py` 保持一致）
- 方法：`GET /api/providers/{provider_id}`

**Controller 函数**

- 已有实现：`backend/app/api/providers.py#list_providers`
- 已有实现：`backend/app/api/providers.py#get_provider`
- 职责：
  - 解析可选的过滤参数（类别、位置、半径）
  - 调用 service 查询 Provider 列表或单个 Provider
  - 返回字段结构对齐 `Provider`（见 `schemas.py`），并可附加评论摘要、pros/cons 等衍生信息

**需要调用的 Service 函数（建议）**

- `provider_service.list_providers(category: str | None, lat: float | None, lng: float | None, radius_km: float) -> list[Provider]`
- `provider_service.get_provider(provider_id: str) -> Provider`
- （可选整合评论摘要）
  - `reviews_service.get_or_generate_summary(provider_id: str) -> dict`  
    - 可复用 `backend/app/services/reviews.py#get_or_generate_summary`

---

### 5.2 Provider：提交报价 Offer

**接口**

- 方法：`POST /api/offers`

**Controller 函数**

- 已有实现：`backend/app/api/offers.py#submit_offer`
- 职责：
  - 从认证中获取 `provider_id`
  - 接收并校验请求体 `SubmitOfferPayload`
  - 调用 service 创建一条新的 `Offer` 记录
  - 触发 Realtime / SSE 通知（例如 Supabase Realtime channel `request:{request_id}`）
  - 返回创建好的 `Offer`

**需要调用的 Service 函数（建议）**

- `auth_service.get_current_provider_id() -> str`
- `request_service.ensure_request_exists(request_id: str)`
- `offer_service.submit_offer(payload: SubmitOfferPayload) -> Offer`
  - 内部负责写 DB、触发 Realtime 通知（PRD 6.2）

---

### 5.3 用户端：查看某 Request 的 Offer 列表

**接口**

- 方法：`GET /api/requests/{request_id}/offers`

**Controller 函数**

- 已有实现：`backend/app/api/requests.py#get_offers`
- 职责：
  - 校验 `request_id`
  - 调用 service 获取指定 `request_id` 下的 `Offer` 列表（已按 `score` 降序）
  - 返回 `request_id + offers`，其中 `offers` 字段结构对齐 `Offer`

**需要调用的 Service 函数（建议）**

- `marketplace.get_offers(request_id: str) -> list[dict]`（字段结构等价于 `Offer`）
- （可选排序/个性化）`ranking.rank_offers(providers: list[dict], prefs: UserPreferences | None) -> list[dict]`

---

### 5.4 Offer 实时更新 SSE（预留能力）

> 当前代码库中尚未实现 Offer SSE 路由，保留为 V2 能力设计。

**接口（建议）**

- 方法：`GET /api/requests/{request_id}/offers/stream`

**Controller 函数（建议）**

- 函数名建议：`stream_offers_for_request`
- 职责：
  - 校验 `request_id`
  - 调用 service 建立 SSE 通道
  - 按 `offer_created` / `offer_updated` 等事件推送 `Offer` 列表或增量更新

**需要调用的 Service 函数（建议）**

- `offer_service.attach_offer_stream(request_id: str, emitter: SseEmitter)`
  - 内部监听新的 Offer 或状态变化并推送（PRD 6.2）

---

### 5.5 Provider：查询附近 Request 列表（V2 预留）

> PRD 中的 V1.5 / V2 能力：Provider 端直接浏览附近的未关闭 `StructuredRequest` 列表。  
> 目前代码库尚未实现对应路由，可在未来扩展时参考下述设计。

**接口（建议）**

- 方法：`GET /api/providers/requests`
- 查询参数：`lat`, `lng`, `radius_km`, `service_category`

**Controller 函数（建议）**

- 函数名建议：`list_nearby_requests_for_provider`
- 职责：
  - 验证 Provider 身份（如有登录）
  - 校验经纬度参数
  - 调用 service 查询匹配的 `StructuredRequest` 列表

**需要调用的 Service 函数（建议）**

- `auth_service.get_current_provider_id() -> str`
- `provider_service.list_nearby_requests(provider_id: str, lat: float, lng: float, radius_km: float, service_category: str | None) -> list[dict]`
  - 返回字段结构可参考 `StructuredRequest`，也可在未来在 `schemas.py` 中增加 `ProviderRequestSummary` 进行封装

---

## 6. Debug / Trace 接口

### 6.1 获取某次调用的 Agent Trace

当前路由已经在 `backend/app/api/requests.py` 中以  
`GET /api/requests/{request_id}/trace` 的形式预留。

**接口**

- 方法：`GET /api/requests/{request_id}/trace`

**Controller 函数**

- 已有实现：`backend/app/api/requests.py#get_trace`
- 职责：
  - 解析 `request_id`
  - 调用 service 获取该请求对应的 `AgentTrace`
  - 返回 JSON，字段结构按 `schemas.AgentTrace` 与 `api-intelligent-local-bid.md` 7.1 对齐

**需要调用的 Service / 工具函数（建议）**

- `trace_service.get_trace(request_id: str) -> AgentTrace`
  - 内部从存储或日志系统读取 DAG 节点、步骤信息等
  - DAG 包含 8 个节点：`input_agent`、`crawling_agent_search`、`crawling_agent_transit`、`evaluation_agent`、`review_agent`、`orchestrator_agent`、`output_agent_ranking`、`output_agent_recommendation`
- 在 Agent 执行阶段可复用现有工具：
  - `agents.trace.make_trace(request_id: str) -> dict`（创建空 `AgentTrace` 结构）
  - `agents.trace.add_step(trace: dict, agent: str, input_data: dict, output_data: dict, start_ms: float) -> dict`

---

## 7. 隐私与数据使用接口

### 7.1 获取隐私说明

**接口**

- 方法：`GET /api/meta/privacy`

**Controller 函数**

- 函数名建议：`get_privacy_meta`
- 职责：
  - 直接调用 service 拉取静态/配置化的隐私说明
  - 返回 `permissions` / `data_collected` / `data_not_collected` 列表

**需要调用的 Service 函数**

- `meta_service.get_privacy_meta() -> PrivacyMeta`
  - 可以从配置文件或数据库读取，便于未来修改

---

## 8. 设备级位置同步接口（Location）

### 8.1 更新 / 查询当前设备位置

**接口**

- 方法：`PUT /api/location/current`
  - 查询参数：`device_id: str`（必填，设备/会话 ID）
  - 请求体：`DeviceLocationPayload`
    - 字段：`lat: float`、`lng: float`、`accuracy_m: float | None`、`timestamp: datetime | None`
- 方法：`GET /api/location/current`
  - 查询参数：`device_id: str`（必填）

**Controller 函数**

- 模块：`backend/app/api/location.py`
- 函数名建议：
  - `put_current_location`
  - `get_current_location`
- 职责：
  - 解析 `device_id` 查询参数（缺失时返回 `400`）
  - 使用 Pydantic 校验请求体（`DeviceLocationPayload`）
  - 调用 service 层保存 / 读取对应设备的最新位置
  - 按 `DeviceLocation` 模型返回 JSON

**需要调用的 Service 函数**

- Service 模块：`location_service`
  - `save_device_location(device_id: str, payload: DeviceLocationPayload) -> DeviceLocation`
    - 负责 upsert 设备当前地点，设置服务端 `updated_at`
  - `get_device_location(device_id: str) -> DeviceLocation | None`
    - 返回当前记录的设备位置，若不存在则返回 `None`

> 说明：
> - MVP 实现可以使用进程内存（`InMemory`）存储，为未来迁移到 Redis / 数据库预留实现空间；
> - 当前版本中，`requests_controller` 仍然显式依赖请求体中的 `location: LatLng`，不会隐式从 `location_service` 读取，以保持搜索契约简单、可预测。

---

## 9. 小结：Controller 负责人需要对齐的 Service 套件

结合当前 `schemas.py` 与 `backend/app` 目录中已有/预期的实现，从你视角，需要其他两位同学提供的 Service 包大致包括（名称可协商，但职责要清晰）：

- `intent_service`
  - `parse_natural_query(query: str, language: str) -> Intent`
- `request_service`
  - `create_request(payload: CreateRequestPayload, user_id: str | None) -> StructuredRequest`
  - `get_ranked_offers_response(request_id: str) -> RankedOffersResponse`（可选封装）
  - `ensure_request_exists(request_id: str) -> None`
- `marketplace`（与 DB 交互，已在 `services/marketplace.py` 中预留）
  - `persist_request(request: StructuredRequest) -> str`
  - `persist_offers(offers: list[Offer]) -> None`
  - `get_request(request_id: str) -> dict`（字段结构等价于 `StructuredRequest`）
  - `get_offers(request_id: str) -> list[dict]`（字段结构等价于 `Offer`）
  - `close_request(request_id: str) -> None`
- `orchestrator_service` / `agents.graph`（6-Agent DAG 编排）
  - `run_recommendation_pipeline(payload: CreateRequestPayload) -> RankedOffersResponse`
    - 内部调度：Input Agent → Crawling Agent（Sub-1 Apify + Sub-2 Swiss Transit）→ Evaluation Agent / Review Agent → Orchestrator Agent → Output Agent
  - （未来）`start_recommendation_stream(...)`
  - （未来）`attach_to_request_stream(...)`
- `crawling_service`（Crawling Agent 的外部 API 封装）
  - `search_stores_apify(query: str, location: LatLng, radius_km: float) -> list[dict]` — 调用 Apify Google Maps scraper，返回店铺列表（含营业时间），过滤不匹配时间窗口的店铺
  - `compute_transit(origin: LatLng, destinations: list[LatLng]) -> list[TransitInfo]` — 调用 Swiss Transit API（transport.opendata.ch），返回每个目的地的公共交通 ETA（duration_minutes、transport_types、departure_time、connections）
- `ranking` / `evaluation_service`（Evaluation Agent）
  - `normalise(...)`
  - `score_offer(...)`
  - `rank_offers(providers: list[dict], prefs: UserPreferences | None = None) -> list[dict]`
- `place_service`
  - `get_place_detail(place_id: str, request_id: str | None) -> dict`
    - 返回原始扁平化数据，由 Controller 层转换为 `PlaceDetailResponse` 契约结构
  - `list_reviews(place_id: str, page: int, page_size: int, sort: str) -> PagedReviews`
  - `cache_places(providers: list[dict]) -> None`
  - **当前 MVP 实现**：`PlaceService`（`backend/app/services/place_service.py`）
    - 混合方式：优先从内存缓存读取（推荐流程后自动填充），缓存未命中时回退到 Apify 抓取
    - Transit 通过 `transport.opendata.ch` 计算公共交通 ETA
    - 评论摘要从缓存的 reviews 列表生成
    - **注意**：Service 返回扁平化 dict，Controller 负责转换为前端契约结构
- `reviews_service`（Review Agent — Apify 评论抓取 + LLM 摘要）
  - `fetch_reviews_apify(place_ids: list[str]) -> dict[str, list[dict]]` — 批量抓取所有候选店铺的评论
  - `summarise_reviews(provider_id: str, reviews: list[dict]) -> dict` — LLM 生成 advantages / disadvantages 摘要
  - `get_or_generate_summary(provider_id: str, reviews: list[dict]) -> dict`
- `profile_service`
  - `get_or_create_user_preferences(user_id: str) -> UserPreferences`
  - `update_user_preferences(user_id: str, prefs: UserPreferences) -> UserPreferences`
  - **当前 MVP 实现**：`InMemoryProfileService`（`backend/app/services/profile_service.py`）
    - 使用进程内存存储用户偏好，应用重启后丢失
    - 生产环境可替换为 Supabase 持久化存储
- `offer_service`
  - `submit_offer(payload: SubmitOfferPayload) -> Offer`
  - `attach_offer_stream(request_id: str, emitter: SseEmitter)`（可选，SSE）
- `provider_service`
  - `list_providers(...) -> list[Provider]`
  - `get_provider(provider_id: str) -> Provider`
  - `list_nearby_requests(...)`（V2，可选）
- `trace_service`
  - `get_trace(request_id: str) -> AgentTrace`
- `meta_service`
  - `get_privacy_meta() -> PrivacyMeta`（未来可在 `schemas.py` 中增加）
- `location_service`
  - `save_device_location(device_id: str, payload: DeviceLocationPayload) -> DeviceLocation`
  - `get_device_location(device_id: str) -> DeviceLocation | None`
- `auth_service`（横切关注）
  - `get_current_user_id() -> str | None`
  - `get_current_provider_id() -> str | None`
  - **当前 MVP 实现**：`AnonymousAuthService`（`backend/app/services/auth_service.py`）
    - 返回固定的 `"anonymous"` 用户 ID，不执行实际认证
    - 生产环境可替换为 Supabase Auth 或其他认证服务
- `sse_service`（若你们想让 SSE 封装在 Service 侧）
  - `build_response(generator) -> StreamingResponse` 等

你只需要在 Controller 中调用这些函数，负责：

- 参数解析与校验；
- HTTP 状态码和响应格式；
- 与前端约定的 JSON 结构、`StructuredRequest` / `Provider` / `Offer` / `AgentTrace` 等实体的序列化，以及 SSE 事件类型。

