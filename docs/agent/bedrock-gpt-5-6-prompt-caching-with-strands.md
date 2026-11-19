---
title: Bedrock 上的 GPT-5.6 Luna：提示词缓存与跨区域延迟实测
date: 2026-11-18
tags: [Amazon Bedrock, Strands Agents, GPT-5.6, Prompt Caching, 成本优化, 延迟]
---

<script setup>
import BarChart from '../.vitepress/theme/BarChart.vue'

// 图 1：场景 C 稳态单次请求的输入 token 构成（eu-central-1 Global，effort low，稳态调用的平均值）
const tokenSeries = [
  { label: '缓存读取（按输入价 ×0.1 计费）', color: 'var(--vp-c-green-2)' },
  { label: '缓存写入（×1.25）', color: 'var(--vp-c-red-2)' },
  { label: '未缓存输入（×1）', color: 'var(--vp-c-indigo-2)' }
]
const tokenGroups = [{ rows: [
  { label: 'strands', values: [0, 5915, 2], end: '输入费用约 $1.48 / 千次' },
  { label: 'opt_implicit', values: [4753, 1168, 2], end: '约 $0.39 / 千次' },
  { label: 'opt_explicit', values: [4753, 0, 1170], end: '约 $0.33 / 千次', highlight: true }
] }]

// 图 2：稳态单次费用 ÷ 同一组调用不用缓存时的费用
const ratioGroups = [
  { label: 'A（effort none）', rows: [
    { label: 'asis', values: [0.60] }, { label: 'strands', values: [0.60] },
    { label: 'opt_implicit', values: [0.20] }, { label: 'opt_explicit', values: [0.21], highlight: true }
  ] },
  { label: 'B（effort low）', rows: [
    { label: 'asis', values: [1.21] }, { label: 'strands', values: [1.21] },
    { label: 'opt_implicit', values: [0.32] }, { label: 'opt_explicit', values: [0.29], highlight: true }
  ] },
  { label: 'C（effort low）', rows: [
    { label: 'asis', values: [1.16] }, { label: 'strands', values: [1.15] },
    { label: 'opt_implicit', values: [0.57] }, { label: 'opt_explicit', values: [0.53], highlight: true }
  ] },
  { label: 'D（effort low）', rows: [
    { label: 'asis', values: [1.12] }, { label: 'strands', values: [1.12] },
    { label: 'opt_implicit', values: [0.75] }, { label: 'opt_explicit', values: [0.71], highlight: true }
  ] }
]

// 图 3：耗时拆解（复用连接，nearest-rank P50）：往返 + (首 token − 往返) + (总耗时 − 首 token) = 总耗时 P50
const latencySeries = [
  { label: '网络往返', color: 'var(--vp-c-red-2)' },
  { label: '服务端到首 token', color: 'var(--vp-c-indigo-2)' },
  { label: '生成', color: 'var(--vp-c-green-2)' }
]
const latencyGroups = [
  { label: 'A', rows: [
    { label: 'eu-central-1 Global', values: [3, 375, 200], end: '约 580 ms', highlight: true },
    { label: 'us-east-1 US Geo', values: [94, 538, 201], end: '约 830 ms' },
    { label: 'us-east-1 Global', values: [94, 535, 194], end: '约 820 ms' },
    { label: 'Qwen3-235B us-west-2', values: [151, 571, 254], end: '约 980 ms' }
  ] },
  { label: 'B', rows: [
    { label: 'eu-central-1 Global', values: [3, 339, 184], end: '约 530 ms', highlight: true },
    { label: 'us-east-1 US Geo', values: [94, 644, 185], end: '约 920 ms' },
    { label: 'us-east-1 Global', values: [94, 611, 183], end: '约 890 ms' },
    { label: 'Qwen3-32B us-west-2', values: [151, 562, 80], end: '约 790 ms' }
  ] },
  { label: 'C', rows: [
    { label: 'eu-central-1 Global', values: [3, 378, 1440], end: '约 1,820 ms', highlight: true },
    { label: 'us-east-1 US Geo', values: [94, 626, 1385], end: '约 2,110 ms' },
    { label: 'us-east-1 Global', values: [94, 634, 1338], end: '约 2,070 ms' },
    { label: 'Qwen3-32B us-west-2', values: [151, 627, 1438], end: '约 2,220 ms' }
  ] },
  { label: 'D', rows: [
    { label: 'eu-central-1 Global', values: [3, 359, 1161], end: '约 1,520 ms', highlight: true },
    { label: 'us-east-1 US Geo', values: [94, 524, 1022], end: '约 1,640 ms' },
    { label: 'us-east-1 Global', values: [94, 537, 1131], end: '约 1,760 ms' },
    { label: 'Qwen3-32B us-west-2', values: [151, 409, 1234], end: '约 1,790 ms' }
  ] }
]

// 图 4：稳态每千次调用费用，Luna（推荐配置）对比基线（A：Qwen3-235B；B、C、D：Qwen3-32B）
const costGroups = [
  { label: 'A · 静态前缀 98% · 输出约 50 token · −88%', rows: [
    { label: 'GPT-5.6 Luna', values: [0.135], end: '$0.14', highlight: true },
    { label: 'Qwen3-235B', values: [1.084], end: '$1.08' }
  ] },
  { label: 'B · 静态前缀 94% · 输出约 55 token · −71%', rows: [
    { label: 'GPT-5.6 Luna', values: [0.165], end: '$0.17', highlight: true },
    { label: 'Qwen3-32B', values: [0.566], end: '$0.57' }
  ] },
  { label: 'C · 静态前缀 80% · 输出约 350 token · −36%', rows: [
    { label: 'GPT-5.6 Luna', values: [0.751], end: '$0.75', highlight: true },
    { label: 'Qwen3-32B', values: [1.181], end: '$1.18' }
  ] },
  { label: 'D · 静态前缀 68% · 输出约 300 token · −7%', rows: [
    { label: 'GPT-5.6 Luna', values: [0.569], end: '$0.57', highlight: true },
    { label: 'Qwen3-32B', values: [0.611], end: '$0.61' }
  ] }
]
</script>

# 在 Amazon Bedrock 上用 Strands 接入 GPT-5.6 Luna：显式提示词缓存与跨区域延迟实测

::: info 版本与时效
- 测试日期：2026-11-18。服务部署在 eu-central-1（Frankfurt）。
- 模型：OpenAI GPT-5.6 Luna（Bedrock 模型卡注明 2026-07-13 发布，EOL 不早于 2027-07-13）。基线是 us-west-2 上的 Qwen3-235B（场景 A）和 Qwen3-32B（场景 B、C、D），见"背景"一节。
- 框架与 SDK：Strands Agents 1.65.0（文中会对比 1.47.0 的差异）、openai Python SDK 3.52.0、aws-bedrock-token-generator 1.1.0。
- 价格按测试当时的 Standard 档单价计算。Bedrock 的区域可用性、价格和 Strands 的实现变化都很快，参考时请先核对最新文档。
:::

::: tip TL;DR
- **接入路径**：在 eu-central-1 用 `bedrock-runtime` 的 Responses API 加 `global.openai.gpt-5.6-luna`。Converse 不支持显式缓存断点，bedrock-mantle 在这个区域不可用。
- **省不省钱取决于提示词结构**：只换模型 ID 或用 Strands 默认的 `CacheConfig`，单轮调用的缓存每次都写、下次读不到，B、C、D 三个场景比完全不用缓存还贵 12% 到 21%。把静态内容放前面并打显式断点后，稳态缓存读取占比等于静态前缀的占比。
- **Strands 1.65 需要一个小子类**，把断点打在 system 的静态块上，代码见下文。
- **费用**：四个场景的稳态单次费用比原来的基线模型（A 用 Qwen3-235B，B、C、D 用 Qwen3-32B）低 7% 到 88%。静态前缀占输入 97.6%、输出约 50 token 的场景降 88%；静态前缀占 68.2%、输出约 300 token 的场景只降 7%。
- **effort**：`none` 比 `low` 省 19% 到 39%，输出格式的可用率不变。内容质量没有经过人工评审。
- **延迟**：同区域接入比跨洋接入的首 token 快约 250 到 400 ms，其中网络往返只占约 90 ms，模型生成阶段的耗时和接入区域无关。
:::

## 背景

一个线上 Agent 服务里有四类 LLM 调用，原来都调用 us-west-2 上的 Qwen3 模型（A 用 Qwen3-235B，B、C、D 用 Qwen3-32B），服务本身部署在 eu-central-1：

| 代号 | 场景 | 输入特点 | 输出 | 原模型（基线） |
|---|---|---|---|---|
| A | 多轮对话中的结构化偏好抽取（流式） | 规则约 1,600 token，外加一份两百多项的词表字典 | 一句回复加一个短 JSON | Qwen3-235B（`qwen.qwen3-235b-a22b-2507-v1:0`） |
| B | 参数抽取加候选排序 | 规则和 schema 约 1,300 token，外加一份几十项的候选目录 | 短 JSON | Qwen3-32B（`qwen.qwen3-32b-v1:0`） |
| C | 长 JSON 内容生成（RAG） | 规则和示例约 5,000 token，外加每次不同的检索结果 | 可见部分约 350 token 的 JSON | Qwen3-32B |
| D | 长 JSON 内容生成（较短模板） | 规则约 1,900 token，外加检索结果 | 可见部分约 300 token 的 JSON | Qwen3-32B |

计算费用用的单价如下（测试时的 Standard 档，美元 / 百万 token）。Qwen3-235B 和 Qwen3-32B 都没有开启缓存：

| 模型 | 未缓存输入 | 缓存读取 | 缓存写入 | 输出 |
|---|---|---|---|---|
| GPT-5.6 Luna（Global） | 0.20 | 0.02 | 0.25 | 1.20 |
| GPT-5.6 Luna（US Geo） | 0.22 | 0.022 | 0.275 | 1.32 |
| Qwen3-235B | 0.22 | — | — | 0.88 |
| Qwen3-32B | 0.15 | — | — | 0.60 |

目标是换成 GPT-5.6 Luna，同时降低成本和延迟。GPT-5.6 的缓存读取只收未缓存输入价的十分之一，但缓存写入要多收 25%，所以**省不省钱几乎完全取决于提示词怎么组织**。这篇笔记记录接入路径的选择、缓存机制、实测数据，以及在 Strands 里的实现。

## 核心概念

### Bedrock 上调用 GPT-5.6 的几条路径

| 路径 | 显式缓存断点 | 说明 |
|---|---|---|
| `bedrock-runtime` + Responses API | ✅ | AWS 推荐新应用使用 bedrock-runtime。在 eu-central-1，Luna 只能通过这条路径加 Global 推理配置（`global.openai.gpt-5.6-luna`）使用 |
| `bedrock-runtime` + Converse | ❌ | 对 OpenAI 模型只做隐式缓存，并且拒绝 cache point（Strands 1.65 的 `BedrockModel` 源码注释里写明了这一点） |
| `bedrock-mantle` + Responses / Chat Completions | ✅ | 只在少数区域提供，eu-central-1 不支持 |

所以在 Strands 里要用 `OpenAIResponsesModel` 走 bedrock-runtime，而不是默认的 `BedrockModel`。

### GPT-5.6 的提示词缓存

以下内容整理自 AWS 的两篇博客（见参考资料）：

- **计费**：缓存读取 = 未缓存输入价 × 0.1，缓存写入 = 未缓存输入价 × 1.25。隐式写入和显式写入都按这个价格收。
- **门槛**：可缓存前缀至少 1,024 token。
- **TTL**：至少 30 分钟，每次复用都会刷新。openai SDK 的参数类型允许 `30m` 和 `12h` 两个值，本文只用过 `30m`。
- **两种模式**：
  - `implicit`（默认）：服务端自动在最新一条消息处打断点，什么时候开始命中不确定。
  - `explicit`：只使用你自己打的断点（`prompt_cache_breakpoint`），每个请求最多 4 个，结果确定。
- **`prompt_cache_key`**：把相同前缀的请求路由到同一份缓存。实测长度上限 64 字符，超过直接返回 400。
- 博客还提到：用 explicit 模式但不打任何断点，可以不产生缓存写入费用。这一点我没有实测。

这里有一个反直觉的地方：**隐式缓存不是免费的**。如果每次都变的内容在提示词前面或中间，服务端每次都会按 1.25 倍价格写一份下次读不到的缓存。

### reasoning effort 与采样参数

GPT-5.6 的 `reasoning.effort` 可选 `none` / `low` / `medium` / `high` / `xhigh`，默认是 `medium`。推理 token 按输出价计费。实测采样参数的约束如下，三个接入目标结果一致：

| effort | 采样参数 | 结果 |
|---|---|---|
| `none` | 不传 | 接受 |
| `none` | `temperature=0.01, top_p=0.8` | 接受 |
| `none` | `temperature=1.0` | 接受 |
| `low` | `temperature=0.01, top_p=0.8` | **HTTP 400**：`Unsupported parameter: 'temperature' is not supported with this model.` |

## 实验设计

| 维度 | 取值 |
|---|---|
| 接入目标 | eu-central-1 + Global、us-east-1 + US Geo、us-east-1 + Global（都走 bedrock-runtime） |
| 提示词结构 | `asis`：原有提示词，变化内容在 system 里，隐式缓存。`strands`：Strands 1.65 默认 `CacheConfig` 的请求形态。`opt_explicit`：静态内容在前加显式断点。`opt_implicit`：结构同 opt_explicit，但用隐式模式 |
| effort | A 只测 `none`；B、C、D 在所有结构上测 `low`，在 `opt_explicit` 上加测 `none` |
| 调用方式 | 顺序调用每组 6 次；并发每组 10 路，此时静态前缀已经预热 |
| 基线 | us-west-2 上的 Qwen3-235B（A）和 Qwen3-32B（B、C、D），采样参数沿用线上配置 |

几个口径说明：

- **输入**：mock 数据，但提示词模板、渲染函数和后处理代码都和线上一致。
- **"可用"的判定**：把模型输出交给线上的后处理和校验代码，看能不能正常使用。只判断能不能用，不评价内容好坏。
- **费用**：按每次响应的 usage 计算。表里的"稳态"指去掉每组第 1 次冷写入之后的数据。
- **缓存隔离**：每个"目标 + 结构 + effort"组合在提示词开头加一个独立标记，并使用独立的 `prompt_cache_key`。为什么必须这样做，见文末"踩坑"一节。
- **局限**：样本量小，P90 波动较大；基线 Qwen3-235B 和 Qwen3-32B 的耗时都包含约 150 ms 的跨区网络往返（拆解见 4.4 节）；内容质量没有经过人工评审。

## 实验结果

### 提示词结构决定成本

先看一次稳态请求的输入 token 都去了哪里。以静态部分最长的场景 C 为例：

<BarChart
  title="图 1　场景 C 稳态单次请求的输入 token 构成"
  :series="tokenSeries"
  :groups="tokenGroups"
  unit=" token"
  caption="eu-central-1 Global，effort low，取稳态调用（去掉每组第 1 次）的平均值，三段之和就是平均输入 token 数。asis 在另一轮测试中同样几乎全部是缓存写入，图中只画 strands。行尾为按单价折算的输入费用，不含输出。"
/>

asis 和 strands 把整段提示词都写进缓存，却一次也读不到；opt_implicit 读到了静态前缀，但每次还要写一遍变化的部分；opt_explicit 读静态前缀，变化部分按普通输入计费。

再看四个场景的整体费用。下图把每种结构的稳态单次费用，除以同一组调用完全不用缓存时的费用：

<BarChart
  title="图 2　稳态单次费用 ÷ 不用缓存时的费用"
  :series="[{ label: '费用倍数' }]"
  :groups="ratioGroups"
  unit="×"
  :digits="2"
  :ref-line="{ value: 1, label: '不用缓存（= 1.00×）' }"
  caption='eu-central-1 Global，稳态。"不用缓存"是用同一组调用的 usage，把输入全部按未缓存单价重新计算的费用。超过虚线的结构比不用缓存还贵。'
/>

图 2 是每种结构和它自己"不用缓存"时的费用相比，各结构的输入大小并不完全一样。场景 A 最明显：asis / strands 的稳态平均输入约 4,050 token，opt 结构约 2,880 token。两者的差别只在词表字典的序列化方式上：原模板开着 autoescape，会把 Python dict 里的引号转成 `&#39;`；opt 结构改用 `json.dumps` 输出（见"踩坑记录"）。

::: details 数据表：稳态缓存读取占比 / 稳态单次费用
数据来自 eu-central-1 Global，effort 用各场景的默认值：

| 场景 | asis | strands | opt_implicit | **opt_explicit** | 基线（A：Qwen3-235B；B、C、D：Qwen3-32B） |
|---|---|---|---|---|---|
| A（none） | 59.5% / $0.000521 | 59.5% / $0.000517 | 98.5% / $0.000129 | **97.6% / $0.000135** | $0.001084 |
| B（low） | 0% / $0.000937 | 0% / $0.000934 | 94.0% / $0.000253 | **94.0% / $0.000222** | $0.000566 |
| C（low） | 0% / $0.002138 | 0% / $0.002228 | 80.2% / $0.001059 | **80.2% / $0.000961** | $0.001181 |
| D（low） | 0% / $0.001228 | 0% / $0.001230 | 68.2% / $0.000811 | **68.2% / $0.000784** | $0.000611 |
:::

- **asis 和 strands**：B、C、D 每次调用都把整段提示词按 1.25 倍价格写入缓存，读取为 0，比完全不用缓存还贵 12% 到 21%。A 只在同一会话的后续轮次能读到前一轮写入的缓存，每开一个新会话就要重写。
- **opt_explicit**：静态前缀只在第 1 次写入，之后每次都读。稳态读取占比正好等于静态前缀在稳态输入中的占比（静态前缀 token / 稳态调用的平均输入 token）：A 2,813 / 2,883，B 3,072 / 3,267，C 4,753 / 5,923，D 1,757 / 2,576。
- **opt_implicit**：读取量和 opt_explicit 相同，但每次还会额外写入变化的那部分，所以通常略贵。B 的首 token 时间还多了约 350 ms（714 ms 对 367 ms）。
- **冷启动成本**：首次写入的费用是 A $0.00077，C、D 在 $0.0010 到 $0.0022 之间。持续有流量时，这部分成本摊到每次调用上可以忽略。

### reasoning effort：`none` 对比 `low`

数据来自 eu-central-1 Global、opt_explicit 结构、顺序调用：

| 场景 | effort | 首 token P50 | 总耗时 P50 | 平均输出（其中推理） | 稳态单次费用 | 变化 |
|---|---|---|---|---|---|---|
| B | low | 367 ms | 549 ms | 117 (46) | $0.000222 | — |
| B | none | 327 ms | 500 ms | 55 (0) | $0.000165 | -26% |
| C | low | 1,109 ms | 2,584 ms | 540 (192) | $0.000961 | — |
| C | none | 381 ms | 1,694 ms | 352 (0) | $0.000751 | -22% |
| D | low | 1,258 ms | 2,392 ms | 467 (169) | $0.000784 | — |
| D | none | 413 ms | 1,506 ms | 306 (0) | $0.000569 | -27% |

- 把三个接入目标都算上，`none` 相比 `low` 的费用降幅在 19% 到 39% 之间。长输出场景的首 token 快 0.7 到 1.2 s。
- **可用率基本不变**：C 两档都是 47/48；D 的 low 为 48/48，none 为 47/48，多出的 1 次是模型回复了模板允许的拒答。
- **输出结构相近**：C 的平均步骤数 6.5 对 6.4，平均列表项数 8.3 对 8.9，描述长度 253 对 243 字符。
- **结果一致**：B 在 6 个用例 × 3 个目标上，提取的参数与 `low` 和 Qwen3-32B 都是 18/18 一致。
- 这些只说明"能用、形状一样"，不能证明内容质量一样好。上线前仍然需要人工评审。

### 接入区域

三个接入目标在同一场景下的稳态缓存读取占比完全一样，所以缓存效果和接入目标无关。价格上，US Geo 的单价比 Global 贵 10%。剩下的差别在耗时，下一节单独拆解。

### 耗时拆解：网络往返与模型响应

先在服务所在的 eu-central-1 机器上探测各端点的网络，取中位数：

| 端点 | DNS | TCP 建连 | TLS 握手 | HTTP 往返（复用连接） | 新建一条连接合计 |
|---|---|---|---|---|---|
| bedrock-runtime eu-central-1 | 0.5 ms | 3.9 ms | 2.7 ms | **3.0 ms** | 约 7 ms |
| bedrock-runtime us-east-1 | 0.7 ms | 94.1 ms | 93.6 ms | **93.8 ms** | 约 188 ms |
| bedrock-runtime us-west-2（Qwen3-235B / Qwen3-32B 所在区域） | 0.7 ms | 148.2 ms | 145.8 ms | **151.2 ms** | 约 295 ms |

然后把每次调用的耗时拆成两段：

- **首 token**：从发出请求到收到第一段可见文本。减去一次网络往返，剩下的部分近似为服务端从收到请求到吐出第一个 token 的时间，包括排队、路由和 prefill。
- **生成**：总耗时 P50 减去首 token P50，近似为可见 token 的流式输出阶段。这样定义之后，网络往返、服务端到首 token、生成三段相加正好等于总耗时 P50。

口径：Luna 取 opt_explicit 结构加 effort `none`，顺序和并发合并，每格 16 次；基线（A 为 Qwen3-235B，B、C、D 为 Qwen3-32B）取顺序调用，每格 5 次。所有数据都排除了首次建连的调用，也就是全部走复用连接。P50 和全文其他表格一样按 nearest-rank 取值（排序后取第 ⌈n/2⌉ 个）。B 场景的数据来自同一天的另一轮测试，那一轮探测到的 HTTP 往返与上表相差不到 1 ms。

<BarChart
  title="图 3　单次调用耗时拆解（P50）"
  :series="latencySeries"
  :groups="latencyGroups"
  unit=" ms"
  caption="Luna 为 opt_explicit + effort none，每行 16 次；Qwen3-235B（A）和 Qwen3-32B（B、C、D）每行 5 次；全部走复用连接。服务端到首 token = 首 token P50 − 一次网络往返；生成 = 总耗时 P50 − 首 token P50。三段之和等于行尾的总耗时 P50。"
/>

图里最显眼的是：同一场景下，"生成"段在三个 Luna 目标上几乎一样长；跨洋接入多出来的时间全部堆在"服务端到首 token"段上，"网络往返"段只占其中一小部分。

::: details 数据表：首 token、生成和总耗时 P50
**首 token P50**（括号里是减去一次网络往返后的值，单位 ms）：

| 场景 | eu-central-1 Global<br>往返 3 ms | us-east-1 US Geo<br>往返 94 ms | us-east-1 Global<br>往返 94 ms | 基线 us-west-2<br>A：Qwen3-235B；B、C、D：Qwen3-32B<br>往返 151 ms |
|---|---|---|---|---|
| A | **378**（375） | 632（538） | 629（535） | 722（571） |
| B | **341**（339） | 738（644） | 705（611） | 713（562） |
| C | **381**（378） | 720（626） | 728（634） | 778（627） |
| D | **362**（359） | 617（524） | 631（537） | 561（409） |

**生成耗时与总耗时 P50**（生成 = 总耗时 P50 − 首 token P50，单位 ms）：

| 场景 | 可见输出 P50（Luna / 基线，token） | eu-central-1 Global | us-east-1 US Geo | us-east-1 Global | 基线 us-west-2<br>A：Qwen3-235B；B、C、D：Qwen3-32B |
|---|---|---|---|---|---|
| A | 约 50 / 60 | 200 / **578** | 201 / 833 | 194 / 823 | 254 / 976 |
| B | 62 / 106 | 184 / **525** | 185 / 923 | 183 / 888 | 80 / 793 |
| C | 约 350 / 420 | 1,440 / **1,821** | 1,385 / 2,105 | 1,338 / 2,066 | 1,438 / 2,216 |
| D | 约 300 / 347 | 1,161 / **1,523** | 1,022 / 1,640 | 1,131 / 1,762 | 1,234 / 1,795 |

每格是"生成 / 总耗时"。Qwen3-235B 和 Qwen3-32B 的 token 数用的是 Qwen3 自己的分词器，和 Luna 的不能直接比较。
:::

可以得出几点：

- **生成阶段和接入区域无关。** 同一场景下，三个 Luna 目标的生成耗时相差不到 150 ms，不到生成耗时的 15%。C、D 两个长输出场景里，eu-central-1 的生成段反而略长，所以跨洋接入并没有让生成变慢。区域差异主要体现在首 token 上。
- **跨洋多出的时间比网络往返多得多。** 从 us-east-1 接入时，首 token 比 eu-central-1 晚约 250 到 400 ms，但两地的往返只差约 90 ms。减去往返之后，服务端部分仍然多出约 150 到 300 ms。这部分时间都花在收到响应头之前（Luna 从收到响应头到第一段可见文本的间隔，在三个目标上都是 100 ms 左右）。从客户端看不出它具体花在哪里，可能和 Global / Geo 推理的内部路由有关，本文不做推断。
- **us-east-1 的 US Geo 和 Global 没有一致的快慢差别**，各场景互有高低，差距在噪声范围内。
- **新建连接的成本会放大跨洋差距。** 上面的数据都走复用连接。Strands 1.65 的 `OpenAIResponsesModel` 在没有注入 client 时，每次请求都会新建并关闭一个 `AsyncOpenAI`（见源码中的 `_get_client`），所以每次调用都要重新做 DNS、TCP 和 TLS。按探测值推算，同区域每次多约 7 ms，可以忽略；跨洋到 us-east-1 每次还要再多约 190 ms。这个数是推算值，测试中没有直接测量。
- **扣掉网络之后，Luna 的首 token 仍然比基线快。** 同区域的 Luna 和减去往返后的基线（A 为 Qwen3-235B，B、C、D 为 Qwen3-32B）相比，首 token 快约 50 到 250 ms，D 场景（对 Qwen3-32B）的差距最小。如果假设把这两个 Qwen3 模型也部署到同区域只会省掉往返差（约 150 ms），它们的总耗时估算约为 A 830、B 650、C 2,070、D 1,650 ms，仍然高于 Luna，D 场景只差约 120 ms。基线每格只有 5 个样本，这几个差值只能看大小方向。Qwen3-235B 和 Qwen3-32B 在 eu-central-1 能否使用、实际耗时多少，本文都没有测试。
- **响应头不适合用来跨模型比较。** Qwen3-235B 和 Qwen3-32B 走 ConverseStream，响应头和第一个 token 几乎同时到达；Luna 走 Responses API，响应头比第一段可见文本早约 100 ms。所以上表比较的是首 token，不是响应头。

### 并发

10 路并发、静态前缀已经预热时，用 eu-central-1 Global 加 opt_explicit 测得：

| 场景 | 稳态缓存读取 | 首 token P50 | 总耗时 P50 | 可用 |
|---|---|---|---|---|
| A | 99.5% | 378 ms | 585 ms | 10/10 |
| B（none） | 94.1% | 344 ms | 526 ms | 10/10 |
| C（none） | 79.9% | 378 ms | 1,834 ms | 10/10 |
| D（none） | 67.5% | 358 ms | 1,523 ms | 10/10 |

显式断点的命中在并发下保持稳定，耗时和顺序调用相当，全程没有出现限流。作为对照，A 用隐式缓存（asis）并发时，三个目标的读取占比在 22% 到 44% 之间，说明隐式缓存的命中有随机性。

### 与 Qwen3-235B / Qwen3-32B 基线对比

推荐配置为 eu-central-1 Global、opt_explicit、effort `none`。

<BarChart
  title="图 4　稳态每千次调用费用：GPT-5.6 Luna 对比 Qwen3-235B / Qwen3-32B 基线"
  :series="[{ label: '每千次调用费用' }]"
  :groups="costGroups"
  caption="Luna 为推荐配置；基线为原线上模型，A 是 Qwen3-235B，B、C、D 是 Qwen3-32B（us-west-2，无缓存）。静态前缀占比即稳态缓存读取占比。"
/>

静态前缀占比越高、输出越短，降幅越大。详细数据见下表，这里是顺序调用的数据（每组 6 次，含首次建连），所以耗时和 4.4 节的口径略有不同：

| 场景 | 基线模型 | 静态前缀占比 | Luna 平均输出 | 稳态单次费用（Luna / 基线） | 费用 | 总耗时 P50（Luna / 基线） | 首 token P50（Luna / 基线） |
|---|---|---|---|---|---|---|---|
| A | Qwen3-235B | 97.6% | 54 token | $0.000135 / $0.001084 | -88% | 574 / 976 ms | 377 / 722 ms |
| B | Qwen3-32B | 94.0% | 55 token | $0.000165 / $0.000566 | -71% | 500 / 793 ms | 327 / 703 ms |
| C | Qwen3-32B | 80.2% | 352 token | $0.000751 / $0.001181 | -36% | 1,694 / 2,079 ms | 381 / 749 ms |
| D | Qwen3-32B | 68.2% | 306 token | $0.000569 / $0.000611 | -7% | 1,506 / 1,562 ms | 413 / 557 ms |

A 的基线耗时和 B 的基线总耗时与 4.4 节相同，这不是沿用了 4.4 节的数据。原因是这几组里首次建连的那次调用比中位数慢，去掉它之后 nearest-rank P50 仍然落在同一次调用上。C、D 的首次调用比中位数快，所以两节的数值不同。

- **A 场景的降幅里约有 2 个百分点来自输入变短**：opt 结构改用 `json.dumps` 序列化词表字典，输入比原模板少约 1,160 token（见 4.1 节）。这部分 token 本来就在缓存前缀里，按缓存读取价（$0.02 / 百万 token）计费。按此估算，不改序列化时 A 的稳态单次费用约为 $0.000158，降幅从约 87.5% 变为约 85.4%，影响很小。
- **生成速度**：按逐次调用计算，即可见输出 token ÷（总耗时 − 首 token），只统计输出不少于 100 token 的调用，取 P50。推荐配置下 Luna 在 C 场景约 255 token/s，在 D 场景约 270 token/s；Qwen3-32B 在 C、D 场景合计约 340 token/s（基线里只有这两个场景的输出不少于 100 token）。Luna 慢约 20% 到 25%。Luna 的总耗时仍然更低，原因是首 token 快、网络近。
- **价格结构**：Luna 输出单价 $1.20 / 百万 token，是 B、C、D 原用的 Qwen3-32B（$0.60）的 2 倍。所以输出越长的场景，降本空间越小。D 场景在 effort `low` 时反而比 Qwen3-32B 贵约 28%。A 场景原来用的是更贵的 Qwen3-235B，而且输出很短，所以降幅最大。
- **基线的口径**：Qwen3-235B 和 Qwen3-32B 的耗时都包含约 150 ms 的跨区网络往返。扣除网络之后 Luna 仍然更快，但 D 场景的差距只剩约 120 ms，详见 4.4 节。

## 示例：在 Strands 中实现显式断点

### 为什么默认实现不够用

我对照 Strands 1.65.0 的源码确认了以下几点：

- `OpenAIResponsesModel` 只把 system 提示词作为纯字符串放进 `instructions`，会忽略 `system_prompt_content`，所以没法在 system 上打断点。
- 消息里的 `{"cachePoint": ...}` 内容块会被跳过。1.47.0 更严格，遇到这种块会直接抛 `TypeError`。
- `CacheConfig(strategy="auto")` 会把断点打在每条 user 消息的最后一个内容块上，并切换到 explicit 模式。对于"静态 system 加每次不同的 user 输入"这种单轮调用，写进缓存的总是包含本次输入的整段内容，下次读不到。这就是上面实验里 `strands` 一列的结果。
- 1.65.0 的 `bedrock_mantle_config` 新增了 `endpoint="bedrock-runtime"` 选项，会把 base URL 拼成 `https://bedrock-runtime.{region}.amazonaws.com/openai/v1`，并在每次请求时用 `aws-bedrock-token-generator` 基于标准 AWS 凭证链生成短期 token。1.47.0 只支持 mantle 端点。
- 1.65.0 会把 usage 中的 `cached_tokens` 和 `cache_write_tokens` 分别映射为 `cacheReadInputTokens` 和 `cacheWriteInputTokens`。1.47.0 只映射了读取。

### 子类：把 system 的 cachePoint 转成断点

思路是沿用 Strands 在 `BedrockModel` 上表达 system 缓存的方式：`system_prompt=[{"text": ...}, {"cachePoint": ...}, ...]`。子类把这种内容块列表翻译成一条带 `prompt_cache_breakpoint` 的 developer 消息。

```python
# luna_model.py —— 依赖 strands-agents[openai]==1.65.0
import contextvars
from typing import Any

from strands.models.openai_responses import OpenAIResponsesModel

MAX_BREAKPOINTS = 4
_SYSTEM_BLOCKS: contextvars.ContextVar = contextvars.ContextVar("system_blocks", default=None)


def _developer_message(blocks: list[dict]) -> dict:
    """[{"text"}, {"cachePoint"}, ...] -> developer 消息；cachePoint 标在它前一个文本块上。"""
    parts: list[dict] = []
    for block in blocks:
        if "text" in block:
            parts.append({"type": "input_text", "text": block["text"]})
        elif "cachePoint" in block:
            if not parts:
                raise ValueError("cachePoint must follow a text block")
            breakpoint_ = {"mode": "explicit"}
            ttl = (block.get("cachePoint") or {}).get("ttl")
            if ttl in ("30m", "12h"):
                breakpoint_["ttl"] = ttl
            parts[-1]["prompt_cache_breakpoint"] = breakpoint_
    if sum("prompt_cache_breakpoint" in p for p in parts) > MAX_BREAKPOINTS:
        raise ValueError(f"at most {MAX_BREAKPOINTS} cache breakpoints per request")
    return {"role": "developer", "content": parts}


class CachedResponsesModel(OpenAIResponsesModel):
    """system 中有 cachePoint 时改用带显式断点的 developer 消息；否则行为与父类一致。"""

    async def stream(self, messages, tool_specs=None, system_prompt=None, **kwargs: Any):
        # Strands 会把 system 内容块通过 system_prompt_content 传进来，父类不使用它
        token = _SYSTEM_BLOCKS.set(kwargs.get("system_prompt_content"))
        try:
            async for event in super().stream(messages, tool_specs, system_prompt, **kwargs):
                yield event
        finally:
            try:
                _SYSTEM_BLOCKS.reset(token)
            except ValueError:  # 生成器在其他 context 中被关闭
                pass

    def _format_request(self, messages, tool_specs=None, system_prompt=None, tool_choice=None,
                        model_state=None, agent_metadata=None, **kwargs: Any) -> dict:
        blocks = _SYSTEM_BLOCKS.get()
        if not blocks or not any("cachePoint" in b for b in blocks):
            return super()._format_request(messages, tool_specs, system_prompt, tool_choice,
                                           model_state, agent_metadata, **kwargs)
        request = super()._format_request(messages, tool_specs, None, tool_choice,
                                          model_state, agent_metadata, **kwargs)
        request["input"] = [_developer_message(blocks)] + list(request["input"])
        return request
```

`_format_request` 是父类的内部方法，以后版本可能变化。升级 Strands 时要用下面的离线方法重新检查一遍请求结构。

### 创建模型与调用

```python
from strands import Agent

model = CachedResponsesModel(
    bedrock_mantle_config={"endpoint": "bedrock-runtime", "region": "eu-central-1"},
    model_id="global.openai.gpt-5.6-luna",
    params={
        "reasoning": {"effort": "none"},
        "max_output_tokens": 4096,
        "prompt_cache_key": "my-service:extractor:v1",               # ≤ 64 字符
        "prompt_cache_options": {"mode": "explicit", "ttl": "30m"},  # Strands 会把它移到 extra_body
    },
)  # 不要设置 cache_config，否则 Strands 还会在 user 消息上再打一组断点

system_blocks = [
    {"text": STATIC_RULES},              # 所有请求都相同：规则、示例、输出格式
    {"cachePoint": {"type": "default"}},
    {"text": DICTIONARY_JSON},           # 很少变化的数据，序列化必须字节稳定
    {"cachePoint": {"type": "default"}},
    {"text": retrieved_context},         # 每次请求都不同，放在最后，不打断点
]
agent = Agent(model=model, callback_handler=None, system_prompt=system_blocks)
result = agent(user_query)
usage = result.metrics.agent_invocations[-1].usage   # 含 cacheReadInputTokens / cacheWriteInputTokens
```

模型实例按"同一套静态前缀"粒度在进程内复用即可。Agent 每次请求新建一个，这样对话状态不会在请求之间共享。

### 离线检查请求结构

给模型注入一个假的 OpenAI 客户端，只记录 `responses.create` 的参数，不发出请求，就可以在没有网络和凭证的情况下检查请求长什么样：

```python
from strands import Agent

captured = []

class StopRequest(Exception):
    pass

class FakeResponses:
    async def create(self, **request):
        captured.append(request)
        raise StopRequest()                   # 记下参数后立即中止，不发出请求

model._bedrock_mantle_config = None       # 测试替身：跳过 token 生成
model._custom_client = type("C", (), {"responses": FakeResponses()})()

agent = Agent(model=model, callback_handler=None,
              system_prompt=system_blocks)    # 与上一节相同的内容块列表
try:
    agent("test")
except Exception:                         # StopRequest，Strands 也可能包装后再抛出
    pass
assert captured, "没有记录到请求"
request = captured[0]
```

`_bedrock_mantle_config` 和 `_custom_client` 也是父类的内部属性，和 `_format_request` 一样，升级 Strands 后要确认它们还在。记录到的 `request` 关键部分如下：

```json
{
  "model": "global.openai.gpt-5.6-luna",
  "input": [
    {"role": "developer", "content": [
      {"type": "input_text", "text": "STATIC RULES", "prompt_cache_breakpoint": {"mode": "explicit"}},
      {"type": "input_text", "text": "DICTIONARY", "prompt_cache_breakpoint": {"mode": "explicit"}},
      {"type": "input_text", "text": "per-request context"}
    ]},
    {"role": "user", "content": [{"type": "input_text", "text": "..."}]}
  ],
  "reasoning": {"effort": "none"},
  "prompt_cache_key": "my-service:extractor:v1",
  "store": false,
  "extra_body": {"prompt_cache_options": {"mode": "explicit", "ttl": "30m"}}
}
```

可以看到请求里没有 `instructions` 字段。两个静态块带断点，最后的变化块不带。

## 踩坑记录

| 现象 | 原因 / 结论 | 做法 |
|---|---|---|
| 只把模型 ID 换成 Luna，费用反而升高 | 变化内容在前缀里，隐式缓存每次都按 1.25 倍价格全量写入，下次读不到 | 按"静态在前、变化在后"重排提示词，并打显式断点 |
| 用了 Strands 默认 `CacheConfig` 也不省钱 | 断点打在 user 消息末尾，写入的内容包含每次都变的输入 | 用子类把断点打在 system 静态块上 |
| HTTP 400 `Invalid 'prompt_cache_key': string too long` | 服务端限制 key 不超过 64 字符 | key 用 `<服务>:<功能>:v<版本>` 这样的短名，或者对长名称取哈希 |
| HTTP 400 `Unsupported parameter: 'temperature'` | effort 不是 `none` 时不接受 temperature/top_p | 两者只能二选一 |
| 前缀"看起来一样"却不命中 | 模板 autoescape 输出 Python dict 时把引号转成了 `&#39;`，而且列表顺序取决于上游接口返回的顺序 | 先排序，再用 `json.dumps(..., sort_keys=True, ensure_ascii=False)` 序列化后传入模板 |
| 做对比测试时，us-east-1 的首次调用就有缓存读取 | 现象：同一账号下，几乎同时向 eu-central-1 Global 和 us-east-1（US Geo / Global）发出完全相同的提示词，晚到几十毫秒的 us-east-1 请求在首次调用时就出现了缓存读取。每组加上独立标记和独立 key 之后，这些首次调用的读取占比变为 0%。看起来像是缓存在不同接入区域之间共享，但 AWS 没有公开说明缓存的作用范围，这可能和 Global / Geo 推理的实际路由有关，本文无法确认 | 做对比测试时，每组在提示词开头加独立标记并使用独立 key，不要假设缓存一定隔离或一定共享。有数据驻留要求时，Global 推理的实际推理区域需要另行核实 |
| 升级 Strands 后有测试失败 | 1.65.0 在 `BedrockModel.__init__` 里新增了两个实例属性，用 `object.__new__` 绕过 `__init__` 构造对象的测试替身会缺少它们 | 在测试里补齐这两个属性，或者改为通过 `__init__` 构造 |
| 构建时 `Could not find a version that satisfies the requirement openai==3.55.0` | 构建用的 pip 镜像晚于 PyPI 同步 | 选镜像上已有的版本（3.52.0）。我确认过这个版本具备 `prompt_cache_key`、`prompt_cache_options`、`prompt_cache_breakpoint` 和 `cache_write_tokens` |
| 输出偶尔多了代码块标记或 `\{...\}` | 模型在约定的标签后面输出了 Markdown 代码块，或者写成 `\{...\}`。实测频率很低，主要出现在隐式模式下 | 解析前去掉代码块标记，并把 `\{` `\}` 还原成普通括号 |

## 总结

接入检查清单：

1. 走 `bedrock-runtime` 的 Responses API，模型 ID 用 `global.openai.gpt-5.6-luna`（只需美国境内推理时用 `us.`），推理区域和服务部署在同一区域。
2. Strands 1.65 以上版本用 `OpenAIResponsesModel` 加本文的子类，不要依赖默认的 `CacheConfig`。
3. 提示词按"静态规则、半静态数据、每次变化的内容"排列，前两段各打一个断点，并使用 explicit 模式。静态前缀不少于 1,024 token，序列化要字节稳定。
4. 每套静态前缀用一个固定的 `prompt_cache_key`，长度不超过 64 字符，不要带用户 ID 或会话 ID。
5. effort 默认用 `none`。只有质量评测证明需要时才升档，升档后就不能再传 temperature/top_p。
6. 每次调用记录缓存读、缓存写、推理 token 数和首 token 时间。健康状态是：稳态读取占比接近静态前缀的占比，每个前缀每 30 分钟左右只写入 1 次。

在本文的四个场景里，按上面的方式接入后，稳态单次费用比原来的 Qwen3-235B（A）和 Qwen3-32B（B、C、D）低 7% 到 88%，P50 耗时也更低。降幅取决于两件事：静态前缀在输入里占多大比例，以及输出有多长。静态前缀占 97.6%、输出约 50 token 的 A 场景降了 88%；静态前缀占 68.2%、输出约 300 token 的 D 场景只降了 7%。在估算自己的场景之前，先算一下静态前缀的占比和平均输出长度。

## 参考资料

- [Amazon Bedrock：OpenAI 模型卡](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards-openai.html)（GPT-5.6 Luna 的端点、区域、价格、配额）
- [Introducing explicit prompt caching for OpenAI models on Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/introducing-explicit-prompt-caching-for-openai-gpt-5-6-models-on-amazon-bedrock/)
- [Groundhog Day for AI agents: Prompt caching patterns for using OpenAI models on Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/groundhog-day-for-ai-agents-prompt-caching-patterns-for-using-openai-models-on-amazon-bedrock/)
- [Inference endpoints supported by Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/endpoints.html)
- [strands-agents 1.65.0（PyPI）](https://pypi.org/project/strands-agents/1.65.0/)：`strands/models/openai_responses.py`、`strands/models/_openai_bedrock.py`、`strands/models/bedrock.py`
