import { createStore } from './_lib/store.js'

const CONFIG_KEY = 'router-config'
const DEFAULT_MODEL = 'gemini-1.5-flash-latest'
const DEFAULT_GENERATOR_PROMPT =
  'あなたは口コミ生成AIのプロンプトを設計するアシスタントです。参考文面や既存の指示を踏まえ、AIが口コミ文章を生成するための新しいプロンプトを1本だけ返してください。'

const PROMPT_KEY_BY_TIER = {
  beginner: 'page1',
  intermediate: 'page2',
  advanced: 'page3',
}

const VALID_PROMPT_KEYS = new Set(['page1', 'page2', 'page3'])

const PROMPT_TIER_LABELS = {
  light: 'ライトプラン',
  standard: 'スタンダードプラン',
  platinum: 'プラチナプラン',
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

const buildInstruction = ({ basePrompt, tierLabel, referenceText, currentPrompt }) => {
  const sections = [
    basePrompt || DEFAULT_GENERATOR_PROMPT,
    `ターゲット: ${tierLabel}`,
  ]

  if (referenceText) {
    sections.push(`参考文面:\n${referenceText}`)
  }

  if (currentPrompt) {
    sections.push(`現在のプロンプト:\n${currentPrompt}`)
  }

  sections.push(
    '出力条件:\n' +
      '1. 日本語で 1 本のプロンプトのみを返すこと。\n' +
      '2. 箇条書きや余計な補足、引用符は付けず、純粋な文章で返すこと。\n' +
      '3. AI が口コミ文章を生成するときに必要なトーン、長さ、構成の指示を含めること。',
  )

  return sections.filter(Boolean).join('\n\n')
}

export const config = {
  blobs: true,
}

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
    }
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'POSTメソッドのみ利用できます。' })
  }

  let payload = {}
  if (event.body) {
    try {
      payload = JSON.parse(event.body)
    } catch {
      return jsonResponse(400, { message: 'JSON形式が正しくありません。' })
    }
  }

  const requestedTier = sanitizeString(payload.tier).toLowerCase()
  const tier = ['light', 'standard', 'platinum'].includes(requestedTier) ? requestedTier : 'light'
  const tierLabel = PROMPT_TIER_LABELS[tier] || 'ライトプラン'
  const requestedPromptKey = sanitizeString(payload.promptKey)
  const promptKey = resolvePromptKey(requestedPromptKey, tier)

  const store = createStore(undefined, context)
  const storedConfig = (await store.get(CONFIG_KEY, { type: 'json' }).catch(() => null)) || {}
  const promptGeneratorConfig = storedConfig.promptGenerator || {}
  const geminiApiKey = sanitizeString(promptGeneratorConfig.geminiApi)

  if (!geminiApiKey) {
    return jsonResponse(400, { message: 'プロンプトジェネレーターのGemini APIキーが設定されていません。' })
  }

  const basePrompt = sanitizeString(promptGeneratorConfig.prompt) || DEFAULT_GENERATOR_PROMPT
  const references = promptGeneratorConfig.references || {}
  const referenceText =
    sanitizeString(references[tier]) ||
    sanitizeString(references.light || references.standard || references.platinum || '')

  const promptsConfig = storedConfig.prompts || {}
  const currentPrompt = sanitizeString(promptsConfig[promptKey]?.prompt)

  const instruction = buildInstruction({
    basePrompt,
    tierLabel,
    referenceText,
    currentPrompt,
  })

  const model = sanitizeString(storedConfig.aiSettings?.model) || DEFAULT_MODEL
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`

  try {
    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: instruction }],
          },
        ],
      }),
    })

    const responsePayload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const errorMessage =
        responsePayload?.error?.message || 'Gemini APIから有効なレスポンスを取得できませんでした。'
      return jsonResponse(response.status, { message: errorMessage })
    }

    const generatedPrompt = extractTextFromGemini(responsePayload)
    if (!generatedPrompt) {
      return jsonResponse(502, { message: 'Gemini APIからプロンプトが返されませんでした。' })
    }

    return jsonResponse(200, { prompt: generatedPrompt })
  } catch (error) {
    console.error('Prompt generator failed:', error)
    return jsonResponse(500, { message: 'プロンプトジェネレーターの呼び出しに失敗しました。' })
  }
}
