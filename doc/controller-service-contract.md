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
- 用途：前端输入自然语言查询后，创建 Request，并触发 Multi‑Agent 推荐流程。  
  - `stream=false` 或缺省：一次性返回结果  
  - `stream=true` 或 SSE：流式推送结果

**Controller 函数（你负责）**

- 函数名建议：`create_request`
- 职责：
  - 校验请求体（query、location、language、stream）
  - 获取当前用户（如有登录）：可通过 `auth_service`
  - 调用服务层：创建 Request、启动推荐流程
  - 根据 `stream` 决定返回 JSON 还是返回 SSE 流

**需要调用的 Service 函数（由其他人实现）**

- `intent_service.parse_natural_query(query: str, language: str) -> Intent`
  - 自然语言 → 结构化意图 JSON（PRD 4.1.1）
- `request_service.create_request(user_id: str | None, intent: Intent, location: Location) -> Request`
  - 创建并持久化一条 Request 记录（PRD 4.1.0）
- 非流式模式时：
  - `orchestrator_service.run_recommendation_pipeline(request_id: str) -> list[PlaceSummary]`
    - 触发整个 Multi‑Agent DAG，返回 Top N 结果（PRD 4.1.2 / 4.1.4 / 4.1.5）
- 流式模式（SSE）时：
  - `orchestrator_service.start_recommendation_stream(request_id: str, emitter: SseEmitter)`
    - 流式发送 `request_created` / `partial_results` / `completed` 事件（API 文档 3.1）
  - （可选）`sse_service.build_response(generator) -> StreamingResponse`
    - 封装 FastAPI 层的 SSE 响应

---

### 2.2 查询某个 Request 状态 + 当前结果

**接口**

- 方法：`GET /api/requests/{request_id}`

**Controller 函数**

- 函数名建议：`get_request`
- 职责：
  - 从 path 中拿到 `request_id`
  - 调用 service 查询 Request + 当前 PlaceSummary 列表
  - 返回统一格式的 JSON

**需要调用的 Service 函数**

- `request_service.get_request(request_id: str) -> Request | None`
- `request_service.get_request_results(request_id: str) -> list[PlaceSummary]`
  - 或组合形式：`request_service.get_request_with_results(request_id) -> (Request, list[PlaceSummary])`

---

### 2.3 订阅某 Request 的结果流（SSE）

**接口**

- 方法：`GET /api/requests/{request_id}/stream`

**Controller 函数**

- 函数名建议：`stream_request_results`
- 职责：
  - 验证 `request_id` 是否存在
  - 调用 service，返回 SSE 流

**需要调用的 Service 函数**

- `request_service.ensure_request_exists(request_id: str)`
- `orchestrator_service.attach_to_request_stream(request_id: str, emitter: SseEmitter)`
  - 按 `api-intelligent-local-bid.md` 中的事件格式推送

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

根据现有 `backend/app/api/users.py` 的注释，可以两种做法：

- 继续用 `/api/users/me`、`/api/users/me/preferences`；  
- 或新增符合 API 设计文档的 `/api/profile`、`/api/profile/cold-start-survey`。  

下方按 API 文档定义 controller 函数，具体落在哪个 router 由你们团队协商。

### 4.1 冷启动问卷提交

**接口**

- 方法：`POST /api/profile/cold-start-survey`

**Controller 函数**

- 函数名建议：`submit_cold_start_survey`
- 职责：
  - 获取当前用户 ID（如有登录）
  - 校验问卷字段
  - 调用 service 保存/更新 UserProfile
  - 返回最新 `profile`

**需要调用的 Service 函数**

- `auth_service.get_current_user_id() -> str | None`
- `profile_service.submit_cold_start_survey(user_id: str | None, payload: ColdStartSurveyPayload) -> UserProfile`

---

### 4.2 获取 / 更新用户画像与权重

**接口**

- `GET  /api/profile`
- `PUT  /api/profile`

**Controller 函数**

- `get_profile`
  - 从认证中取 `user_id`
  - 调用 service 获取 UserProfile
- `update_profile`
  - 接收部分更新字段（如 persona、weights）
  - 调用 service 进行部分更新
  - 返回更新后的 `profile`

**需要调用的 Service 函数**

- `profile_service.get_profile(user_id: str) -> UserProfile | None`
- `profile_service.update_profile(user_id: str, update: ProfileUpdatePayload) -> UserProfile`

---

## 5. Provider 端 & 报价接口（V2）

> 这一块在 PRD 中是 V1.5 / V2 能力，你可以先把 Controller 签名和依赖 Service 函数写好，真正实现可以后置。

### 5.1 Provider：查询附近 Request 列表

**接口**

- 方法：`GET /api/providers/requests`
- 查询参数：`lat`, `lng`, `radius_km`, `service_category`

**Controller 函数**

- 函数名建议：`list_nearby_requests_for_provider`
- 职责：
  - 验证 Provider 身份（如有登录）
  - 校验经纬度参数
  - 调用 service 查询匹配的 Request 列表

**需要调用的 Service 函数**

- `auth_service.get_current_provider_id() -> str`
- `provider_service.list_nearby_requests(provider_id: str, lat: float, lng: float, radius_km: float, service_category: str | None) -> list[ProviderRequestSummary]`

---

### 5.2 Provider：对某 Request 提交 Offer

**接口**

- 方法：`POST /api/requests/{request_id}/offers`

**Controller 函数**

- 函数名建议：`submit_offer_for_request`
- 职责：
  - 获取 `provider_id`（认证）
  - 校验 `request_id`
  - 校验报价 payload
  - 调用 service 创建 Offer
  - 返回 `offer`

**需要调用的 Service 函数**

- `auth_service.get_current_provider_id() -> str`
- `request_service.ensure_request_exists(request_id: str)`
- `offer_service.create_offer(request_id: str, provider_id: str, payload: CreateOfferPayload) -> Offer`
  - 内部负责写 DB、触发 Realtime/SSE 通知（PRD 6.2）

---

### 5.3 用户端：查看某 Request 的 Offer 列表

**接口**

- 方法：`GET /api/requests/{request_id}/offers`

**Controller 函数**

- 函数名建议：`list_offers_for_request`
- 职责：
  - 校验 `request_id`
  - 调用 service 获取 Offer 列表
  - 返回 `request_id + offers`

**需要调用的 Service 函数**

- `offer_service.list_offers(request_id: str) -> list[Offer]`
- （可选排序）`offer_service.sort_offers_for_user(request_id: str, user_id: str | None) -> list[Offer]`

---

### 5.4 Offer 实时更新 SSE

**接口**

- 方法：`GET /api/requests/{request_id}/offers/stream`

**Controller 函数**

- 函数名建议：`stream_offers_for_request`
- 职责：
  - 校验 `request_id`
  - 调用 service 建立 SSE 通道
  - 按 `offer_created` / `offer_updated` 事件推送

**需要调用的 Service 函数**

- `offer_service.attach_offer_stream(request_id: str, emitter: SseEmitter)`
  - 内部监听新的 Offer 或状态变化并推送（PRD 6.2）

---

## 6. Debug / Trace 接口

### 6.1 获取某次调用的 Agent Trace

**接口**

- 方法：`GET /api/traces/{trace_id}`

**Controller 函数**

- 函数名建议：`get_trace`
- 职责：
  - 解析 `trace_id`
  - 调用 service 获取 trace 详情
  - 返回 JSON，字段结构按 `api-intelligent-local-bid.md` 7.1

**需要调用的 Service 函数**

- `trace_service.get_trace(trace_id: str) -> Trace`
  - 内部从存储或日志系统读取 DAG 节点、步骤信息等

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

从你视角，需要其他两位同学提供的 Service 包大致包括（名称可协商，但职责要清晰）：

- `intent_service`
  - `parse_natural_query(...)`
- `request_service`
  - `create_request(...)`
  - `get_request(...)`
  - `get_request_results(...)`
  - `get_request_with_results(...)`
  - `ensure_request_exists(...)`
- `orchestrator_service`
  - `run_recommendation_pipeline(...)`
  - `start_recommendation_stream(...)`
  - `attach_to_request_stream(...)`
- `place_service`
  - `get_place_detail(...)`
  - `list_reviews(...)`
- `profile_service`
  - `submit_cold_start_survey(...)`
  - `get_profile(...)`
  - `update_profile(...)`
- `offer_service`
  - `create_offer(...)`
  - `list_offers(...)`
  - `sort_offers_for_user(...)`（可选）
  - `attach_offer_stream(...)`
- `provider_service`
  - `list_nearby_requests(...)`
- `trace_service`
  - `get_trace(...)`
- `meta_service`
  - `get_privacy_meta(...)`
- `auth_service`（横切关注）
  - `get_current_user_id()`
  - `get_current_provider_id()`
- `sse_service`（若你们想让 SSE 封装在 Service 侧）
  - `build_response(generator)` 等

你只需要在 Controller 中调用这些函数，负责：

- 参数解析与校验；
- HTTP 状态码和响应格式；
- 与前端约定的 JSON 结构和 SSE 事件类型。

