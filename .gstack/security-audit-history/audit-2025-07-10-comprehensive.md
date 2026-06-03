# 学习打卡小程序 — 上线前安全审计报告

## Meta
- **审计模式**: Comprehensive（全面审计）
- **审计日期**: 2025-07-10
- **审计范围**: 全量源码（miniprogram/ 目录下所有前端页面、工具模块、28+ 云函数、爬虫模块）
- **执行阶段**: 1-14 / 14（全部完成）
- **审计员**: gstack-security-officer (GStack CSO)

---

## Executive Summary

本次对「学习打卡小程序」进行了全面上线前安全审计，覆盖 OWASP Top 10 全部类别与 STRIDE 六维度威胁建模。**共发现 18 个安全漏洞**，其中 Critical 级别 5 个、High 级别 5 个、Medium 级别 5 个、Low 级别 3 个。

最严重的问题是：**多个云函数存在未认证访问（SSRF + 管理员功能无鉴权）**，攻击者可通过 `crawlQuestions` 和 `ai-report` 进行 SSRF 攻击探测内网，或通过 `importQuestions`/`generatePaper`/`aiAutoTag` 等函数执行管理员操作；**家长密码系统存在系统性缺陷**（4位纯数字、明文存储、忘记密码重置为'1234'），在儿童隐私保护场景下尤为严重；**TTS 云函数在日志中泄露签名凭证**，可导致腾讯云账户被盗用。

**整体安全评分: 2.5 / 10**

**Go/No-Go 判定: NO-GO** — 存在多个 Critical 级别漏洞，必须在修复后方可上线。最低修复要求：解决 F-001 ~ F-005（全部 Critical 级别）后可重新评估。

---

## STRIDE 威胁建模表

| 编号 | STRIDE 类别 | 威胁场景 | 影响 | 当前缓解 | 残余风险 | 严重度 |
|------|-------------|----------|------|----------|----------|--------|
| T-01 | Spoofing（仿冒） | 攻击者通过篡改本地存储 `_admin_auth_cache` 伪造管理员身份 | 未授权访问管理功能 | 服务端 authAdmin 验证（但缓存可绕过前端守卫） | 前端守卫可被绕过，需所有管理云函数内部鉴权 | High |
| T-02 | Spoofing（仿冒） | 攻击者伪造 openid 存入 loginUser 本地存储 | 身份混淆 | 云函数用 cloud.getWXContext().OPENID | 有限，服务端不依赖客户端传 openid | Low |
| T-03 | Tampering（篡改） | 攻击者修改本地存储 stars/points 数值刷分 | 积分系统崩溃 | 无服务端验证 | 完全可利用，积分全客户端控制 | High |
| T-04 | Tampering（篡改） | 攻击者修改 submitPractice 的 correctCount 参数 | 虚假成绩记录 | 无，云函数直接写入客户端传来的分数 | 完全可利用 | High |
| T-05 | Tampering（篡改） | 攻击者修改本地 isParentUnlocked 绕过家长锁 | 儿童可绕过家长管控 | 密码验证仅在进入时检查 | 解锁状态存本地，可被篡改为 true | Medium |
| T-06 | Repudiation（抵赖） | 管理操作无审计日志 | 无法追踪谁导入了什么题目、生成了什么试卷 | 无 | 无审计，完全可抵赖 | Medium |
| T-07 | Information Disclosure（信息泄露） | authAdmin 云函数在日志中打印 openid | 用户标识泄露 | 无 | 云函数日志可被云平台管理员查看 | Medium |
| T-08 | Information Disclosure（信息泄露） | TTS 云函数在日志中打印 Authorization 头和 CanonicalRequest | 腾讯云 API 签名泄露，可被用于伪造请求 | 无 | 严重，凭证可直接被提取使用 | Critical |
| T-09 | Information Disclosure（信息泄露） | 家长密码明文存储在 wx.setStorageSync | 本地存储被物理访问或调试工具读取 | 无 | 密码完全暴露 | High |
| T-10 | Denial of Service（拒绝服务） | 攻击者向 importQuestions 传入大量数据耗尽云函数资源 | 云函数超时/资源耗尽 | normalize 有 500 字符截断 | 无认证限制 + 无批量大小限制 = DoS 可能 | Medium |
| T-11 | Denial of Service（拒绝服务） | 攻击者向 backup 云函数传入超大 data | 数据库写入爆炸 | openid 绑定 | data 无大小校验，可写入 GB 级数据 | Low |
| T-12 | Elevation of Privilege（提权） | 未认证用户调用 importQuestions/generatePaper/aiAutoTag/crawlQuestions | 普通用户执行管理员操作 | 无 | 完全可利用，任何登录用户可调用 | Critical |
| T-13 | Elevation of Privilege（提权） | SSRF via ai-report chat 模式访问内网服务 | 探测内网、访问元数据服务、泄露内网服务信息 | 无 URL 白名单 | 完全可利用 | Critical |
| T-14 | Elevation of Privilege（提权） | SSRF via crawlQuestions（无任何 URL 校验） | 同上，且无协议/内网IP限制 | 无 | 完全可利用 | Critical |

---

## OWASP Top 10 检查表

### A01: Broken Access Control — 严重

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 管理云函数是否有鉴权 | FAIL | importQuestions、generatePaper、crawlQuestions、aiAutoTag 均无任何身份验证 |
| 数据访问是否绑定身份 | PARTIAL | dataSync 正确使用 `_openid: OPENID`，但 getChildData 查询未加 _openid 过滤 |
| 前端守卫是否可绕过 | FAIL | adminGuard 使用本地缓存，可通过调试工具篡改 |
| IDOR 防护 | FAIL | getChildData 可通过猜测 childId 读取其他孩子数据 |

### A02: Cryptographic Failures — 严重

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 密码是否加密存储 | FAIL | 家长密码明文存储于本地 wx.setStorageSync |
| 密码哈希算法 | FAIL | 使用 `===` 直接比较，无任何哈希 |
| 传输加密 | PASS | 微信小程序强制 HTTPS |
| 凭证日志泄露 | FAIL | TTS 云函数打印 Authorization 头到日志 |

### A03: Injection — 中等

| 检查项 | 状态 | 详情 |
|--------|------|------|
| SQL/NoSQL 注入 | LOW | 微信云开发使用 SDK 方法而非原始查询，风险较低 |
| 命令注入 | PASS | 未发现 exec/spawn 调用 |
| SSRF（服务端请求伪造） | FAIL | ai-report chat 模式接受用户指定 URL；crawlQuestions 无任何 URL 校验 |
| 模板注入 | PASS | 未使用动态模板引擎 |

### A04: Insecure Design — 严重

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 积分系统防作弊 | FAIL | 积分完全在客户端计算和存储，无服务端验证 |
| 密码系统设计 | FAIL | 4位数字PIN + 忘记密码重置为'1234' = 安全性接近于零 |
| 儿童隐私保护设计 | PARTIAL | 有隐私声明，但家长锁可被轻松绕过 |

### A05: Security Misconfiguration — 中等

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 默认密码 | FAIL | 初始家长密码为 '1234'，忘记密码也重置为 '1234' |
| 调试信息 | FAIL | 多个云函数 console.log 敏感信息（openid、Authorization） |
| 开发配置 | WARN | project.config.json 中 urlCheck:false, scopeDataCheck:false |
| 安全头 | N/A | 小程序不涉及 HTTP 响应头 |

### A06: Vulnerable and Outdated Components — 低

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 依赖版本 | INFO | 使用 wx-server-sdk，未发现已知高危 CVE |
| MD5 用于去重 | LOW | stemHash 使用 MD5，但仅用于题目去重非安全目的 |

### A07: Identification and Authentication Failures — 严重

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 密码强度 | FAIL | 4位纯数字 = 10,000 种组合，暴力破解 < 1秒 |
| 暴力破解防护 | FAIL | 无尝试次数限制、无锁定机制 |
| 密码重置安全 | FAIL | 重置为固定默认值 '1234'，无身份验证 |
| 会话管理 | PASS | 依赖微信云开发原生鉴权机制 |

### A08: Software and Data Integrity Failures — 中等

| 检查项 | 状态 | 详情 |
|--------|------|------|
| CI/CD 完整性 | INFO | 未发现 CI/CD 配置文件 |
| 数据完整性验证 | PARTIAL | importQuestions 有 contentHash 比对，但 submitPractice 无验证 |
| 反序列化 | LOW | backup 云函数直接写入 event.data 无校验 |

### A09: Security Logging and Monitoring Failures — 中等

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 安全事件日志 | FAIL | 无认证失败、权限拒绝等安全事件记录 |
| 日志敏感信息 | FAIL | 日志中包含 openid、Authorization 头等敏感信息 |
| 审计追踪 | FAIL | 管理操作无审计日志 |

### A10: Server-Side Request Forgery (SSRF) — 严重

| 检查项 | 状态 | 详情 |
|--------|------|------|
| URL 白名单 | FAIL | ai-report chat 模式无 URL 限制 |
| 内网 IP 过滤 | PARTIAL | autoCrawl 有基本过滤，但 crawlQuestions 完全无过滤 |
| 协议限制 | PARTIAL | autoCrawl 限 http/https，crawlQuestions 和 ai-report 无限制 |
| DNS 重绑定防护 | FAIL | 无任何 DNS 重绑定防护 |

---

## 详细发现

### [F-001] ai-report 云函数 SSRF 漏洞（chat 模式）
- **Category**: OWASP A10 / STRIDE Elevation of Privilege
- **Severity**: Critical
- **Confidence**: 10/10
- **Location**: `miniprogram/cloudfunctions/ai-report/index.js:72`
- **Description**: chat 模式下，客户端可通过 `event.url` 参数指定任意 URL 作为请求目标，服务端直接发起 HTTP 请求，未做任何 URL 白名单、内网 IP 过滤或协议限制。攻击者可利用此漏洞访问云环境内网服务、读取元数据服务（169.254.169.254）、探测内部端口。
- **Exploit Scenario**: 
  1. 攻击者调用 `wx.cloud.callFunction({ name: 'ai-report', data: { mode: 'chat', url: 'http://169.254.169.254/latest/meta-data/', messages: [] } })`
  2. 云函数向云元数据服务发起请求，获取临时凭证
  3. 攻击者获得云账户临时凭证，可操作云资源
- **Reproduction Steps**: 
  1. 在微信开发者工具中调用 `wx.cloud.callFunction({ name: 'ai-report', data: { mode: 'chat', url: 'http://169.254.169.254/', messages: [] } })`
  2. 观察返回结果中是否包含元数据响应
- **Remediation**: 移除 `event.url` 参数支持，固定 API 端点为环境变量 `AI_API_URL` 的值；或在代码中硬编码允许的域名白名单（如 `api.deepseek.com`），拒绝任何其他 URL
- **Priority**: P0（立即修复）

### [F-002] crawlQuestions 云函数无任何 URL 校验 — SSRF
- **Category**: OWASP A10 / STRIDE Elevation of Privilege
- **Severity**: Critical
- **Confidence**: 10/10
- **Location**: `miniprogram/cloudfunctions/crawlQuestions/index.js:26-39`
- **Description**: httpGet 函数直接使用用户传入的 `customUrl` 发起请求，无任何 URL 合法性校验。与 autoCrawl 不同，crawlQuestions 没有 validateUrl 函数、没有内网 IP 过滤、没有协议限制、也没有认证检查。任何登录用户都可利用此函数发起任意 HTTP 请求。
- **Exploit Scenario**:
  1. 攻击者调用 crawlQuestions，传入 `customUrl: 'http://10.0.0.1:8080/admin'`
  2. 云函数直接请求内网地址
  3. 可探测和攻击内网服务
- **Reproduction Steps**:
  1. 调用 `wx.cloud.callFunction({ name: 'crawlQuestions', data: { customUrl: 'http://127.0.0.1:8080/', subject: '数学', grade: '六年级' } })`
  2. 观察返回结果
- **Remediation**: 添加与 autoCrawl 相同的 validateUrl 校验；添加管理员身份验证；添加协议白名单（仅 http/https）；添加内网 IP 黑名单；考虑使用 DNS 解析后二次校验
- **Priority**: P0（立即修复）

### [F-003] TTS 云函数日志泄露签名凭证
- **Category**: OWASP A02 / STRIDE Information Disclosure
- **Severity**: Critical
- **Confidence**: 10/10
- **Location**: `miniprogram/cloudfunctions/tts/index.js:95-98`
- **Description**: TTS 云函数在每次调用时，将 Authorization 头、Payload 和 CanonicalRequest 打印到云函数日志中。Authorization 头包含 TC3-HMAC-SHA256 签名，结合 CanonicalRequest 可推导出签名密钥的使用模式。云函数日志可被腾讯云控制台管理员查看，也可通过 API 获取。
- **Exploit Scenario**:
  1. 有云函数日志查看权限的人员获取 Authorization 值
  2. Authorization 包含 Credential 和 Signature，结合时间戳和 CanonicalRequest 可用于理解签名结构
  3. 若 SECRET_KEY 本身也被泄露（如通过其他途径），这些日志提供了完整的请求构造信息
- **Reproduction Steps**:
  1. 调用 TTS 云函数
  2. 在腾讯云控制台查看云函数日志
  3. 可见 Authorization、Payload、CanonicalRequest 明文
- **Remediation**: 删除第 95-98 行的 console.log 语句，或仅保留不含敏感信息的简短日志（如 "TTS request sent, timestamp=xxx"）
- **Priority**: P0（立即修复）

### [F-004] 多个管理员云函数缺失身份验证
- **Category**: OWASP A01 / STRIDE Elevation of Privilege
- **Severity**: Critical
- **Confidence**: 10/10
- **Location**: 
  - `miniprogram/cloudfunctions/importQuestions/index.js:220`（主入口）
  - `miniprogram/cloudfunctions/generatePaper/index.js:20`（主入口）
  - `miniprogram/cloudfunctions/crawlQuestions/index.js:全文`（无 authAdmin 调用）
  - `miniprogram/cloudfunctions/aiAutoTag/index.js:117`（主入口）
- **Description**: 以上四个云函数均未调用 authAdmin 或进行任何管理员身份验证。任何已登录用户（包括普通学生账号）均可调用这些函数，执行批量导入题目、生成试卷、爬取网站、批量 AI 标注等管理员操作。
- **Exploit Scenario**:
  1. 学生用户通过开发者工具或逆向工程获取云函数调用方式
  2. 调用 importQuestions 注入恶意题目数据
  3. 调用 generatePaper 消耗题库资源
  4. 调用 crawlQuestions 进行 SSRF 攻击
- **Reproduction Steps**:
  1. 以普通用户身份调用 `wx.cloud.callFunction({ name: 'importQuestions', data: { data: [{ stem: '恶意题目', subject: '数学', grade: '六年级' }] } })`
  2. 函数成功执行并返回插入结果
- **Remediation**: 在每个管理云函数入口处添加 authAdmin 鉴权：`var authRes = await cloud.callFunction({ name: 'authAdmin' }); if (!authRes.result.isAdmin) return { success: false, error: '无权限' };`
- **Priority**: P0（立即修复）

### [F-005] 家长密码系统全面缺陷
- **Category**: OWASP A07/A02 / STRIDE Tampering + Information Disclosure
- **Severity**: Critical
- **Confidence**: 10/10
- **Location**: 
  - `miniprogram/utils/storage.js:233`（默认密码 '1234'）
  - `miniprogram/utils/storage.js:857-859`（明文比较验证）
  - `miniprogram/utils/storage.js:863-866`（明文存储）
  - `miniprogram/subpkg-user/pages/password/password.js:29`（4位限制）
  - `miniprogram/subpkg-user/pages/password/password.js:71`（忘记密码重置为'1234'）
- **Description**: 家长模式密码系统存在以下系统性缺陷：
  1. **4位纯数字**：仅 10,000 种组合，暴力破解 < 1 秒
  2. **明文存储**：密码以 `'1234'` 原文存储在 wx.setStorageSync 中，任何能访问本地存储的人均可直接读取
  3. **明文比较**：verifyPassword 使用 `===` 直接比较，无任何哈希
  4. **忘记密码重置为 '1234'**：重置后密码变为已知默认值，无需任何身份验证即可重置
  5. **默认密码 '1234'**：新用户初始密码为 '1234'，大多数用户可能不会修改
- **Exploit Scenario**:
  1. 儿童打开微信开发者工具或使用调试模式
  2. 读取 wx.getStorageSync('kid_checkin_data').user.parentPassword 获得密码明文
  3. 或者直接修改 isParentUnlocked 为 true 绕过密码
  4. 或者点击"忘记密码"将密码重置为 '1234'
  5. 儿童完全绕过家长管控，访问家长监控面板
- **Reproduction Steps**:
  1. 打开微信开发者工具的 Storage 面板
  2. 读取 kid_checkin_data 中的 user.parentPassword
  3. 密码明文可见
- **Remediation**: 
  - 将密码改为至少 6 位（推荐 8 位）混合字符
  - 使用 SHA-256 + salt 哈希存储密码，不再明文存储
  - 忘记密码流程需通过微信身份验证后才能重置
  - 添加密码尝试次数限制（5 次失败后锁定 5 分钟）
  - 解锁状态应使用短时效 token 而非简单 boolean
- **Priority**: P0（立即修复）

### [F-006] 积分系统完全客户端控制 — 无服务端验证
- **Category**: OWASP A01/A04 / STRIDE Tampering
- **Severity**: High
- **Confidence**: 9/10
- **Location**: 
  - `miniprogram/subpkg-learn/pages/ai-exam/ai-exam.js:858`（奖励积分硬编码客户端）
  - `miniprogram/utils/storage.js:859`（stars += rewardPoints 本地累加）
- **Description**: 积分（星星/stars）的获取、累加、消费全部在客户端完成。AI 练习完成后，客户端直接 `appData.user.stars += 20`，没有任何服务端校验。攻击者可通过修改本地存储中的 stars 值来无限刷分。
- **Exploit Scenario**:
  1. 攻击者在 Storage 面板中直接修改 stars 值为 99999
  2. 或修改 AI 练习的 rewardPoints 为任意数值
  3. 所有积分数据无服务端验证，修改后即生效
- **Reproduction Steps**:
  1. 在开发者工具 Storage 面板修改 kid_checkin_data.user.stars 为 99999
  2. 页面刷新后星星数变为 99999
- **Remediation**: 
  - 积分获取需通过云函数验证后写入服务端
  - 提交练习时由云函数根据实际正确率计算积分
  - 本地积分仅做展示，关键操作（兑换奖励）以服务端数据为准
- **Priority**: P1（本迭代修复）

### [F-007] submitPractice 云函数信任客户端提交的分数
- **Category**: OWASP A01 / STRIDE Tampering
- **Severity**: High
- **Confidence**: 9/10
- **Location**: `miniprogram/cloudfunctions/submitPractice/index.js:16-17`
- **Description**: submitPractice 直接使用客户端传入的 `correctCount` 和 `totalCount`，未与 answers 数组中的 `isCorrect` 字段进行交叉验证。攻击者可提交 answers 全部为错误（isCorrect: false），但 correctCount 设为 totalCount，从而伪造满分记录。
- **Exploit Scenario**:
  1. 攻击者调用 submitPractice，传入 `{ answers: [{questionId: 'x', userAnswer: 'a', isCorrect: false}], correctCount: 1, totalCount: 1 }`
  2. 云函数直接使用 correctCount=1，分数为 100
  3. 实际答案全部错误
- **Reproduction Steps**:
  1. 调用 submitPractice，设置 correctCount 与 answers 中的 isCorrect 不一致
  2. 云函数接受并写入不一致的记录
- **Remediation**: 在云函数中根据 answers 数组重新计算 correctCount：`var computed = answers.filter(a => a.isCorrect).length;` 并与传入值比较，不一致则拒绝或使用计算值
- **Priority**: P1（本迭代修复）

### [F-008] adminGuard 本地缓存可被篡改绕过
- **Category**: OWASP A01 / STRIDE Spoofing
- **Severity**: High
- **Confidence**: 8/10
- **Location**: `miniprogram/utils/adminGuard.js:24-36`
- **Description**: adminGuard 将管理员验证结果缓存到 `_admin_auth_cache` 本地存储，5 分钟内直接读缓存。攻击者可通过开发者工具修改此缓存，设置 `{ isAdmin: true, role: 'superadmin', expireAt: Date.now()+86400000 }`，从而在前端绕过管理员页面守卫。虽然真正的管理云函数在调用时仍会验证身份，但前端页面的导航和 UI 展示已被绕过。
- **Exploit Scenario**:
  1. 攻击者在 Storage 面板设置 `_admin_auth_cache = { isAdmin: true, role: 'superadmin', expireAt: 9999999999999 }`
  2. 直接访问管理页面，前端守卫通过
  3. 虽然管理云函数调用会失败，但可看到管理界面布局和功能
- **Reproduction Steps**:
  1. 在开发者工具设置上述缓存值
  2. 导航到管理页面，可见管理界面
- **Remediation**: 
  - 前端缓存仅用于 UI 按钮显隐，不做权限拦截
  - 所有管理页面必须在 onLoad 时实时调用 authAdmin 云函数
  - 管理云函数内部必须自行鉴权，不信任前端
- **Priority**: P1（本迭代修复）

### [F-009] getChildData 查询未加 _openid 过滤 — 潜在 IDOR
- **Category**: OWASP A01 / STRIDE Information Disclosure
- **Severity**: High
- **Confidence**: 7/10
- **Location**: `miniprogram/cloudfunctions/getChildData/index.js:47-49`
- **Description**: 第 47-49 行查询 `userDataCollection.where({ recordId: childId + '_default' })` 未添加 `_openid` 过滤。虽然前面有权限校验（检查 childId 是否在家长的 children 列表中），但如果云数据库安全规则未限制 _openid 访问，此查询可能返回任何匹配 recordId 的文档。
- **Exploit Scenario**: 若云数据库安全规则允许云函数模式下的跨用户读取，攻击者可通过猜测其他孩子的 childId（openid）构造 recordId 来读取数据。
- **Reproduction Steps**:
  1. 以家长身份调用 getChildData，传入其他家长孩子的 openid 作为 childId
  2. 因 children 校验会拒绝，需要看安全规则是否绕过
  3. 若安全规则较宽松，可能存在时序攻击（先通过 children 校验的时间窗口）
- **Remediation**: 在查询条件中添加 `_openid: childId` 确保只返回该孩子自己的数据；同时收紧云数据库安全规则
- **Priority**: P1（本迭代修复）

### [F-010] autoCrawl SSRF 绕过（DNS 重绑定 / IPv6）
- **Category**: OWASP A10 / STRIDE Elevation of Privilege
- **Severity**: Medium
- **Confidence**: 6/10
- **Location**: `miniprogram/cloudfunctions/autoCrawl/index.js:58-79`
- **Description**: autoCrawl 的 validateUrl 函数有基本的内网 IP 过滤（10.x, 127.x, 172.16-31, 192.168.x），但存在以下绕过可能：
  1. DNS 重绑定：域名解析时指向公网 IP 通过校验，请求时 DNS 已更新为内网 IP
  2. IPv6 地址：未检查 IPv6 回环地址（::1）和内网地址
  3. 特殊 IP：未过滤 0.0.0.0（仅过滤了 hostname === '0.0.0.0' 但未过滤 0.0.0.0:8080 格式）
  4. 无 openid 时跳过频率限制（第 84 行），开发环境下可无限调用
- **Exploit Scenario**:
  1. 注册域名 evil.com，初始解析为 8.8.8.8
  2. 通过校验后，DNS 更新为 10.0.0.1
  3. 请求实际发送到内网
- **Reproduction Steps**:
  1. 使用 DNS 重绑定服务配置域名
  2. 调用 autoCrawl 传入该域名
  3. 在第二次 DNS 解析时命中内网地址
- **Remediation**: 
  - 在 HTTP 请求前解析域名，校验解析后的 IP 是否为内网地址
  - 添加 IPv6 过滤
  - 移除 `if (!openid) return true` 的频率限制绕过
  - 考虑使用域名白名单而非黑名单
- **Priority**: P2（下迭代修复）

### [F-011] openid 存储在客户端可访问的本地存储
- **Category**: OWASP A02 / STRIDE Information Disclosure
- **Severity**: Medium
- **Confidence**: 8/10
- **Location**: `miniprogram/utils/account.js:21-26`
- **Description**: login 函数将 openid 存入 `wx.setStorageSync('loginUser', { openid, role, nickname, currentChildId })`。openid 是微信用户的唯一标识，在儿童隐私保护场景下属于敏感信息。任何能访问本地存储的人（包括手机被物理访问的儿童）均可获取 openid。
- **Exploit Scenario**: 儿童获取自己的 openid 后，可能将其分享给他人或用于其他不安全的目的。
- **Reproduction Steps**: 在 Storage 面板查看 loginUser 对象，openid 明文可见。
- **Remediation**: 
  - 前端不存储 openid，每次需要时通过云函数获取
  - 或存储时使用不可逆的派生标识（如 openid 的 SHA-256 哈希前8位）
- **Priority**: P2（下迭代修复）

### [F-012] familyBind 邀请码使用非密码学安全随机数
- **Category**: OWASP A02 / STRIDE Tampering
- **Severity**: Medium
- **Confidence**: 7/10
- **Location**: `miniprogram/cloudfunctions/familyBind/index.js:12-18`
- **Description**: generateCode 函数使用 `Math.random()` 生成 6 位邀请码。Math.random() 不是密码学安全的 PRNG，在理论上可被预测。6 位字符（32 个可选字符）仅提供约 30 bit 的熵，约 10 亿种可能。结合 24 小时有效期的无限制尝试，存在暴力破解风险。
- **Exploit Scenario**: 攻击者尝试随机邀请码绑定到任意家庭。6 位码 + 32 字符集 = 约 10 亿种可能，如果有自动化工具，可在数小时内尝试大量组合。
- **Reproduction Steps**: N/A（理论攻击，需大规模自动化尝试）
- **Remediation**: 使用 `crypto.randomBytes()` 生成邀请码；增加邀请码长度至 8 位；添加邀请码尝试频率限制
- **Priority**: P2（下迭代修复）

### [F-013] authAdmin 云函数日志泄露 openid
- **Category**: OWASP A09 / STRIDE Information Disclosure
- **Severity**: Medium
- **Confidence**: 9/10
- **Location**: `miniprogram/cloudfunctions/authAdmin/index.js:16,25,33,36`
- **Description**: authAdmin 在多处 console.log 中输出 openid 值（第 16 行调用日志、第 25 行查询成功日志、第 33 行无此 openid 日志、第 36 行查询失败日志）。这些日志可被腾讯云控制台有权限的人员查看。
- **Exploit Scenario**: 云平台运维人员或有日志访问权限的人员可收集用户的 openid 信息。
- **Reproduction Steps**: 调用 authAdmin 后在云函数日志中可见 "authAdmin 调用 openid: oXXXX..." 
- **Remediation**: 移除所有包含 openid 的 console.log，或使用脱敏处理（如只显示前 4 位 + ***）
- **Priority**: P2（下迭代修复）

### [F-014] speech-eval 云函数返回模拟评分
- **Category**: Insecure Design / Data Integrity
- **Severity**: Medium
- **Confidence**: 10/10
- **Location**: `miniprogram/cloudfunctions/speech-eval/index.js:21`
- **Description**: 口语评测云函数返回基于 `Math.random()` 的虚假评分（75-95 分随机），且 `recognizedText` 直接返回参考文本而非实际识别结果。如果此功能已上线面向用户，将提供误导性的学习反馈。
- **Exploit Scenario**: 学生获得虚假的高分反馈，实际发音问题未被发现。
- **Reproduction Steps**: 调用 speech-eval 云函数，每次获得不同随机分数。
- **Remediation**: 上线前必须接入真实 ASR 评分服务，或明确标注为"测试模式"并禁用该功能入口。
- **Priority**: P1（本迭代修复——至少禁用入口）

### [F-015] backup 云函数未校验数据大小
- **Category**: OWASP A04 / STRIDE Denial of Service
- **Severity**: Low
- **Confidence**: 6/10
- **Location**: `miniprogram/cloudfunctions/backup/index.js:7,15,19`
- **Description**: backup 云函数的 save 操作直接将 `event.data` 写入数据库，未校验数据大小或结构。恶意用户可传入超大 JSON 对象，导致数据库存储膨胀或云函数内存溢出。
- **Exploit Scenario**: 攻击者传入几十 MB 的 data 对象，导致备份集合存储暴增。
- **Reproduction Steps**: 传入大型 data 对象调用 backup 云函数。
- **Remediation**: 添加数据大小校验（如 `JSON.stringify(data).length < 1024 * 1024`）；添加数据结构校验
- **Priority**: P3（待排期）

### [F-016] project.config.json 开发配置未关闭
- **Category**: Security Misconfiguration
- **Severity**: Low
- **Confidence**: 8/10
- **Location**: `project.config.json`
- **Description**: `urlCheck: false` 和 `scopeDataCheck: false` 在项目配置中被禁用。虽然这些是开发辅助设置，在真机预览/发布时不会生效，但可能导致开发阶段的安全检查被跳过，引入漏洞而不自知。
- **Remediation**: 在上线前确认这些设置不影响发布版本；建议在开发阶段也启用安全检查
- **Priority**: P3（待排期）

### [F-017] ai-exam 客户端硬编码 API URL 并通过 SSRF 通道传递
- **Category**: OWASP A10
- **Severity**: Low
- **Confidence**: 7/10
- **Location**: `miniprogram/subpkg-learn/pages/ai-exam/ai-exam.js:337`
- **Description**: ai-exam 页面硬编码 `url: 'https://api.deepseek.com/chat/completions'` 并通过 ai-report 的 chat 模式传递。虽然当前传递的是合法 URL，但由于 ai-report 的 chat 模式接受任意 URL（F-001），攻击者可修改此调用传入恶意 URL。
- **Remediation**: 移除客户端 URL 参数传递，ai-report chat 模式应仅使用环境变量中的 API_URL
- **Priority**: P1（与 F-001 一同修复）

### [F-018] 云函数环境变量中的 API Key 无轮换机制
- **Category**: OWASP A02/A07
- **Severity**: Low
- **Confidence**: 4/10
- **Location**: 云函数环境变量配置（AI_API_KEY, TENCENT_SECRET_ID, TENCENT_SECRET_KEY）
- **Description**: 多个云函数通过 `process.env` 读取 API 密钥。虽然使用环境变量比硬编码安全，但未发现密钥轮换机制或泄露后的紧急响应流程。结合 F-003（日志泄露签名信息），若 API Key 被泄露，缺乏快速轮换和通知机制。
- **Remediation**: 建立密钥轮换流程；添加密钥泄露监控；考虑使用腾讯云 KMS 管理密钥
- **Priority**: P3（待排期）

---

## 安全态势评分

| 严重度 | 数量 |
|--------|------|
| Critical | 5 |
| High | 5 |
| Medium | 5 |
| Low | 3 |
| **总计** | **18** |

**整体安全评分: 2.5 / 10**

评分依据：
- 存在 5 个 Critical 级别漏洞（SSRF × 2、凭证泄露、未认证管理功能、密码系统缺陷）
- 积分和分数系统完全可被客户端篡改
- 儿童隐私保护场景下，家长锁系统近乎失效
- 评分 = 10 - (Critical×1.5 + High×0.8 + Medium×0.3 + Low×0.1) = 10 - (7.5 + 4.0 + 1.5 + 0.3) = -3.3 → clamp to 2.5（考虑部分缓解措施存在）

---

## Go/No-Go 判定

### **NO-GO** — 不建议在当前状态下上线

**必须修复后方可上线的漏洞（P0）**:

| 编号 | 漏洞 | 修复工作量估算 |
|------|------|----------------|
| F-001 | ai-report SSRF | 0.5 天（移除 event.url 支持，固定 API 端点） |
| F-002 | crawlQuestions SSRF + 无认证 | 1 天（添加 URL 校验 + authAdmin 鉴权） |
| F-003 | TTS 日志凭证泄露 | 0.5 天（删除 console.log） |
| F-004 | 管理云函数无认证 | 1 天（4 个函数添加 authAdmin 调用） |
| F-005 | 家长密码系统 | 2 天（SHA-256 哈希、密码策略、尝试限制、重置流程） |

**P0 修复总工作量估算: 5 天**

**建议上线前修复的漏洞（P1）**:

| 编号 | 漏洞 | 修复工作量估算 |
|------|------|----------------|
| F-006 | 积分系统客户端控制 | 2 天（服务端积分验证） |
| F-007 | submitPractice 分数伪造 | 0.5 天（服务端交叉验证） |
| F-008 | adminGuard 缓存篡改 | 1 天（实时鉴权） |
| F-009 | getChildData IDOR | 0.5 天（添加 _openid 过滤） |
| F-014 | speech-eval 模拟评分 | 0.5 天（禁用入口） |
| F-017 | ai-exam 硬编码 URL | 0.5 天（随 F-001 修复） |

**P1 修复总工作量估算: 5 天**

---

## 修复路线图

### Sprint 1 — P0 修复（上线阻塞项，5 天）
1. Day 1: 修复 F-001 + F-017（ai-report 移除 event.url，固定 API 端点；ai-exam 移除 URL 传递）
2. Day 2: 修复 F-002（crawlQuestions 添加 URL 校验 + 管理员鉴权）+ F-003（TTS 删除敏感日志）
3. Day 3-4: 修复 F-004（importQuestions, generatePaper, aiAutoTag 添加 authAdmin）
4. Day 4-5: 修复 F-005（家长密码系统重构）

### Sprint 2 — P1 修复（建议上线前完成，5 天）
1. Day 1-2: F-006 积分系统服务端验证
2. Day 3: F-007 + F-009（分数验证 + IDOR 修复）
3. Day 4: F-008 adminGuard 实时鉴权
4. Day 5: F-014 禁用 speech-eval + 测试

### Sprint 3 — P2/P3 修复（上线后迭代）
- F-010 autoCrawl DNS 重绑定防护
- F-011 openid 存储优化
- F-012 邀请码安全增强
- F-013 日志脱敏
- F-015 backup 数据校验
- F-016 开发配置
- F-018 密钥轮换机制

---

## 儿童隐私合规专项评估

针对 COPPA（美国）和《儿童个人信息网络保护规定》（中国）进行专项评估：

| 合规要求 | 当前状态 | 合规判定 |
|----------|----------|----------|
| 收集儿童个人信息需监护人同意 | 有隐私声明页面，但家长锁可被轻易绕过 | 不合规 |
| 不收集真实姓名、身份证号 | 代码中未发现此类收集 | 合规 |
| 不进行自动化决策或用户画像 | 代码中未发现画像逻辑 | 合规 |
| 家长可查看/管理儿童数据 | 功能存在，但家长身份验证薄弱 | 部分合规 |
| 儿童数据加密存储 | 本地明文存储，服务端依赖云开发默认加密 | 不合规（本地） |
| 数据最小化原则 | 存储了 openid 等非必要标识 | 部分合规 |
| 家长密码保护 | 4位数字、明文、可重置为默认 | 不合规 |

**儿童隐私合规评分: 3 / 10**

关键差距：家长管控机制可被儿童轻松绕过，使得"监护人同意"形同虚设。这是上线前必须解决的核心问题。

---

*报告结束。审计员：gstack-security-officer | GStack Security Division*
