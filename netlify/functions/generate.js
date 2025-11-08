import { createStore } from './_lib/store.js'

const CONFIG_KEY = 'router-config'
const DEFAULT_MODEL = 'gemini-1.5-flash-latest'
const PROMPT_KEY_BY_TIER = {
  beginner: 'page1',
  intermediate: 'page2',
  advanced: 'page3',
}

const PROMPT_LABELS = {
  page1: '生成ページ1（初級）',
  page2: '生成ページ2（中級）',
  page3: '生成ページ3（上級）',
}

const VALID_PROMPT_KEYS = new Set(Object.keys(PROMPT_LABELS))

const resolvePromptKey = (value, tierValue) => {
  const normalizedValue = sanitizeString(value).toLowerCase()
  const normalizedTier = sanitizeString(tierValue).toLowerCase()

  if (VALID_PROMPT_KEYS.has(normalizedValue)) {
    return normalizedValue
  }
  if (PROMPT_KEY_BY_TIER[normalizedValue]) {
    return PROMPT_KEY_BY_TIER[normalizedValue]
  }
  if (PROMPT_KEY_BY_TIER[normalizedTier]) {
    return PROMPT_KEY_BY_TIER[normalizedTier]
  }

  return 'page1'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
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

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '')

const buildPrompt = (prompt, dataSamples) => {
  const basePrompt = prompt ||
    '次のアンケート回答を参考に、100〜200文字程度の口コミを丁寧な日本語で作成してください。語尾や表現は自然で温かみのあるものにしてください。'

  const formattedSamples = Array.isArray(dataSamples)
    ? dataSamples
        .map((item, index) => {
          if (typeof item === 'string') return `- サンプル${index + 1}: ${item}`
          if (item && typeof item === 'object') {
            return `- サンプル${index + 1}: ${Object.values(item)
              .filter((value) => value)
              .join(' / ')}`
          }
          return null
        })
        .filter(Boolean)
        .join('\n')
    : ''

  return `${basePrompt}\n\n参考データ:\n${formattedSamples}`
}

const extractTextFromGemini = (payload) => {
  const candidates = payload?.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return ''
  }

  const parts = candidates[0]?.content?.parts
  if (!Array.isArray(parts)) {
    return ''
  }

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim()
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
    }
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'POSTメソッドのみ利用できます。' })
  }

  let requestPayload = {}
  if (event.body) {
    try {
      requestPayload = JSON.parse(event.body)
    } catch {
      return jsonResponse(400, { message: 'JSON形式が正しくありません。' })
    }
  }

  const tierInput = sanitizeString(requestPayload.tier)
  const promptKey = resolvePromptKey(requestPayload.promptKey, tierInput)
  const promptLabel = PROMPT_LABELS[promptKey] || '生成ページ'

  const store = createStore()
  const config = (await store.get(CONFIG_KEY, { type: 'json' }).catch(() => null)) || {}
  const aiSettings = config.aiSettings || {}

  const geminiApiKey = sanitizeString(aiSettings.geminiApiKey)
  const mapsLink = sanitizeString(aiSettings.mapsLink)

  if (!geminiApiKey) {
    return jsonResponse(400, { message: 'Gemini APIキーが設定されていません。' })
  }

  const promptsConfig = config.prompts || {}
  const promptConfig = promptsConfig[promptKey] || {}
  const promptGasUrl = sanitizeString(promptConfig.gasUrl)
  const promptText = sanitizeString(promptConfig.prompt)

  const fallbackGasUrl = sanitizeString(aiSettings.gasUrl)
  const fallbackPrompt = sanitizeString(aiSettings.prompt)

  const gasUrl = promptGasUrl || fallbackGasUrl
  const promptForModel = promptText || fallbackPrompt

  if (!gasUrl) {
    return jsonResponse(400, { message: `${promptLabel} のGASアプリURLが設定されていません。` })
  }

  let dataSamples = []
  try {
    const gasResponse = await fetch(gasUrl)
    if (!gasResponse.ok) {
      throw new Error(`GASアプリの呼び出しに失敗しました (status: ${gasResponse.status}).`)
    }
    const contentType = gasResponse.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      dataSamples = await gasResponse.json()
    } else {
      const text = await gasResponse.text()
      dataSamples = text ? [text] : []
    }
  } catch (error) {
    console.error('Failed to retrieve GAS data:', error)
    return jsonResponse(500, { message: 'GASアプリからデータを取得できませんでした。' })
  }

  const requestModel = sanitizeString(event?.queryStringParameters?.model) || sanitizeString(aiSettings.model)
  const model = requestModel || DEFAULT_MODEL
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`

  const completePrompt = buildPrompt(promptForModel, Array.isArray(dataSamples) ? dataSamples.slice(0, 5) : [])

  try {
    const geminiResponse = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: completePrompt }],
          },
        ],
      }),
    })

    if (!geminiResponse.ok) {
      const errorPayload = await geminiResponse.json().catch(() => ({}))
      console.error('Gemini error payload:', errorPayload)
      const message =
        errorPayload?.error?.message || 'Gemini APIからエラーが返されました。設定を見直してください。'
      return jsonResponse(502, { message })
    }

    const geminiPayload = await geminiResponse.json()
    const generatedText = extractTextFromGemini(geminiPayload)

    if (!generatedText) {
      return jsonResponse(502, { message: 'Gemini APIから有効な文章が返されませんでした。' })
    }

    return jsonResponse(200, {
      text: generatedText,
      mapsLink,
      promptKey,
      prompts: {
        [promptKey]: {
          gasUrl: promptGasUrl,
          prompt: promptText,
        },
      },
      aiSettings: {
        mapsLink,
        model,
      },
    })
  } catch (error) {
    console.error('Failed to generate content via Gemini:', error)
    return jsonResponse(500, { message: '口コミ生成処理に失敗しました。' })
  }
}
