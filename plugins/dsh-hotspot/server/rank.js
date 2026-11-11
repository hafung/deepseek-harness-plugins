// Scoring and selection for Hotspot's daily top 30.
//
// A deterministic signal model runs first. When a default DSH model is
// available, the top candidates are then re-ranked by that model and its
// reasons/categories are kept; any failure simply falls back to the signal
// model so a bad model call never leaves the page empty.

export const CATEGORIES = [
  { id: 'ai', label: 'AI 前沿' },
  { id: 'tech', label: '科技' },
  { id: 'business', label: '商业' },
  { id: 'science', label: '科学' },
  { id: 'security', label: '安全' },
  { id: 'world', label: '全球' },
  { id: 'culture', label: '文化' },
]

export const CATEGORY_IDS = new Set(CATEGORIES.map(category => category.id))

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(category => [category.id, category.label]))

const CATEGORY_CAPS = {
  ai: 16,
  tech: 9,
  business: 4,
  science: 3,
  security: 3,
  world: 4,
  culture: 2,
}

const AI_RE = /(?:\bAI\b|\bA\.I\.|\bLLMs?\b|\bGPT(?:-[\w.]+)?\b|\bClaude\b|\bGemini\b|\bDeepSeek\b|\bOpenAI\b|\bAnthropic\b|\bHugging\s?Face\b|\bMeta\s+AI\b|\bMistral\b|\bQwen\b|\bLlama\b|\bCopilot\b|\bAGI\b|\bRAG\b|\bdiffusion\b|\bmultimodal\b|\bneural\b|\btransformer\b|\bagents?\b|人工智能|大模型|智能体|机器学习|深度学习|生成式|多模态|算力|模型(?:发布|上线|开源|训练)|具身智能|世界模型)/i
const SECURITY_RE = /(?:\bsecurity\b|\bvulnerab\w*|\bbreach\w*|\bhack(?:ed|ing|er)?\b|\bmalware\b|\bransomware\b|\bzero[- ]?day\b|\bexploits?\b|\bCVE-\d+|\bcyber\w*|\bphishing\b|\bpasskey\b|网络安全|安全漏洞|漏洞|勒索|攻击|黑客|数据泄露|钓鱼)/i
const BUSINESS_RE = /(?:\bfunding\b|\braises?\b|\braised\b|\bSeries [A-F]\b|\bIPO\b|\bacquisitions?\b|\bacquires?\b|\bmerger\b|\bvaluation\b|\bearnings\b|\brevenue\b|\blayoffs?\b|\bstartups?\b|\bventure\b|\bstocks?\b|\bshares?\b|\bmarkets?\b|\bbonds?\b|\binvestors?\b|\btraders?\b|融资|收购|并购|估值|上市|财报|营收|裁员|创业|风投|市值|股价|股市)/i
const SCIENCE_RE = /(?:\bstud(?:y|ies)\b|\bresearchers?\b|\bscientists?\b|\bquantum\b|\bNASA\b|\bclimate\b|\bphysics\b|\bbiolog\w*|\bgenome\b|\bvaccine\b|\btelescope\b|\bspace\b|\bnuclear\b|\breactors?\b|\bfusion\b|\benergy\b|研究|科学家|量子|太空|气候|基因|物理|生物|疫苗|望远镜|航天|核能|反应堆|聚变|能源)/i
const WORLD_RE = /(?:\belections?\b|\bwar\b|\bUkraine\b|\bGaza\b|\bIsrael\b|\bTrump\b|\bgovernment\b|\bpolicy\b|\bregulat\w*|\bgeopolit\w*|\bsanctions?\b|\bNATO\b|\bcoup\b|选举|战争|冲突|政府|政策|监管|地缘|制裁|外交)/i
const CULTURE_RE = /(?:\bdesign\b|\bfilm\b|\bmusic\b|\bbooks?\b|\bculture\b|\bart\b|\btravel\b|\bfood\b|\bphotograph\w*|\bgam(?:e|es|ing)\b|\bstreaming\b|设计|电影|音乐|文化|艺术|旅行|美食|摄影|游戏)/i
const TECH_RE = /(?:\bsoftware\b|\bhardware\b|\bchip\w*|\bsemiconductor\w*|\bApple\b|\bGoogle\b|\bMicrosoft\b|\bAmazon\b|\bMeta\b|\bNvidia\b|\biPhone\b|\bAndroid\b|\bLinux\b|\bGitHub\b|\bdevelopers?\b|\bprogramming\b|\bcloud\b|\bopen[- ]source\b|技术|芯片|半导体|开发者|编程|云计算|开源)/i

const HIGH_SIGNAL_TITLES = new Set([
  'openai news', 'anthropic news', 'google deepmind news', 'deepseek',
  'hugging face - blog', 'simon willison\'s weblog', 'the batch',
  '量子位', '机器之心', '新智元', '36氪', '少数派', 'it之家',
  'financial times', 'the wall street journal · world', 'the economist',
  'bloomberg markets', 'the verge — news', 'ars technica', 'wired',
  'mit technology review', 'techcrunch', 'the guardian', 'bbc news — news',
  'nyt > technology', 'hacker news',
].map(value => value.toLowerCase()))

const SOURCE_AUTHORITY = {
  'top200': 4.2,
  ai: 3.4,
  'tech-media': 4.5,
  news: 3.2,
  research: 2.1,
  security: 2.5,
  'company-tech': 3.2,
  communities: 1.4,
  weeklies: 1.4,
  wechat: 1.5,
  manual: 4.8,
}

const HACKER_NEWS_RE = /^(?:Hacker News(?: -.*)?|Show HN|Ask HN)$/i
const PRIMARY_SOURCE_RE = /(?:OpenAI|Anthropic|Google DeepMind|Google AI|Google Research|Hugging Face|DeepSeek|Microsoft|Apple Machine Learning|NVIDIA|Meta AI|AWS|Amazon Science|Databricks|Stripe|Cloudflare|GitHub|JetBrains|Supabase|Vercel|Figma|Notion|Canva|Slack|Spotify|Airbnb|Etsy|Elastic|Rust Blog|Mozilla|智谱|月之暗面|Kimi|腾讯混元|通义实验室|阶跃|MiniMax|百度|阿里|字节|蚂蚁|商汤|旷视|科大讯飞)/i
const CHINESE_SECONDARY_RE = /(?:IT之家|36氪|虎嗅|钛媒体|爱范儿|机器之心|量子位|新智元|少数派|蓝点网|InfoQ|站长之家|FreeBuf|安全客|雷峰网|品玩|极客公园|差评|智东西|硅星人|晚点|财新|界面|澎湃|第一财经|新浪科技|网易科技|腾讯科技|搜狐科技|凤凰科技|观察者网|DoNews|TechWeb|快科技|中关村在线|CSDN|开源中国|电脑报|手机中国|太平洋电脑网|SuperTechFans|HackerNews每日摘要)/i

const SIGNAL_TERMS = [
  [/(?:\blaunch(?:es|ed|ing)?\b|\breleas(?:e|es|ed|ing)\b|\bunveil\w*|\bannounc\w*|\bintroduc\w*|\bdebut\w*|发布|推出|上线|亮相|宣布|开源)/i, 7.5],
  [/(?:\bbreakthrough\b|\bfirst\b|\brecord\b|\bexclusive\b|\bconfirmed\b|\bwins?\b|\bbeats?\b|\bsurpass\w*|突破|首次|刷新|纪录|独家|确认|超越|拿下)/i, 7],
  [/(?:\bfunding\b|\braises?\b|\bIPO\b|\bacquisition\b|\bmerger\b|\bvaluation\b|\bearnings\b|融资|收购|并购|上市|财报|估值)/i, 7],
  [/(?:\bvulnerab\w*|\bexploit\w*|\bbreach\w*|\bzero[- ]?day\b|漏洞|攻击|泄露|入侵)/i, 7],
  [/(?:\bregulat\w*|\bban(?:s|ned)?\b|\blawsuit\b|\bcourt\b|\bpolicy\b|监管|禁令|诉讼|法院|政策)/i, 5],
  [/(?:\bopen[- ]source\b|\bbenchmark\w*|\bSOTA\b|\bstate[- ]of[- ]the[- ]art\b|开源|基准|评测|登顶)/i, 4.5],
  [/(?:\bchip\w*|\bGPU\w*|\bsemiconductor\w*|\bdata cent(?:er|re)\w*|芯片|算力|数据中心)/i, 4],
]

const LOW_SIGNAL_RE = /(?:\brelease notes?\b|\bchangelog\b|\bcommits?\b|\bweekly\b|\bpodcast\b|\bnewsletter\b|\bhow to\b|\btutorial\b|\bbest\b|\bdeals?\b|\bcoupon\b|\bgiveaway\b|\bsponsored\b|\bpromo\b|发布说明|更新日志|播客|周刊|教程|促销|优惠|广告|抽奖)/i
const HARD_LOW_SIGNAL_RE = /(?:release notes from|recent commits to|commit history)/i
const PROMO_TITLE_RE = /(?:交流群|扫码|加入我们|添加.{0,6}(?:助手|微信|客服)|公众号|领取|福利|抽奖|报名|训练营|公开课|限时|优惠|促销|折扣|返现|开户|下载.{0,4}APP|欢迎关注|AICon|峰会|沙龙|论坛|直播|promo codes?|coupon|discount|deal of the day|% off|join (?:our|the) (?:group|community|newsletter)|sign up now|subscribe now|webinar|free trial)/i
const DIGEST_RE = /(?:早报|晚报|日报|午报|8点1氪|派早报|今日热点导览|一周要闻|周末读|top stories|roundup|digest|morning brief|daily brief)/i
const CREATOR_BOOST_RE = /(?:如何|为什么|背后|真相|揭秘|翻车|争议|失控|危机|裁员|涨薪|省钱|赚钱|副业|普通人|打工人|职场|教育|医疗|房价|消费|测评|实测|上手|体验|对比|教程|指南|清单|工具|提示词|手机|眼镜|耳机|机器人|人形|太空|芯片|算力|游戏|电影|AI\s*工具)/i
const CREATOR_DROP_RE = /(?:论文|基准|白皮书|协议|标准|财报|招股书|监管|诉讼|判决|弹劾|制裁|通胀|债券|利率|地缘|外交|法案|融资|并购|IPO|估值)/i

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[|｜·•—–\-:：,，.。!！?？'"“”‘’()[\]{}【】]/g, '')
    .trim()
}

export function titleKey(title) {
  const normalized = normalizeTitle(title)
  const length = Array.from(normalized).length
  if (length < 8) return ''
  return normalized.slice(0, 100)
}

export function categoryFor(article) {
  const title = String(article.title ?? '')
  const text = `${title} ${article.summary ?? ''}`
  const source = String(article.category ?? '')
  if (SECURITY_RE.test(text) || source === 'Security') return 'security'
  // Capital-markets stories stay under Business even when the company is an AI lab.
  if (BUSINESS_RE.test(title)) return 'business'
  if (AI_RE.test(text) || source === 'Artificial Intelligence') return 'ai'
  if (BUSINESS_RE.test(text) || source === 'Business & Startups') return 'business'
  if (SCIENCE_RE.test(title) || source === 'Research & Science') return 'science'
  if (WORLD_RE.test(title) || source === 'News') return 'world'
  if (CULTURE_RE.test(title) || source === 'Culture & Ideas' || source === 'Product & Design') return 'culture'
  if (TECH_RE.test(text) || ['Technology Media', 'Engineering & Technology', 'Communities', 'Personal Blogs'].includes(source)) return 'tech'
  return 'tech'
}

function sourceClass(article) {
  const title = String(article.sourceTitle ?? '')
  if (HACKER_NEWS_RE.test(title)) return 'hacker-news'
  if (PRIMARY_SOURCE_RE.test(title)) return 'primary'
  if (CHINESE_SECONDARY_RE.test(title)) return 'secondary-cn'
  if (String(article.language ?? '').toLowerCase().startsWith('zh')) return 'chinese-other'
  return 'other'
}

function sourceCap(kind) {
  if (kind === 'secondary-cn') return 2
  if (kind === 'primary' || kind === 'hacker-news') return 3
  return 2
}

function sourceAuthority(article) {
  const packs = Array.isArray(article.packs) ? article.packs : []
  let weight = 0
  for (const pack of packs) weight += SOURCE_AUTHORITY[pack] ?? 0
  if (HIGH_SIGNAL_TITLES.has(String(article.sourceTitle ?? '').toLowerCase())) weight += 5
  if (HARD_LOW_SIGNAL_RE.test(String(article.sourceTitle ?? ''))) weight -= 8
  if (/arxiv/i.test(String(article.sourceTitle ?? ''))) weight -= 5
  if (/hacker news - newest/i.test(String(article.sourceTitle ?? ''))) weight -= 3
  const kind = sourceClass(article)
  if (kind === 'primary') weight += 6
  else if (kind === 'hacker-news') weight += 5
  else if (kind === 'secondary-cn') weight -= 4
  else if (kind === 'chinese-other') weight -= 1
  return clamp(weight, -4, 22)
}

function topicScore(article) {
  const text = `${article.title ?? ''} ${article.summary ?? ''}`
  let score = 0
  if (AI_RE.test(text)) score += 8.5
  for (const [pattern, weight] of SIGNAL_TERMS) {
    if (pattern.test(text)) score += weight
  }
  if (LOW_SIGNAL_RE.test(text)) score -= 6.5
  if (HARD_LOW_SIGNAL_RE.test(text)) score -= 8
  if (DIGEST_RE.test(String(article.title ?? ''))) score -= 10
  if (PROMO_TITLE_RE.test(String(article.title ?? ''))) score -= 24
  if (String(article.title ?? '').length < 8) score -= 4
  return clamp(score, -30, 30)
}

function sourceDiversity(article) {
  const count = Array.isArray(article.sources) ? article.sources.length : 1
  return clamp((count - 1) * 7.5, 0, 22.5)
}

const CREATOR_SOURCE_BONUS = {
  'Technology Media': 7,
  'Artificial Intelligence': 4,
  Security: 7,
  'Research & Science': 2,
  News: 2,
  'Business & Startups': -3,
  'Engineering & Technology': 2,
  'Communities': 4,
  'Personal Blogs': 3,
  'Culture & Ideas': 5,
  'Product & Design': 5,
}

export function estimateCreatorScore(article) {
  const title = String(article.title ?? '')
  const summary = String(article.summary ?? '')
  const text = `${title} ${summary}`
  let score = 52
  if (CREATOR_BOOST_RE.test(text)) score += 12
  if (/(?:故事|人物|创业|团队|家庭|孩子|父母|年轻人|女性|县城|农村|出海|逆袭|焦虑|选择)/i.test(text)) score += 6
  if (CREATOR_DROP_RE.test(title)) score -= 9
  if (/(?:论文|基准|白皮书|协议|标准|财报|招股书)/i.test(text)) score -= 5
  score += CREATOR_SOURCE_BONUS[article.category] ?? 0
  if (article.image) score += 5
  if (summary.length >= 180) score += 4
  if ((Array.isArray(article.sources) ? article.sources.length : 1) > 1) score += 4
  if (/\d/.test(title)) score += 3
  if (Array.from(title).length >= 16 && Array.from(title).length <= 70) score += 2
  if ((article.category === 'business' || article.category === 'world') && !CREATOR_BOOST_RE.test(text)) score -= 4
  return clamp(Math.round(score), 26, 95)
}

export function estimateCreatorReason(article) {
  const text = `${article.title ?? ''} ${article.summary ?? ''}`
  if (/(?:如何|教程|指南|清单|方法|工具|提示词)/i.test(text)) return '适合做实用清单或教程'
  if (/(?:翻车|争议|失控|危机|裁员|暴涨|暴跌|真相|背后)/i.test(text)) return '冲突感强，适合观点解读'
  if (/(?:故事|人物|创业|团队|家庭|孩子|父母|年轻人|女性|县城|农村|出海|逆袭|焦虑)/i.test(text)) return '有人物和情绪入口，易共鸣'
  if (article.image) return '配图素材充足，适合图文'
  if ((Array.isArray(article.sources) ? article.sources.length : 1) > 1) return '多源热议，适合跟进'
  if (article.category === 'science') return '科普转译空间大'
  if (article.category === 'business') return '适合商业或职场号解读'
  if (article.category === 'security') return '安全话题容易引发关注'
  if (article.category === 'culture') return '文化话题适合深度展开'
  return '适合科技号快速解读'
}

export function scoreArticle(article, now = Date.now()) {
  const published = Number(article.publishedAt) || now
  const ageHours = Math.max(0, (now - published) / 3_600_000)
  const freshness = 36 * Math.exp(-ageHours / 26)
  const depth = clamp(String(article.summary ?? '').length / 55, 0, 7)
  const image = article.image ? 1.2 : 0
  const score = 18 + freshness + sourceAuthority(article) * 1.8 + topicScore(article)
    + sourceDiversity(article) + depth + image
  return {
    ...article,
    category: categoryFor(article),
    sourceKind: sourceClass(article),
    _score: Number(score.toFixed(2)),
  }
}

function diversify(scored, limit) {
  const picked = []
  const used = new Set()
  const counts = {}
  const languages = { zh: 0, en: 0, other: 0 }
  const sources = {}
  let secondaryCount = 0
  const languageOf = article => {
    const language = String(article.language ?? 'other').toLowerCase()
    return language.startsWith('zh') ? 'zh' : language.startsWith('en') ? 'en' : 'other'
  }
  const canTake = (article, enforceCategory) => {
    if (enforceCategory && (counts[article.category] ?? 0) >= (CATEGORY_CAPS[article.category] ?? 3)) return false
    const kind = article.sourceKind ?? sourceClass(article)
    if ((sources[article.sourceId] ?? 0) >= sourceCap(kind)) return false
    const language = languageOf(article)
    if (language === 'zh' && languages.zh >= 12) return false
    if (kind === 'secondary-cn' && secondaryCount >= 8) return false
    return true
  }
  const take = article => {
    const kind = article.sourceKind ?? sourceClass(article)
    counts[article.category] = (counts[article.category] ?? 0) + 1
    languages[languageOf(article)] += 1
    sources[article.sourceId] = (sources[article.sourceId] ?? 0) + 1
    if (kind === 'secondary-cn') secondaryCount += 1
    picked.push(article)
    used.add(article.id)
  }
  for (const article of scored) {
    if (picked.length >= limit) break
    if (!canTake(article, true)) continue
    take(article)
  }
  for (const article of scored) {
    if (picked.length >= limit) break
    if (used.has(article.id)) continue
    if (!canTake(article, false)) continue
    take(article)
  }
  return picked
}

function selectFinal(scored, limit) {
  return diversify(scored, limit)
}

export function heuristicRank(articles, { now = Date.now(), topN = 30 } = {}) {
  const scored = articles
    .filter(article => !PROMO_TITLE_RE.test(String(article.title ?? '')))
    .filter(article => !DIGEST_RE.test(String(article.title ?? '')))
    .map(article => scoreArticle(article, now))
    .sort((a, b) => b._score - a._score || b.publishedAt - a.publishedAt)
  return selectFinal(scored, topN)
}

function compactSummary(summary, max = 190) {
  const text = String(summary ?? '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(text)
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text
}

export function buildLlmPrompt(candidates, { now = Date.now(), topN = 30, windowHours = 72 } = {}) {
  const lines = [
    `今天是 ${new Date(now).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）。`,
    `你是「热点」的主编。下面是刚抓取、去重后的 ${candidates.length} 条候选资讯，均来自最近 ${windowHours} 小时。`,
    `请选出 ${topN} 条今天最值得知道的资讯，按价值从高到低排序。`,
    '',
    '价值判断标准：',
    '- 优先：AI 与前沿科技的重大进展，重要产品/模型发布，产业与资本大事，安全事件，重要科学发现，影响广泛的全球新闻。',
    '- 优先：信息增量大、一手来源、时效性强、多个信源共同关注、对从业者有实际影响。',
    '- 优先：公司/实验室官方博客、公告、论文、开发者文档，以及 Hacker News 发现的原站报道。',
    '- 中文媒体、公众号的二手转述最多 8 条，同一家中文媒体最多 2 条；不要把同一事件的多篇中文转述重复选入。',
    '- 避免：促销、教程、纯观点碎碎念、版本发布日志、单一来源的重复内容、标题党。',
    '- 保持必要的题材多样性；AI/科技可以占多数，但不要 30 条全部来自同一主题。',
    '',
    '每条还需要给出两个面向内容创作者的字段，它们与新闻价值独立，不要机械地等于 score：',
    '- creatorScore：0–100，衡量该条作为中文自媒体、公众号或短视频选题的适配度（讨论度、共鸣入口、叙事空间、可视化与标题化潜力）。',
    '- creatorReason：不超过 18 个字，说明具体选题角度，例如「适合职场号借势」「画面感强」「专业性强，受众窄」。',
    '不得为了流量夸大或改变事实。',
    '',
    '分类只能使用这些 id：',
    CATEGORIES.map(category => `${category.id}=${category.label}`).join('，'),
    '',
    '候选：',
  ]
  candidates.forEach((article, index) => {
    const time = new Date(article.publishedAt).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    })
    lines.push(`[${index + 1}] ${CATEGORY_LABELS[article.category] ?? article.category} | ${article.sourceTitle ?? ''} | ${time} | ${article.title}`)
    if (article.summary) lines.push(`摘要：${compactSummary(article.summary)}`)
  })
  lines.push('')
  lines.push('只输出一个 JSON 数组，不要 markdown，不要解释。数组元素格式：')
  lines.push('{"i":候选序号,"category":"分类id","score":0到100的整数,"reason":"不超过28字的中文入选理由","creatorScore":0到100的整数,"creatorReason":"不超过18字的选题角度"}')
  lines.push(`数组必须包含 ${topN} 个互不重复的元素，按重要性从高到低排列。`)
  return lines.join('\n')
}

export function parseLlmSelection(text) {
  const value = String(text ?? '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  if (!value) return []
  const start = value.indexOf('[')
  const end = value.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  const body = value.slice(start, end + 1)
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // A max-token finish can truncate the final object. Salvage every complete
    // object that still parses rather than throwing the whole ranking away.
  }
  const salvaged = []
  for (const match of body.matchAll(/\{[^{}]*\}/g)) {
    try {
      const entry = JSON.parse(match[0])
      if (entry && typeof entry === 'object') salvaged.push(entry)
    } catch {
      // Ignore the incomplete object.
    }
  }
  return salvaged
}

function cleanReason(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(text)
  return chars.length > 60 ? `${chars.slice(0, 60).join('')}…` : text
}

export function applyLlmSelection(candidates, selection, { fallback = [], topN = 30 } = {}) {
  const picked = []
  const used = new Set()
  const counts = {}
  const sourceCounts = {}
  const languages = { zh: 0, en: 0, other: 0 }
  let secondaryCount = 0
  const languageOf = article => {
    const language = String(article.language ?? 'other').toLowerCase()
    return language.startsWith('zh') ? 'zh' : language.startsWith('en') ? 'en' : 'other'
  }
  const canAccept = (article, category, enforceCategory) => {
    if (enforceCategory && (counts[category] ?? 0) >= (CATEGORY_CAPS[category] ?? 3)) return false
    const kind = article.sourceKind ?? sourceClass(article)
    if ((sourceCounts[article.sourceId] ?? 0) >= sourceCap(kind)) return false
    if (languageOf(article) === 'zh' && languages.zh >= 12) return false
    if (kind === 'secondary-cn' && secondaryCount >= 8) return false
    return true
  }
  const take = (article, category, extra = {}) => {
    const kind = article.sourceKind ?? sourceClass(article)
    counts[category] = (counts[category] ?? 0) + 1
    sourceCounts[article.sourceId] = (sourceCounts[article.sourceId] ?? 0) + 1
    languages[languageOf(article)] += 1
    if (kind === 'secondary-cn') secondaryCount += 1
    used.add(article.id)
    picked.push({ ...article, category, ...extra })
  }
  const accept = (entry, enforceCategory) => {
    if (picked.length >= topN) return
    const index = Number(entry?.i ?? entry?.index) - 1
    const article = candidates[index]
    if (!article || used.has(article.id)) return
    const category = CATEGORY_IDS.has(entry?.category) ? entry.category : article.category
    if (!canAccept(article, category, enforceCategory)) return
    const score = Number(entry?.score)
    const creatorScore = Number(entry?.creatorScore ?? entry?.creator_score)
    take(article, category, {
      _llmHeat: Number.isFinite(score) ? clamp(Math.round(score), 55, 99) : 0,
      creatorScore: Number.isFinite(creatorScore) ? clamp(Math.round(creatorScore), 20, 98) : undefined,
      creatorReason: cleanReason(entry?.creatorReason ?? entry?.creator_reason ?? ''),
      reason: cleanReason(entry?.reason),
    })
  }
  for (const entry of selection) accept(entry, true)
  // The model may have produced a complete, diverse list that the hard category
  // caps trimmed. Fill those slots from its own order before falling back to the
  // deterministic ranking, while still protecting the Chinese-secondary and
  // per-source limits.
  for (const entry of selection) accept(entry, false)
  for (const article of fallback) {
    if (picked.length >= topN) break
    if (used.has(article.id)) continue
    const category = CATEGORY_IDS.has(article.category) ? article.category : 'tech'
    if (!canAccept(article, category, false)) continue
    take(article, category, { reason: article.reason ?? '' })
  }
  return picked
}

export function finalizeRanking(items, { now = Date.now(), topN = 30, llm = false } = {}) {
  const limited = items.slice(0, topN)
  const scoredValues = limited.map(item => item._score).filter(Number.isFinite)
  const min = scoredValues.length ? Math.min(...scoredValues) : 0
  const max = scoredValues.length ? Math.max(...scoredValues) : 0
  let previousHeat = 100
  return limited.map((item, index) => {
    const relative = max > min ? (item._score - min) / (max - min) : 0.7
    const signalHeat = Math.round(62 + relative * 36)
    // When the AI provided the order, an item without an AI score is an
    // editorial fallback appended after the model's picks. Keep its displayed
    // signal below the model's lowest score instead of letting a high heuristic
    // raw score outrank its position.
    const fallbackHeat = Math.round(54 + relative * 7)
    const candidateHeat = item._llmHeat || (llm ? fallbackHeat : signalHeat)
    const heat = Math.min(candidateHeat, previousHeat)
    previousHeat = heat
    const reason = item.reason || (llm
      ? '高信号补充'
      : Array.isArray(item.sources) && item.sources.length > 1
        ? `${item.sources.length} 个信源同时关注`
        : item.category === 'ai'
          ? 'AI 前沿的重要增量'
          : '值得关注的高信号报道')
    const creatorScore = Number.isFinite(item.creatorScore) ? item.creatorScore : estimateCreatorScore(item)
    const creatorReason = item.creatorReason || estimateCreatorReason(item)
    return {
      id: item.id,
      rank: index + 1,
      title: item.title,
      url: item.url,
      summary: item.summary,
      sourceId: item.sourceId,
      sourceTitle: item.sourceTitle,
      sourceSite: item.sourceSite,
      author: item.author,
      publishedAt: item.publishedAt,
      fetchedAt: item.fetchedAt,
      category: item.category,
      categoryLabel: CATEGORY_LABELS[item.category] ?? '科技',
      language: item.language,
      heat,
      reason,
      creatorScore,
      creatorReason,
      coverage: Array.isArray(item.sources) ? item.sources.length : 1,
      sourceTitles: Array.isArray(item.sources) ? item.sources.map(source => source.title).slice(0, 5) : [],
      image: item.image || '',
      aiRanked: Boolean(item._llmHeat),
      aging: Boolean(item.publishedAt && now - item.publishedAt > 72 * 60 * 60 * 1000),
      updatedAt: now,
    }
  })
}

export async function rankArticles(articles, { now = Date.now(), topN = 30, llmRank } = {}) {
  const freshCutoff = now - 72 * 60 * 60 * 1000
  const extendedCutoff = now - 120 * 60 * 60 * 1000
  let windowHours = 72
  let heuristic = heuristicRank(
    articles.filter(article => (article.publishedAt || 0) >= freshCutoff),
    { now, topN: Math.max(topN * 4, 120) },
  )
  if (heuristic.length < topN) {
    // Only reach back past 72 hours when the fresh window cannot fill the
    // briefing. 120 hours is the absolute ceiling; old news never becomes
    // permanent furniture in the top 30.
    const extended = articles.filter(article => (article.publishedAt || 0) >= extendedCutoff)
    const extendedScored = heuristicRank(extended, { now, topN: Math.max(topN * 4, 120) })
    if (extendedScored.length > heuristic.length) {
      heuristic = extendedScored
      windowHours = 120
    }
  }
  if (typeof llmRank !== 'function' || heuristic.length === 0) {
    return {
      items: finalizeRanking(selectFinal(heuristic, topN), { now, topN, llm: false }),
      candidates: heuristic.length,
      llm: false,
      windowHours,
    }
  }
  const candidates = heuristic.slice(0, Math.min(64, heuristic.length))
  try {
    const selection = await llmRank(candidates, { now, topN, windowHours })
    const picked = applyLlmSelection(candidates, selection, { fallback: heuristic, topN })
    return {
      items: finalizeRanking(picked, { now, topN, llm: picked.some(item => item._llmHeat) }),
      candidates: heuristic.length,
      llm: true,
      windowHours,
    }
  } catch {
    return {
      items: finalizeRanking(selectFinal(heuristic, topN), { now, topN, llm: false }),
      candidates: heuristic.length,
      llm: false,
      windowHours,
    }
  }
}
