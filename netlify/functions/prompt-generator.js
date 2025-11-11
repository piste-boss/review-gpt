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

const sanitizeStringList = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((entry) => sanitizeString(entry)).filter(Boolean)
}

const sanitizeUserProfile = (profile = {}) => ({
  storeName: sanitizeString(profile.storeName),
  storeKana: sanitizeString(profile.storeKana),
  industry: sanitizeString(profile.industry),
  customers: sanitizeString(profile.customers),
  strengths: sanitizeString(profile.strengths),
  keywords: sanitizeStringList(profile.keywords),
  excludeWords: sanitizeStringList(profile.excludeWords),
  nearStation: Boolean(profile.nearStation),
  admin: {
    name: sanitizeString(profile?.admin?.name),
    email: sanitizeString(profile?.admin?.email),
    password: sanitizeString(profile?.admin?.password),
  },
})

const sanitizeUserDataSettings = (settings = {}) => ({
  spreadsheetUrl: sanitizeString(settings.spreadsheetUrl),
  submitGasUrl: sanitizeString(settings.submitGasUrl),
  readGasUrl: sanitizeString(settings.readGasUrl),
})

const buildUserProfileSummary = (profile) => {
  if (!profile) return ''

  const sections = []
  const addSection = (label, value) => {
    const text = sanitizeString(value)
    if (!text) return
    sections.push(`${label}\n${text}`)
  }

  addSection('#ビジネス****', profile.industry)

  const nameParts = [profile.storeName, profile.storeKana].filter(Boolean)
  if (nameParts.length > 0) {
    addSection('#お店の名前', nameParts.join('/'))
  }

  addSection('#ターゲット層', profile.customers || profile.strengths)

  profile.keywords.slice(0, 5).forEach((keyword, index) => {
    addSection(`#MEOワード${index + 1}`, keyword)
  })

  profile.excludeWords.slice(0, 5).forEach((keyword, index) => {
    addSection(`#除外ワード${index + 1}`, keyword)
  })

  if (profile.nearStation) {
    addSection('#駅近', 'はい')
  }

  return sections.join('\n')
}

const extractSpreadsheetId = (url) => {
  if (!url) return ''
  const trimmed = url.trim()
  const patterns = [/\/d\/([a-zA-Z0-9-_]+)/i, /[?&]id=([a-zA-Z0-9-_]+)/i]
  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  return ''
}

const mergeUserProfiles = (baseProfile, overrideProfile) => {
  if (!overrideProfile) return baseProfile
  const base = sanitizeUserProfile(baseProfile)
  const override = sanitizeUserProfile(overrideProfile)
  const pickArray = (baseArray, overrideArray) =>
    Array.isArray(overrideArray) && overrideArray.length > 0 ? overrideArray : baseArray

  return {
    storeName: override.storeName || base.storeName,
    storeKana: override.storeKana || base.storeKana,
    industry: override.industry || base.industry,
    customers: override.customers || base.customers,
    strengths: override.strengths || base.strengths,
    keywords: pickArray(base.keywords, override.keywords),
    excludeWords: pickArray(base.excludeWords, override.excludeWords),
    nearStation: override.nearStation || base.nearStation,
    admin: {
      name: override.admin?.name || base.admin?.name || '',
      email: override.admin?.email || base.admin?.email || '',
      password: override.admin?.password || base.admin?.password || '',
    },
  }
}

const buildReadGasRequestUrl = (
  baseUrl,
  { spreadsheetId, spreadsheetUrl, userDataSpreadsheetId, userDataSpreadsheetUrl, storeName },
) => {
  try {
    const url = new URL(baseUrl)
    if (spreadsheetId) {
      url.searchParams.set('spreadsheetId', spreadsheetId)
    } else if (spreadsheetUrl) {
      url.searchParams.set('spreadsheetUrl', spreadsheetUrl)
    }
    if (userDataSpreadsheetId) {
      url.searchParams.set('userDataSpreadsheetId', userDataSpreadsheetId)
    }
    if (userDataSpreadsheetUrl) {
      url.searchParams.set('userDataSpreadsheetUrl', userDataSpreadsheetUrl)
    }
    if (storeName) {
      url.searchParams.set('storeName', storeName)
    }
    url.searchParams.set('source', 'prompt-generator')
    return url.toString()
  } catch {
    const params = []
    if (spreadsheetId) {
      params.push(`spreadsheetId=${encodeURIComponent(spreadsheetId)}`)
    } else if (spreadsheetUrl) {
      params.push(`spreadsheetUrl=${encodeURIComponent(spreadsheetUrl)}`)
    }
    if (userDataSpreadsheetId) {
      params.push(`userDataSpreadsheetId=${encodeURIComponent(userDataSpreadsheetId)}`)
    }
    if (userDataSpreadsheetUrl) {
      params.push(`userDataSpreadsheetUrl=${encodeURIComponent(userDataSpreadsheetUrl)}`)
    }
    if (storeName) {
      params.push(`storeName=${encodeURIComponent(storeName)}`)
    }
    params.push('source=prompt-generator')
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${params.length ? `${separator}${params.join('&')}` : ''}`
  }
}

const requestUserDataFromGas = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json,text/plain;q=0.8,*/*;q=0.5',
        ...(options.headers || {}),
      },
      ...options,
    })

    if (!response.ok) {
      return { ok: false, status: response.status }
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => ({}))
      const text = sanitizeString(payload.text || payload.body || payload.content || '')
      const profile =
        payload && typeof payload.profile === 'object' ? sanitizeUserProfile(payload.profile) : null
      return { ok: true, text, profile }
    }

    const text = sanitizeString(await response.text())
    return { ok: true, text, profile: null }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

const fetchUserContextFromReadGas = async (settings = {}, storeName = '') => {
  const readGasUrl = sanitizeString(settings.readGasUrl)
  if (!readGasUrl) {
    return { text: '', profile: null }
  }

  const spreadsheetUrl = sanitizeString(settings.spreadsheetUrl)
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl)
  const userDataSpreadsheetId = spreadsheetId
  const userDataSpreadsheetUrl = spreadsheetUrl
  const normalizedStoreName = sanitizeString(storeName)
  const queryPayload = {
    spreadsheetId,
    spreadsheetUrl,
    userDataSpreadsheetId,
    userDataSpreadsheetUrl,
    storeName: normalizedStoreName,
  }

  const getUrl = buildReadGasRequestUrl(readGasUrl, queryPayload)
  const getResult = await requestUserDataFromGas(getUrl, { method: 'GET' })
  if (getResult.ok) {
    return { text: getResult.text, profile: getResult.profile }
  }

  const postBody = JSON.stringify({
    ...queryPayload,
    source: 'prompt-generator',
  })

  const postResult = await requestUserDataFromGas(readGasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: postBody,
  })

  if (postResult.ok) {
    return { text: postResult.text, profile: postResult.profile }
  }

  console.error('prompt-generator: failed to fetch user context from read GAS', {
    status: getResult.status || postResult.status,
    getError: getResult.error,
    postError: postResult.error,
  })

  return { text: '', profile: null }
}

const buildInstruction = ({
  basePrompt,
  referenceText,
  currentPrompt,
  userProfileSummary,
  externalUserNotes,
}) => {
  const sections = [basePrompt || DEFAULT_GENERATOR_PROMPT]

  if (userProfileSummary) {
    sections.push(`ユーザー情報:\n${userProfileSummary}`)
  }

  if (externalUserNotes) {
    sections.push(`ユーザー情報（読み取りGAS）:\n${externalUserNotes}`)
  }

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
  const requestedPromptKey = sanitizeString(payload.promptKey)
  const promptKey = resolvePromptKey(requestedPromptKey, tier)
  const clientUserContext =
    payload && typeof payload.userContext === 'object' && payload.userContext
      ? payload.userContext
      : null
  const clientUserContextText = sanitizeString(clientUserContext?.text)
  const clientUserContextFetched = Boolean(clientUserContext?.fetched)

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
  const userDataSettings = sanitizeUserDataSettings(storedConfig.userDataSettings || {})
  const storedUserProfile = sanitizeUserProfile(storedConfig.userProfile)
  let externalUserNotes = ''
  let externalProfile = null
  if (clientUserContextFetched) {
    externalUserNotes = clientUserContextText
  } else {
    const userContext = await fetchUserContextFromReadGas(userDataSettings, storedUserProfile.storeName)
    externalUserNotes = userContext.text
    externalProfile = userContext.profile
  }
  const mergedUserProfile = mergeUserProfiles(storedUserProfile, externalProfile)
  const userProfileSummary = buildUserProfileSummary(mergedUserProfile)

  const instruction = buildInstruction({
    basePrompt,
    referenceText,
    currentPrompt,
    userProfileSummary,
    externalUserNotes,
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
