---
name: career-pilot
display_name: 职途 CareerPilot · AI 求职赋能技能
version: 1.3.0
track: AI就业赋能赛道
summary: 简历生成、简历体检、岗位匹配、岗位推荐、模拟面试出题与点评、8 周职业规划——七个可被独立调用的求职子能力，不配大模型 Key、断网也能跑。
homepage: https://github.com/2771781650-svg/career-pilot-skill
---

# 职途 CareerPilot · 求职赋能 Skill

## 一、这个技能解决什么问题

面向高职/大学生求职的真实卡点：不知道自己差在哪、投递靠感觉、面试答不成体系、规划是空话。本技能把「生成简历 → 体检打分 → 岗位匹配 → 岗位推荐 → 模拟面试 → 回答点评 → 路径规划」做成七个可插拔、可独立调用的能力，每个结论都能追到具体工具的计算过程。

## 二、如何被调用

### 1. Python（标准库，零强制依赖）

```python
from skill_api import invoke, list_capabilities, schema

list_capabilities()                 # 拿到全部子能力清单与参数
invoke("analyze_resume", {"resume_text": "……简历全文……"})
invoke("match_job", {"resume_text": "……", "job_title": "新媒体运营"})
```

返回统一结构：

```json
{ "ok": true, "capability": "match_job", "result": "【岗位匹配】……" }
{ "ok": false, "capability": "match_job", "error": "未知能力 …" }
```

### 2. 命令行（JSON 入 / JSON 出）

```bash
python skill_api.py list                                   # 能力清单
python skill_api.py schema                                  # 完整元数据
python skill_api.py call match_job '{"resume_text":"…","job_title":"新媒体运营"}'
python skill_api.py run "我想投新媒体运营，差什么"           # 自然语言入口（智能体自选能力）
```

### 3. HTTP（部署后公开可访问、可被平台调用）

| 方法 | 路径 | 入参 | 说明 |
|---|---|---|---|
| GET | `/api/skill/list` | — | 子能力清单 |
| GET | `/.well-known/skill.json` | — | 技能发现与元数据 |
| POST | `/api/skill/{capability}` | `{"args": {...}}` | 调用单个原子能力 |
| POST | `/api/skill/run` | `{"question": "...", "history": [...]}` | 自然语言，智能体串联能力 |

启动：`python server.py`（默认 `127.0.0.1:8000`；云上设 `HOST=0.0.0.0`）。

## 三、能力清单

| 能力 | 触发场景 | 关键入参 | 输出 |
|---|---|---|---|
| `build_resume` | 用户要写/改简历 | name, edu, skills, experience, target_job, contact, certs | STAR 化简历草案 + 岗位关键词 |
| `analyze_resume` | 评估简历质量 | resume_text | 五维评分 + 缺口优先级 |
| `match_job` | 问能不能投某岗位 | resume_text, job_title | 加权匹配度、具备/半具备/缺口、补齐路径 |
| `rank_jobs` | 不知道投什么 | resume_text, top(默认3) | 全岗位匹配度排序前 N |
| `interview_question` | 准备面试 | role, index(默认0) | 岗位真实面题 + 考察点 |
| `evaluate_answer` | 点评面试回答 | question, answer | STAR 四要素 + 量化词 + 篇幅打分与建议 |
| `career_plan` | 要学习/求职规划 | goal, major, hours_per_week, weeks(默认8) | N 周执行计划 |

## 四、运行机制（可现场验证）

- **双引擎降级**：配了大模型 Key 走 ReAct 循环（思考→选工具→观察→结论）；无 Key / 断网走内置规则路由，算法一致，功能完整。
- **零强制依赖**：核心逻辑仅用 Python 标准库；`openai`、`python-dotenv`、`pillow`、`python-docx` 均为可选。
- **可解释**：每条结论都能追到具体工具调用步骤，可追问「算过什么」。
- **隐私脱敏**：简历图片本机 OCR，档案/记忆存本机，不接第三方统计；不内置任何真实姓名、手机号、身份证等个人信息。

## 五、目录

```
skill_api.py        标准 Skill 调用入口（Python / CLI / HTTP）
skill.json          技能元数据与能力入参出参定义
.well-known/skill.json  技能发现描述
agent/              智能体（档案槽位、ReAct 循环、规则路由）
tools/              七个子能力 + 技能图谱 + 加权匹配 + 导出
data/               岗位库、面题库
web/                配套前端演示界面（非调用入口）
server.py           Web 服务，含 /api/skill/* 调用接口
tests/              单元测试
```
