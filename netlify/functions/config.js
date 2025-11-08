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
  description: '星をタップして今回のサービスの満足度をお選びください。選択内容は生成されるクチコミのトーンに反映されます。',
  inputStyle: 'stars',
  reasonEnabled: false,
  reasonTitle: 'よろしければ理由をお聞かせ下さい',
  reasonDescription: '任意入力です。感じたことや具体的なポイントがあればご記入ください。',
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
  return 'dropdown'
}

const sanitizeOptionsArray = (options) => {
  if (!Array.isArray(options)) return []
  return options
    .map((option) => sanitizeString(option))
    .filter((option) => option.length > 0)
}

const sanitizeForm2Questions = (questions, fallbackQuestions = DEFAULT_FORM2.questions) => {
  if (!Array.isArray(questions)) return fallbackQuestions

  const sanitized = questions
    .map((question, index) => {
      const fallbackQuestion = fallbackQuestions[index] || DEFAULT_FORM2.questions[index] || {}
      const options = sanitizeOptionsArray(question?.options)
      const fallbackOptions = sanitizeOptionsArray(fallbackQuestion.options)

      const id =
        sanitizeString(question?.id) ||
        sanitizeString(fallbackQuestion.id) ||
        `form2-q-${index + 1}-${Date.now()}`

      const type = sanitizeQuestionType(question?.type || fallbackQuestion.type)
      const normalizedOptions =
        type === 'text' ? [] : options.length > 0 ? options : fallbackOptions

      if (type !== 'text' && normalizedOptions.length === 0) {
        return null
      }

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
        ratingEnabled: sanitizeBooleanFlag(question?.ratingEnabled, fallbackQuestion.ratingEnabled ?? false),
        placeholder: sanitizeString(question?.placeholder ?? fallbackQuestion.placeholder ?? ''),
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

const sanitizeInputStyle = (value) => (value === 'numbers' ? 'numbers' : 'stars')

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
  const mergedForm1 = {
    title: sanitizeString(config.form1?.title ?? fallback.form1?.title ?? DEFAULT_FORM1.title),
    description: sanitizeString(config.form1?.description ?? fallback.form1?.description ?? DEFAULT_FORM1.description),
    inputStyle: sanitizeInputStyle(config.form1?.inputStyle ?? fallback.form1?.inputStyle ?? DEFAULT_FORM1.inputStyle),
    reasonEnabled: sanitizeBooleanFlag(
      config.form1?.reasonEnabled,
      fallback.form1?.reasonEnabled ?? DEFAULT_FORM1.reasonEnabled,
    ),
    reasonTitle: sanitizeString(
      config.form1?.reasonTitle ?? fallback.form1?.reasonTitle ?? DEFAULT_FORM1.reasonTitle,
    ),
    reasonDescription: sanitizeString(
      config.form1?.reasonDescription ?? fallback.form1?.reasonDescription ?? DEFAULT_FORM1.reasonDescription,
    ),
  }
  const mergedForm2 = {
    title: sanitizeString(config.form2?.title ?? fallback.form2?.title ?? DEFAULT_FORM2.title),
    description: sanitizeString(config.form2?.description ?? fallback.form2?.description ?? DEFAULT_FORM2.description),
    questions: sanitizeForm2Questions(
      config.form2?.questions,
      fallback.form2?.questions ?? DEFAULT_FORM2.questions,
    ),
  }

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
