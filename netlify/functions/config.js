import { getConfigStore } from './_lib/store.js'

const CONFIG_KEY = 'router-config'

export const config = {
  blobs: true,
}

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '')

const DEFAULT_PROMPTS = {
  page1: { gasUrl: '', prompt: '' },
  page2: { gasUrl: '', prompt: '' },
  page3: { gasUrl: '', prompt: '' },
}

const DEFAULT_FORM1 = {
  title: '体験の満足度を教えてください',
  description: '星評価と設問にご協力ください。内容は生成されるクチコミのトーンに反映されます。',
  questions: [
    {
      id: 'form1-q1',
      title: '今回の満足度を教えてください',
      required: true,
      type: 'rating',
      allowMultiple: false,
      options: [],
      ratingEnabled: false,
      placeholder: '',
      ratingStyle: 'stars',
      includeInReview: true,
    },
    {
      id: 'form1-q2',
      title: '良かった点や印象に残ったことを教えてください',
      required: false,
      type: 'text',
      allowMultiple: false,
      options: [],
      ratingEnabled: false,
      placeholder: '例：スタッフの対応、雰囲気、味など',
      ratingStyle: 'stars',
      includeInReview: true,
    },
  ],
}

const DEFAULT_FORM2 = {
  title: '体験に関するアンケートにご協力ください',
  description: '該当する項目を選択してください。複数回答可の設問はチェックマークで選べます。',
  questions: [
    {
      id: 'form2-q1',
      title: '今回のご利用目的を教えてください',
      required: true,
      type: 'dropdown',
      allowMultiple: false,
      options: ['ビジネス', '観光', '記念日', 'その他'],
      ratingEnabled: false,
      placeholder: '',
      ratingStyle: 'stars',
      includeInReview: true,
    },
    {
      id: 'form2-q2',
      title: '特に満足したポイントを教えてください',
      required: false,
      type: 'checkbox',
      allowMultiple: true,
      options: ['スタッフの接客', '施設の清潔さ', 'コストパフォーマンス', '立地アクセス'],
      ratingEnabled: false,
      placeholder: '',
      ratingStyle: 'stars',
      includeInReview: true,
    },
  ],
}

const DEFAULT_FORM3 = {
  title: '詳細アンケートにご協力ください',
  description: '選択式と自由入力の設問で体験を詳しく共有してください。',
  questions: [
    {
      id: 'form3-q1',
      title: '担当スタッフの対応はいかがでしたか',
      required: true,
      type: 'rating',
      allowMultiple: false,
      options: [],
      ratingEnabled: false,
      placeholder: '',
      ratingStyle: 'stars',
      includeInReview: true,
    },
    {
      id: 'form3-q2',
      title: '特に印象に残ったポイントを教えてください',
      required: false,
      type: 'text',
      allowMultiple: false,
      options: [],
      ratingEnabled: false,
      placeholder: '例：雰囲気、メニュー、スタッフなど',
      ratingStyle: 'stars',
      includeInReview: true,
    },
  ],
}

const sanitizeBooleanFlag = (value, fallback = false) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return !Number.isNaN(value) && value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true
    if (['false', '0', 'off', 'no', ''].includes(normalized)) return false
  }
  if (value == null) return fallback
  return Boolean(value)
}

const sanitizeQuestionType = (value) => {
  if (value === 'checkbox') return 'checkbox'
  if (value === 'text') return 'text'
  if (value === 'rating') return 'rating'
  return 'dropdown'
}

const sanitizeRatingStyle = (value) => (value === 'numbers' ? 'numbers' : 'stars')

const sanitizeOptionsArray = (options) => {
  if (!Array.isArray(options)) return []
  return options
    .map((option) => sanitizeString(option))
    .filter((option) => option.length > 0)
}

const sanitizeFormQuestions = (questions, fallbackQuestions = []) => {
  if (!Array.isArray(questions)) return fallbackQuestions

  const sanitized = questions
    .map((question, index) => {
      const fallbackQuestion = fallbackQuestions[index] || {}
      const options = sanitizeOptionsArray(question?.options)
      const fallbackOptions = sanitizeOptionsArray(fallbackQuestion.options)

      const id =
        sanitizeString(question?.id) ||
        sanitizeString(fallbackQuestion.id) ||
        `survey-q-${index + 1}-${Date.now()}`

      const type = sanitizeQuestionType(question?.type || fallbackQuestion.type)
      const requiresOptions = type === 'dropdown' || type === 'checkbox'
      const normalizedOptions = requiresOptions
        ? options.length > 0
          ? options
          : fallbackOptions
        : []

      if (requiresOptions && normalizedOptions.length === 0) {
        return null
      }

      const ratingStyle =
        type === 'rating'
          ? sanitizeRatingStyle(question?.ratingStyle || fallbackQuestion.ratingStyle || 'stars')
          : 'stars'

      return {
        id,
        title: sanitizeString(question?.title || fallbackQuestion.title || `設問${index + 1}`),
        required: sanitizeBooleanFlag(question?.required, fallbackQuestion.required ?? true),
        type,
        allowMultiple:
          type === 'checkbox'
            ? sanitizeBooleanFlag(question?.allowMultiple, fallbackQuestion.allowMultiple ?? false)
            : false,
        options: normalizedOptions,
        ratingEnabled:
          type === 'rating'
            ? false
            : sanitizeBooleanFlag(question?.ratingEnabled, fallbackQuestion.ratingEnabled ?? false),
        ratingStyle,
        placeholder:
          type === 'text'
            ? sanitizeString(question?.placeholder ?? fallbackQuestion.placeholder ?? '')
            : '',
        includeInReview: sanitizeBooleanFlag(
          question?.includeInReview,
          fallbackQuestion.includeInReview ?? true,
        ),
      }
    })
    .filter(Boolean)

  return sanitized.length > 0 ? sanitized : fallbackQuestions
}

const DEFAULT_CONFIG = {
  labels: {
    beginner: '初級',
    intermediate: '中級',
    advanced: '上級',
  },
  tiers: {
    beginner: { links: [], nextIndex: 0 },
    intermediate: { links: [], nextIndex: 0 },
    advanced: { links: [], nextIndex: 0 },
  },
  aiSettings: {
    gasUrl: '',
    geminiApiKey: '',
    prompt: '',
    mapsLink: '',
    model: '',
  },
  prompts: DEFAULT_PROMPTS,
  branding: {
    faviconDataUrl: '',
  },
  form1: DEFAULT_FORM1,
  form2: DEFAULT_FORM2,
  form3: DEFAULT_FORM3,
  updatedAt: null,
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const jsonResponse = (statusCode, payload = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders,
  },
  body: JSON.stringify(payload),
})

const toClientConfig = (config) => ({
  ...config,
  aiSettings: {
    ...config.aiSettings,
    geminiApiKey: config.aiSettings?.geminiApiKey ? '******' : '',
    hasGeminiApiKey: Boolean(config.aiSettings?.geminiApiKey),
  },
})

const mergePrompts = (incoming = {}, fallback = DEFAULT_PROMPTS) =>
  Object.entries(DEFAULT_PROMPTS).reduce((acc, [key, defaults]) => {
    const incomingEntry = Object.prototype.hasOwnProperty.call(incoming, key) ? incoming[key] || {} : undefined
    const fallbackEntry = fallback[key] || defaults

    const gasUrl = Object.prototype.hasOwnProperty.call(incomingEntry || {}, 'gasUrl')
      ? sanitizeString(incomingEntry.gasUrl)
      : sanitizeString(fallbackEntry.gasUrl ?? defaults.gasUrl)

    const prompt = Object.prototype.hasOwnProperty.call(incomingEntry || {}, 'prompt')
      ? sanitizeString(incomingEntry.prompt)
      : sanitizeString(fallbackEntry.prompt ?? defaults.prompt)

    acc[key] = { gasUrl, prompt }
    return acc
  }, {})

const mergeWithDefault = (config = {}, fallback = DEFAULT_CONFIG) => {
  const mergedLabels = {
    ...DEFAULT_CONFIG.labels,
    ...(fallback.labels || {}),
    ...(config.labels || {}),
  }

  const mergedTiers = Object.entries(DEFAULT_CONFIG.tiers).reduce((acc, [tierKey, defaults]) => {
    const storedTier = (config.tiers && config.tiers[tierKey]) || (fallback.tiers && fallback.tiers[tierKey]) || {}
    acc[tierKey] = {
      links: Array.isArray(storedTier.links) ? storedTier.links : [],
      nextIndex: Number.isInteger(storedTier.nextIndex) ? storedTier.nextIndex % Math.max(storedTier.links?.length || 1, 1) : 0,
    }
    return acc
  }, {})

  const mergedAiSettings = {
    gasUrl: sanitizeString(config.aiSettings?.gasUrl ?? fallback.aiSettings?.gasUrl),
    geminiApiKey: sanitizeString(config.aiSettings?.geminiApiKey ?? fallback.aiSettings?.geminiApiKey),
    prompt: sanitizeString(config.aiSettings?.prompt ?? fallback.aiSettings?.prompt),
    mapsLink: sanitizeString(config.aiSettings?.mapsLink ?? fallback.aiSettings?.mapsLink),
    model: sanitizeString(config.aiSettings?.model ?? fallback.aiSettings?.model),
  }

  const mergedPrompts = mergePrompts(config.prompts, fallback.prompts)
  const mergedBranding = {
    faviconDataUrl: sanitizeString(config.branding?.faviconDataUrl ?? fallback.branding?.faviconDataUrl),
  }
  const mergeForm = (key, defaults) => ({
    title: sanitizeString(config[key]?.title ?? fallback[key]?.title ?? defaults.title),
    description: sanitizeString(config[key]?.description ?? fallback[key]?.description ?? defaults.description),
    questions: sanitizeFormQuestions(
      config[key]?.questions,
      fallback[key]?.questions ?? defaults.questions,
    ),
  })
  const mergedForm1 = mergeForm('form1', DEFAULT_FORM1)
  const mergedForm2 = mergeForm('form2', DEFAULT_FORM2)
  const mergedForm3 = mergeForm('form3', DEFAULT_FORM3)

  return {
    ...DEFAULT_CONFIG,
    ...fallback,
    labels: mergedLabels,
    tiers: mergedTiers,
    aiSettings: mergedAiSettings,
    prompts: mergedPrompts,
    branding: mergedBranding,
    form1: mergedForm1,
    form2: mergedForm2,
    form3: mergedForm3,
    updatedAt: config.updatedAt || fallback.updatedAt || DEFAULT_CONFIG.updatedAt,
  }
}

export const handler = async (event, context) => {
  const store = getConfigStore(context)

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
    }
  }

  if (event.httpMethod === 'GET') {
    const storedConfig = await store.get(CONFIG_KEY, { type: 'json' }).catch(() => null)
    const config = mergeWithDefault(storedConfig || DEFAULT_CONFIG)
    return jsonResponse(200, toClientConfig(config))
  }

  if (event.httpMethod === 'POST') {
    const storedConfig = await store.get(CONFIG_KEY, { type: 'json' }).catch(() => null)
    const existingConfig = mergeWithDefault(storedConfig || DEFAULT_CONFIG)

    if (!event.body) {
      return jsonResponse(400, { message: 'リクエストボディが空です。' })
    }

    let payload
    try {
      payload = JSON.parse(event.body)
    } catch {
      return jsonResponse(400, { message: 'JSON形式が正しくありません。' })
    }

    if (!payload || typeof payload !== 'object') {
      return jsonResponse(400, { message: '設定が見つかりません。' })
    }

    const newConfig = mergeWithDefault(payload, existingConfig)

    const incomingKey = sanitizeString(payload.aiSettings?.geminiApiKey)
    newConfig.aiSettings.geminiApiKey = incomingKey || existingConfig.aiSettings.geminiApiKey || ''
    const timestamp = new Date().toISOString()
    newConfig.updatedAt = timestamp

    // リンクが存在しないtierのnextIndexは常に0に戻す
    Object.values(newConfig.tiers).forEach((tier) => {
      if (!Array.isArray(tier.links) || tier.links.length === 0) {
        tier.links = []
        tier.nextIndex = 0
      } else {
        tier.nextIndex = Math.max(0, Math.min(tier.nextIndex, tier.links.length - 1))
      }
    })

    await store.set(CONFIG_KEY, JSON.stringify(newConfig), {
      contentType: 'application/json',
      metadata: { updatedAt: timestamp },
    })

    return jsonResponse(200, toClientConfig(newConfig))
  }

  return jsonResponse(405, { message: '許可されていないHTTPメソッドです。' })
}
