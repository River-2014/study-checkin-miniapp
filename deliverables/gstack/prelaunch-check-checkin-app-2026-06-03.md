# 学习打卡小程序上线前全检报告

**日期**：2026-06-03
**场景**：上线前全检（代码审查 + 安全审计 + QA测试）
**参与成员**：产品官 + 安全官 + QA门神

---

## 📌 TL;DR（执行摘要）

- **整体结论**：🔴 **NO-GO** — 当前状态不建议上线
- **核心阻塞项**：5个Critical安全漏洞 + 3个P0功能缺陷 + 排行榜功能不可用
- **安全评分**：2.5/10（安全官） | **代码健康度**：5.8/10（产品官） | **QA健康分**：68/100（QA门神）
- **P0/Critical修复总工作量**：安全P0约6小时 + 代码P0约2小时 ≈ **2个工作日**（安全官更精确估算）
- **下一步**：修复所有P0/Critical项后重新评估，预计W2中可上线

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| Go / No-Go | 🔴 No-Go |
| 严重度分布 | 🔴 Critical×5 + P0×5 / 🟠 High×5 + P1×9 / 🟡 Medium×5 + P2×8 / 🟢 Low×3 |
| 关键行动项 | 13条（5 Critical安全 + 5 P0代码 + 3 QA阻塞） |
| 建议负责人 | 安全官→云函数鉴权+SSRF修复；产品官→代码P0修复；运维→10项配置确认 |

---

## 1. 各成员核心结论

### 🔍 产品官（代码审查）
- **核心判断**：代码健康度5.8/10，存在5个P0级功能缺陷，部分将导致功能完全不可用
- **关键发现**：分享卡片方法名错误（TypeError）、tryCloud异步逻辑致命缺陷、云恢复直接覆盖无合并、account.js模块顶层getApp()时序炸弹
- **修复预估**：P0项约2小时可修复

### 🛡️ 安全官（OWASP+STRIDE审计）
- **核心判断**：安全评分2.5/10，NO-GO。18个漏洞含5个Critical，儿童隐私合规评分3/10
- **关键发现**：2个SSRF漏洞可访问云元数据、TTS日志泄露签名凭证、4个管理云函数无鉴权、家长密码系统全面缺陷（4位PIN+明文+重置为1234+无尝试限制）
- **修复预估**：Critical项5天

### ✅ QA门神（QA测试与发布检查）
- **核心判断**：68/100，有条件上线。核心流程基本可用，但3项阻塞+多项运维待确认
- **关键发现**：排行榜云函数缺action导致功能不可用、订阅消息模板ID占位符、家长密码明文审核风险、10项运维配置待确认
- **上线前提**：修复3项阻塞 + 确认10项运维配置

---

## 2. 综合审查发现（去重合并后按严重度排序）

> 三方独立审查，去重合并后共 **27项独立发现**。标注来源：🔍=产品官 🛡️=安全官 ✅=QA

| # | 严重度 | 类别 | 位置 | 问题描述 | 建议 | 来源 |
|---|--------|------|------|---------|------|------|
| 1 | 🔴 Critical | 安全-SSRF | cloudfunctions/ai-report/index.js:72 | chat模式接受客户端event.url作为请求目标，无白名单/内网IP过滤，可访问169.254.169.254获取云凭证 | 移除event.url支持，固定API端点 | 🛡️🔍 |
| 2 | 🔴 Critical | 安全-SSRF | cloudfunctions/crawlQuestions/index.js:26-39 | httpGet直接使用用户传入URL，无校验无认证无协议限制 | 添加URL校验+管理员鉴权 | 🛡️ |
| 3 | 🔴 Critical | 安全-凭证泄露 | cloudfunctions/tts/index.js:95-98 | console.log输出Authorization头、Payload、CanonicalRequest，可致腾讯云账户凭证泄露 | 删除敏感日志输出 | 🛡️✅ |
| 4 | 🔴 Critical | 安全-鉴权缺失 | importQuestions/generatePaper/crawlQuestions/aiAutoTag + managePapers | 多个写操作云函数缺失管理员鉴权（managePapers的create/delete/update/batchDeleteMetadata、importQuestions、autoCrawl、aiAutoTag、generatePaper），任何微信用户可删除试卷、注入题目、触发爬虫 | 所有写操作添加requireAdmin('operator')鉴权 | 🛡️ |
| 5 | 🔴 Critical | 安全-密码系统 | storage.js:233,857-866 + password.js:29,71 | 家长密码全面缺陷：4位PIN(秒破)、明文存储、重置为'1234'、无尝试限制，儿童可轻松绕过 | SHA-256哈希存储、增加复杂度、尝试限制、安全重置流程 | 🛡️✅🔍 |
| 6 | 🔴 P0 | 功能-方法不存在 | pages/home/home.js:260 | share.generateCard()不存在，应为generateShareCard()，分享卡片TypeError | 改为share.generateShareCard() | 🔍 |
| 7 | 🔴 P0 | 功能-异步缺陷 | pages/home/home.js:195-217 | tryCloud()异步逻辑错误，return true在同步位置，云函数失败时AI建议区空白 | 重构为Promise/回调模式 | 🔍 |
| 8 | 🔴 P0 | 功能-时序炸弹 | utils/account.js:7 | 模块顶层调用getApp()，此时App()未初始化返回undefined | 移入函数内部延迟获取 | 🔍 |
| 9 | 🔴 P0 | 功能-数据覆盖 | pages/mine/mine.js:477-499 | cloudRestore直接覆盖本地数据无合并策略，可丢失新打卡记录 | 实现字段级合并或提示数据差异 | 🔍 |
| 10 | 🔴 P0 | 功能-占位符 | pages/mine/mine.js:206 | 订阅消息模板ID为'YOUR_TEMPLATE_ID'占位符，功能完全不可用 | 替换为真实tmplId | 🔍✅ |
| 11 | 🟠 High | 安全-积分篡改 | 全局积分逻辑 | 积分系统完全客户端控制，无服务端验证 | 服务端积分校验（中期） | 🛡️ |
| 12 | 🟠 High | 安全-分数伪造 | cloudfunctions/submitPractice | 信任客户端提交的correctCount，可伪造满分 | 服务端判题或签名校验 | 🛡️ |
| 13 | 🟠 High | 安全-越权 | adminGuard + getChildData | adminGuard本地缓存可被篡改绕过；getChildData未加_openid过滤潜在IDOR | 服务端鉴权+openid过滤 | 🛡️ |
| 14 | 🟠 High | 安全-虚假评分 | cloudfunctions/speech-eval | 返回随机虚假评分，非真实语音评估 | 接入真实语音评测或标注"练习模式" | 🛡️ |
| 15 | 🟠 High | 功能-云函数缺失 | cloudfunctions/dataSync/index.js | 不支持leaderboard/getLeaderboard action，排行榜完全不可用 | 添加action支持或隐藏入口 | ✅ |
| 16 | 🟡 P1 | 功能-数据结构 | utils/practiceHelper.js:84-94 | getKnowledgePoints()返回错误结构，name为对象非字符串 | 双层遍历展平知识点 | 🔍 |
| 17 | 🟡 P1 | 功能-判分逻辑 | utils/practiceHelper.js:40 | 选择题indexOf子串匹配，"3.14"匹配"3"误判 | 严格匹配字母标签 | 🔍 |
| 18 | 🟡 P1 | 性能-setData | ai-exam.js:561-583 | 每次选择选项拷贝整个userAnswers再setData | 使用路径更新 | 🔍 |
| 19 | 🟡 P1 | 性能-每秒渲染 | exam-paper.js:414-432 + pomodoro.js:45-55 | 考试倒计时+番茄钟每秒setData，30分钟产生1800次 | WXS渲染或5秒降频 | 🔍✅ |
| 20 | 🟡 P1 | 功能-硬编码 | pages/mine/mine.js:468 | cloudBackup硬编码childId='default'，多孩同步错误数据 | 使用getCurrentChildId() | 🔍✅ |
| 21 | 🟡 P1 | 功能-密码绕过 | password.js:71 | 忘记密码重置为'1234'并直接解锁，无需验证即进家长模式 | 改为设置新密码流程 | 🔍✅🛡️ |
| 22 | 🟡 P1 | 功能-边界错误 | pages/home/home.js:22-24 | 中考/高考倒计时6月16日后显示为0而非下一年 | 修正日期计算边界条件 | ✅ |
| 23 | 🟡 P1 | 功能-竞态条件 | pomodoro.js:39-43 | pause()先setData再判断状态，setData异步可能致定时器异常 | 先保存状态再setData | ✅ |
| 24 | 🟡 P1 | 功能-残留代码 | leaderboard.js:44 | 无意义wx.getStorageSync('appData')调用 | 删除该行 | 🔍✅ |
| 25 | 🟢 P2 | 维护-代码复制 | subpkg-*/utils/* | 14个工具模块跨3个分包完全复制，修改需同步多处 | CI diff检查+长期分包优化 | 🔍✅ |
| 26 | 🟢 P2 | 功能-徽章条件 | storage.js:153 | 闪电侠徽章streak>=1即解锁，与描述不符 | 修正为检查当日完成时间 | ✅ |
| 27 | 🟢 P2 | 运维-版本管理 | 全局 | 无版本号管理机制，无法追踪/回滚 | 添加version字段+发布日志 | ✅ |

---

## 3. STRIDE 威胁建模汇总（安全官产出）

| STRIDE维度 | 高风险威胁数 | 关键威胁 |
|------------|-------------|---------|
| **S**poofing 伪造身份 | 1 | adminGuard缓存伪造绕过管理员页面 |
| **T**ampering 篡改数据 | 3 | 积分客户端篡改、分数伪造、家长锁绕过 |
| **R**epudiation 抵赖 | 1 | 管理操作无审计日志 |
| **I**nformation Disclosure 信息泄露 | 3 | 日志泄露openid/Authorization、密码明文、openid存储 |
| **D**enial of Service 拒绝服务 | 2 | 无认证的批量操作、backup无大小限制 |
| **E**levation of Privilege 提权 | 4 | SSRF×2、未认证管理功能×2 |

---

## 4. 上线检查清单（Go/No-Go Checklist）

### 4.1 必须修复（阻塞上线）

| # | 检查项 | 状态 | 来源 |
|---|--------|------|------|
| 1 | SSRF漏洞修复（ai-report + crawlQuestions） | ❌ | 🛡️ |
| 2 | TTS云函数敏感日志移除 | ❌ | 🛡️✅ |
| 3 | 4个管理云函数添加鉴权 | ❌ | 🛡️ |
| 4 | 家长密码系统重构（哈希+复杂度+限制+安全重置） | ❌ | 🛡️✅🔍 |
| 5 | share.generateCard→generateShareCard | ❌ | 🔍 |
| 6 | tryCloud()异步逻辑重构 | ❌ | 🔍 |
| 7 | account.js getApp()时序修复 | ❌ | 🔍 |
| 8 | cloudRestore添加数据合并 | ❌ | 🔍 |
| 9 | 订阅消息模板ID替换 | ❌ | 🔍✅ |
| 10 | 排行榜云函数支持或隐藏入口 | ❌ | ✅ |
| 11 | 密码重置流程修复（不再直接解锁） | ❌ | 🔍✅🛡️ |
| 12 | 中考/高考倒计时边界修复 | ❌ | ✅ |
| 13 | 番茄钟pause竞态条件修复 | ❌ | ✅ |

### 4.2 运维必须确认（上线前）

| # | 确认项 | 状态 |
|---|--------|------|
| 1 | AI_API_KEY云函数环境变量已配置 | ❓ |
| 2 | TENCENT_SECRET_ID/KEY已配置 | ❓ |
| 3 | TTS服务已开通 | ❓ |
| 4 | 订阅消息模板已申请 | ❓ |
| 5 | exam_questions数据库集合已创建 | ❓ |
| 6 | 30个云函数已全部上传部署 | ❓ |
| 7 | backup云函数定时触发器配置 | ❓ |
| 8 | 隐私政策补充（如审核需要） | ❓ |
| 9 | 小程序审核材料准备 | ❓ |
| 10 | 版本号管理机制建立 | ❓ |

---

## 5. 修复路线图

### Sprint 1 — P0/Critical 上线阻塞（5-7天）

| 优先级 | 修复项 | 预估工时 | 负责方 |
|--------|--------|---------|--------|
| Critical | F-001 SSRF: ai-report移除event.url | 2h | 后端 |
| Critical | F-002 SSRF: crawlQuestions添加URL校验+鉴权 | 3h | 后端 |
| Critical | F-003 TTS敏感日志删除 | 10min | 后端 |
| Critical | F-004 6+个管理云函数添加requireAdmin | 4h | 后端 |
| Critical | F-005 家长密码系统重构 | 4h | 全栈 |
| Medium | autoCrawl添加169.254过滤 | 30min | 后端 |
| P0 | share.generateCard修复 | 1min | 前端 |
| P0 | tryCloud()异步重构 | 30min | 前端 |
| P0 | account.js getApp()修复 | 10min | 前端 |
| P0 | cloudRestore数据合并 | 1h | 前端 |
| P0 | 订阅消息模板ID替换 | 5min | 运维 |
| P0 | 排行榜云函数支持或隐藏入口 | 3h | 后端 |
| P1 | 密码重置流程修复 | 30min | 前端 |
| P1 | 倒计时边界修复 | 15min | 前端 |
| P1 | 番茄钟pause修复 | 15min | 前端 |

### Sprint 2 — P1/High 建议上线后一周内（5天）

- 积分服务端验证方案设计
- submitPractice服务端判题
- adminGuard服务端鉴权
- practiceHelper数据结构+判分逻辑修复
- setData性能优化（exam-paper + pomodoro + ai-exam）
- childId硬编码修复
- 选择题严格匹配

### Sprint 3 — P2/Medium 优化迭代

- 14个utils复制治理（CI diff检查）
- storage.js拆分
- 代码风格统一（ES5/ES6）
- 闪电侠徽章条件修正
- 积分衰减UI展示
- 版本号管理
- sitemap管理页面过滤

---

## ✅ 行动清单

| # | 行动 | 负责方 | 紧急度 | 期望完成 |
|---|------|--------|--------|---------|
| 1 | 修复2个SSRF漏洞（ai-report + crawlQuestions） | 后端 | P0 | D+1 |
| 2 | 重构家长密码系统（哈希+复杂度+限制+安全重置） | 全栈 | P0 | D+1 |
| 3 | 4个管理云函数添加authAdmin鉴权 | 后端 | P0 | D+2 |
| 4 | 删除TTS云函数4行敏感console.log | 后端 | P0 | D+0 |
| 5 | 修复5个P0代码缺陷（方法名/异步/getApp/恢复/模板ID） | 前端 | P0 | D+1 |
| 6 | 排行榜云函数添加action支持或隐藏入口 | 后端 | P0 | D+2 |
| 7 | 修复密码重置流程+倒计时边界+番茄钟竞态 | 前端 | P1 | D+3 |
| 8 | 确认10项运维配置（API Key/云函数/模板/数据库） | 运维 | P0 | D+2 |
| 9 | 设计积分服务端验证方案 | 后端 | P1 | D+5 |
| 10 | 全量回归测试验证所有修复 | QA | P0 | D+7 |
| 11 | 建立版本号管理机制 | 运维 | P1 | D+3 |
| 12 | 提交微信审核材料 | 产品 | P1 | D+7 |

---

## ⚠️ 待完善 / 已知局限

- **积分系统**：完全客户端控制，短期无法重构为服务端验证，需在Sprint 2设计服务端方案
- **PK功能**：纯模拟虚拟对手，微信审核可能要求标注说明
- **speech-eval**：返回随机评分非真实语音评测，需接入真实服务或标注
- **多孩账号**：childId硬编码'default'，云同步在多孩场景下不可用
- **分包utils复制**：微信小程序限制导致无法避免，需CI层面管控一致性
- **灰度发布**：微信小程序无原生灰度能力，需依赖审核后手动控制发布节奏

---

## 📚 成员产出索引

- gstack-product-reviewer（产品官）原始产出：代码审查报告，5.8/10，5 P0 + 9 P1 + 8 P2，共22项发现
- gstack-security-officer（安全卫士）原始产出：OWASP+STRIDE审计报告，2.5/10 NO-GO，2 Critical + 3 High + 6 Medium + 3 Low + 2 Info（第二轮更精确：5阻断项含managePapers扩展+autoCrawl SSRF不完整+OWASP Top 10映射），P0修复约6小时
- gstack-qa-lead（质量门神）原始产出：QA测试报告，68/100 Conditional Go，1 Critical + 5 High + 6 Medium + 3 Low，30个测试用例，13项Bug

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。
