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

下面逐个接口说明 Controller 需要的函数，以及需要调用哪些 Service 函数（由其他两位同学实现）。

---

## 2. 搜索 & 推荐接口（Requests）

### 2.1 创建搜索请求（支持流式返回）

**接口**

- 方法：`POST /api/requests`
- 用途：前端输入自然语言查询后，创建 `StructuredRequest`，并触发 Multi‑Agent 推荐 / 报价排序流程。  
  - `stream=false` 或缺省：一次性返回结果  
  - `stream=true` 或 SSE：流式推送结果
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
    - 触发整个 Multi‑Agent DAG，返回排好序的 `offers` + `request` + 可选 `trace`（PRD 4.1.2 / 4.1.4 / 4.1.5）
- 流式模式（SSE）时：
  - `orchestrator_service.start_recommendation_stream(request_id: str, emitter: SseEmitter)`
    - 流式发送 `request_created` / `partial_results` / `completed` 事件，每个事件负载中包含当前 `RankedOffersResponse` 或其中的子集（API 文档 3.1）
  - （可选）`sse_service.build_response(generator) -> StreamingResponse`
    - 封装 FastAPI 层的 SSE 响应

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
  - 按 `api-intelligent-local-bid.md` 中的事件格式推送，事件负载中承载 `RankedOffersResponse` 或其子集（如当前 `offers` + `trace` 片段）

---

## 3. 地点详情 & 评论接口（Places）

### 3.1 获取地点详情（聚合 + 摘要）

**接口**

- 方法：`GET /api/places/{place_id}`
- 查询参数：`request_id`（可选）

**Controller 函数**

- 函数名建议：`get_place_detail`
- 职责：
  - 接收 `place_id`、`request_id`
  - 调用 service 拉取聚合详情（基础信息 + 评论摘要 + 打分分布 + 推荐理由）
  - 将 `request_id` 一并返回给前端

**需要调用的 Service 函数**

- `place_service.get_place_detail(place_id: str, request_id: str | None) -> PlaceDetail`
  - 内部由 Service 负责：
    - 调用 Google Places Details / Reviews
    - 评论聚合（PRD 4.1.3）
    - 实时营业状态与可达性（PRD 4.1.4）
    - 生成 `recommendation_reasons`（PRD 4.3.4）
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

## 8. 小结：Controller 负责人需要对齐的 Service 套件

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
- `orchestrator_service` / `agents.graph`
  - `run_recommendation_pipeline(payload: CreateRequestPayload) -> RankedOffersResponse`
  - （未来）`start_recommendation_stream(...)`
  - （未来）`attach_to_request_stream(...)`
- `ranking`（已在 `services/ranking.py` 预留）
  - `normalise(...)`
  - `score_offer(...)`
  - `rank_offers(providers: list[dict], prefs: UserPreferences | None = None) -> list[dict]`
- `place_service`（未实现，设计阶段）
  - `get_place_detail(...) -> PlaceDetail`
  - `list_reviews(...) -> PagedReviews`
- `reviews_service`（已在 `services/reviews.py` 预留）
  - `summarise_reviews(provider_id: str, reviews: list[dict]) -> dict`
  - `get_or_generate_summary(provider_id: str, reviews: list[dict]) -> dict`
- `profile_service`
  - `get_or_create_user_preferences(user_id: str) -> UserPreferences`
  - `update_user_preferences(user_id: str, prefs: UserPreferences) -> UserPreferences`
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
- `auth_service`（横切关注）
  - `get_current_user_id() -> str | None`
  - `get_current_provider_id() -> str | None`
- `sse_service`（若你们想让 SSE 封装在 Service 侧）
  - `build_response(generator) -> StreamingResponse` 等

你只需要在 Controller 中调用这些函数，负责：

- 参数解析与校验；
- HTTP 状态码和响应格式；
- 与前端约定的 JSON 结构、`StructuredRequest` / `Provider` / `Offer` / `AgentTrace` 等实体的序列化，以及 SSE 事件类型。

