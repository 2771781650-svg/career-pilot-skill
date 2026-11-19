# 职途 · CareerPilot

> 一个会调工具的 AI 求职智能体。**按钮全部可用，不配 Key 也能跑，断网也能用。**
> 电脑浏览器、手机各浏览器、微信 / QQ 内打开都能用。

一句话：把「我该找什么工作、简历差在哪、面试怎么答、下一步学什么」这四件事，交给一个真的算一遍的智能体，而不是聊两句。

## Skill 形态（参赛提交）

本作品以 **Skill（智能体技能）** 形式封装，可被独立调用，而非仅一个网页应用：

- 技能描述：`SKILL.md`、`skill.json`、`.well-known/skill.json`
- 标准调用入口：`skill_api.py`（Python / CLI / HTTP 三种方式）
- HTTP 调用：`POST /api/skill/{能力名}`、`POST /api/skill/run`；清单 `GET /api/skill/list`

```bash
python skill_api.py list                                   # 能力清单
python skill_api.py call match_job '{"resume_text":"…","job_title":"新媒体运营"}'
python skill_api.py run "我想投新媒体运营，差什么"
```

七个可调用能力：`build_resume`、`analyze_resume`、`match_job`、`rank_jobs`、`interview_question`、`evaluate_answer`、`career_plan`。

公开仓库：https://github.com/2771781650-svg/career-pilot-skill


---

## 一、跑起来（三种方式，任选）

```bash
# 方式 1：本地服务（推荐，有图片 OCR、能真调大模型）
pip install pillow python-docx      # 可选；不装也能跑，只是没有 OCR 和 .docx
python server.py                    # 打开 http://127.0.0.1:8000

# 方式 2：纯前端离线版（什么都不装，双击即可）
# 双击 web/index.html；想让别人也能访问就起静态服务
cd web && python -m http.server 8080

# 方式 3：Docker
docker build -t careerpilot . && docker run -p 8000:8000 careerpilot
```

三种方式功能都完整；差别只在「有没有 OCR / 能不能调大模型」，界面顶部会标出当前跑在哪个模式。

---

## 二、它能干什么

| 工具 | 作用 | 输出 |
|---|---|---|
| `build_resume` | 生成简历 | 按目标岗位分组技能、STAR 化经历、投放岗位关键词 |
| `analyze_resume` | 简历体检 | 学历/技能/项目/经历/证书五维评分 + 缺口优先级 |
| `match_job` | 岗位匹配 | 硬性 70% + 加分 30%，核心技能 1.5 倍加权 |
| `rank_jobs` | 岗位推荐 | 全岗位算一遍，按匹配度取前 3 |
| `interview_question` | 面试出题 | 按岗位分组的真实面题 |
| `evaluate_answer` | 面试点评 | STAR 四要素检测 + 量化词 + 篇幅 |
| `career_plan` | 路径规划 | 按目标 / 专业 / 每周时长切 8 周计划 |

界面上还有：一分钟体检卡（填 6 格生成「今日 3 件事」）、改前改后对比（同算法两列算分）、页面内自检（25 条断言）、模拟面试（3 套面试官人设 + 追问链）、三套简历模板、一键演示、语音输入、本机记忆。

---

## 三、两种引擎

- **有 API Key**：ReAct 循环（思考 → 选工具 → 观察 → 再思考 → 结论），大模型自主决策
- **无 Key / 断网**：内置规则路由，意图识别后直达工具，算法完全一致
- Key 只存在本机浏览器（`localStorage`），不上传服务器、不写日志

---

## 四、目录

```
server.py            后端（标准库起服务；按设备会话隔离档案）
main.py              命令行入口（--demo 跑一遍）
agent/               智能体（profile 槽位档案、react 循环）
tools/               七个工具 + 技能图谱 + 加权匹配 + 导出
data/jobs.jsonl      岗位库
web/                 纯前端（demo.js 离线引擎、agent.js 浏览器智能体、
                     persona.js 人设、plus.js 增强面板、sw.js PWA）
tests/               17 个单测
scripts/evaluate.py  路由与推荐的回归评测
docs/                产品说明、技术架构
```

零强制依赖：核心逻辑只用 Python 标准库。

---

## 五、隐私

- 简历图片**本机** OCR，不出网
- 档案、记忆、设备会话 id 都存在本机
- 不接第三方统计，不打点

---

## 六、常见问题

**微信里下载简历没反应？** 微信拦外链下载，用工具栏「复制简历」，粘到 WPS / 备忘录即可。
**语音按钮没反应？** 微信内置浏览器一般不支持语音识别，换 Chrome / Safari / 夸克，或用输入法自带麦克风。
**刷新后档案没了？** 档案存本机，清过缓存或换了浏览器就会没，重新说一句即可。

---

MIT License
