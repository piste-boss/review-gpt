import QRCode from 'qrcode'

const DEFAULT_LABELS = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
}

const DEFAULT_FAVICON_PATH = '/vite.svg'
const MAX_FAVICON_SIZE = 1024 * 1024 // 1MBまで

const CONFIG_CACHE_KEY = 'oisoya_review_config_cache'

const readCachedConfig = () => {
  try {
    const value = window.localStorage.getItem(CONFIG_CACHE_KEY)
    if (!value) return null
    return JSON.parse(value)
  } catch {
    return null
  }
}

const writeCachedConfig = (config) => {
  try {
    window.localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config))
  } catch {
    // noop
  }
}

let loadedConfig = null

const TIERS = [
  {
    key: 'beginner',
    defaultLabel: DEFAULT_LABELS.beginner,
    description: '初めての口コミ投稿におすすめのステップです。',
  },
  {
    key: 'intermediate',
    defaultLabel: DEFAULT_LABELS.intermediate,
    description: '撮影や投稿に慣れてきた方向けの質問セットです。',
  },
  {
    key: 'advanced',
    defaultLabel: DEFAULT_LABELS.advanced,
    description: '高い熱量でご協力いただけるお客さま向けのフルセットです。',
  },
]

const PROMPT_CONFIGS = [
  { key: 'page1', label: '生成ページ1（初級）' },
  { key: 'page2', label: '生成ページ2（中級）' },
  { key: 'page3', label: '生成ページ3（上級）' },
]

const DEFAULT_SURVEY_RESULTS = {
  spreadsheetUrl: '',
  endpointUrl: '',
  apiKey: '',
}

const DEFAULT_PROMPT_GENERATOR = {
  geminiApi: '',
  prompt: '',
  references: {
    light: '',
    standard: '',
    platinum: '',
  },
}

const DEFAULT_USER_PROFILE = {
  storeName: '',
  storeKana: '',
  industry: '',
  customers: '',
  strengths: '',
  keywords: [],
  excludeWords: [],
  nearStation: false,
  admin: {
    name: '',
    email: '',
    password: '',
  },
}

const DEFAULT_USER_DATA_SETTINGS = {
  spreadsheetUrl: '',
  submitGasUrl: '',
  readGasUrl: '',
}

let promptGeneratorData = {
  hasGeminiApi: false,
  prompt: '',
  references: {
    light: '',
    standard: '',
    platinum: '',
  },
}

const QR_PAGE_TARGETS = [
  { key: 'top', label: 'トップページ', path: '/' },
  { key: 'form1', label: 'アンケート1', path: '/form1/' },
  { key: 'form2', label: 'アンケート2', path: '/form2/' },
  { key: 'form3', label: 'アンケート3', path: '/form3/' },
]

const QR_SIZE_MAP = {
  s: { label: 'S', px: 256 },
  m: { label: 'M', px: 512 },
  l: { label: 'L', px: 1024 },
}

const QR_FORMATS = {
  png: { label: 'PNG', mime: 'image/png', extension: 'png' },
  jpg: { label: 'JPG', mime: 'image/jpeg', extension: 'jpg', quality: 0.92 },
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
  description: '選択式と自由入力で体験を詳しくお聞きします。わかる範囲でご回答ください。',
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
      placeholder: '例：店舗の雰囲気、サービス内容など',
      ratingStyle: 'stars',
      includeInReview: true,
    },
  ],
}

const SURVEY_FORM_DEFAULTS = {
  form1: DEFAULT_FORM1,
  form2: DEFAULT_FORM2,
  form3: DEFAULT_FORM3,
}

const QUESTION_TYPES = [
  { value: 'dropdown', label: 'ドロップダウン' },
  { value: 'checkbox', label: 'チェックボックス' },
  { value: 'text', label: 'テキスト入力' },
  { value: 'rating', label: '数字選択' },
]

const RATING_STYLES = [
  { value: 'stars', label: '星（★）' },
  { value: 'numbers', label: '数字（1〜5）' },
]

const normalizeQuestionType = (value) => {
  if (value === 'checkbox') return 'checkbox'
  if (value === 'text') return 'text'
  if (value === 'rating') return 'rating'
  return 'dropdown'
}

const normalizeRatingStyle = (value) => (value === 'numbers' ? 'numbers' : 'stars')

const createQuestionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `survey-q-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

const sanitizeOptionsList = (value) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const app = document.querySelector('#admin-app')
if (!app) {
  throw new Error('#admin-app が見つかりません。')
}

const appRole = app.dataset.appRole || 'user'
const isAdminApp = appRole === 'admin'
const isUserApp = appRole === 'user'

const form = app.querySelector('#config-form')
const statusEl = app.querySelector('[data-role="status"]')

if (!form || !statusEl) {
  throw new Error('管理画面の必須要素が見つかりません。')
}

const tabButtons = Array.from(app.querySelectorAll('[data-tab-target]'))
const tabPanels = Array.from(app.querySelectorAll('[data-tab-panel]'))

const qrControls = {
  page: form.elements.qrPage,
  size: form.elements.qrSize,
  format: form.elements.qrFormat,
  preview: app.querySelector('[data-role="qr-preview"]'),
  refreshButton: app.querySelector('[data-role="qr-refresh"]'),
  downloadButton: app.querySelector('[data-role="qr-download"]'),
}

const surveyResultsFields = {
  spreadsheetUrl: form.elements.surveySpreadsheetUrl,
  endpointUrl: form.elements.surveyEndpointUrl,
  apiKey: form.elements.surveyApiKey,
}

const userDataFields = {
  spreadsheetUrl: form.elements.userDataSpreadsheetUrl,
  submitGasUrl: form.elements.userDataSubmitGasUrl,
  readGasUrl: form.elements.userDataReadGasUrl,
}


const aiFields = {
  geminiApiKey: form.elements.geminiApiKey,
  mapsLink: form.elements.mapsLink,
  model: form.elements.model,
}

const promptFields = PROMPT_CONFIGS.map(({ key }) => ({
  key,
  gasUrl: form.elements[`prompt_${key}_gasUrl`],
  prompt: form.elements[`prompt_${key}_prompt`],
}))

const getPromptFieldByKey = (key) => promptFields.find((field) => field.key === key)

const USER_PROFILE_FIELD_COUNT = 5

const createProfileFieldArray = (prefix) =>
  Array.from({ length: USER_PROFILE_FIELD_COUNT }, (_, index) => form.elements[`${prefix}${index + 1}`])

const userProfileFields = {
  storeName: form.elements.profileStoreName,
  storeKana: form.elements.profileStoreKana,
  industry: form.elements.profileIndustry,
  customers: form.elements.profileCustomers,
  strengths: form.elements.profileStrengths,
  keywords: createProfileFieldArray('profileKeyword'),
  excludeWords: createProfileFieldArray('profileExcludeWord'),
  nearStation: form.elements.profileNearStation,
  nearStationStatus: app.querySelector('[data-role="profile-near-station-status"]'),
  admin: {
    name: form.elements.profileAdminName,
    email: form.elements.profileAdminEmail,
    password: form.elements.profileAdminPassword,
    passwordConfirm: form.elements.profileAdminPasswordConfirm,
    toggle: form.elements.profileAdminPasswordToggle,
    status: app.querySelector('[data-role="profile-admin-password-status"]'),
  },
}

const promptGeneratorFields = {
  geminiApi: form.elements.promptGeneratorGeminiApi,
  prompt: form.elements.promptGeneratorPrompt,
  references: {
    light: form.elements.promptGeneratorReferenceLight,
    standard: form.elements.promptGeneratorReferenceStandard,
    platinum: form.elements.promptGeneratorReferencePlatinum,
  },
}

const promptInsertButtons = Array.from(app.querySelectorAll('[data-role="prompt-insert"]'))
const promptPopover = {
  element: app.querySelector('[data-role="prompt-popover"]'),
  options: Array.from(app.querySelectorAll('[data-role="prompt-popover-option"]')),
  currentKey: null,
  anchor: null,
}

if (promptPopover.element && promptPopover.element.parentElement !== document.body) {
  document.body.appendChild(promptPopover.element)
}

const cloneQuestion = (question) => ({
  ...question,
  options: Array.isArray(question.options) ? [...question.options] : [],
  placeholder: typeof question.placeholder === 'string' ? question.placeholder : '',
})

const setElementHidden = (element, hidden) => {
  if (!element) return
  element.classList.toggle('is-hidden', hidden)
}

const setToggleStatusText = (target, checked) => {
  if (!target) return
  target.textContent = checked ? 'ON' : 'OFF'
}

const getCurrentUserDataSettings = () => ({
  ...DEFAULT_USER_DATA_SETTINGS,
  ...(loadedConfig?.userDataSettings || {}),
})

const hasUserDataSyncConfig = () => {
  const settings = getCurrentUserDataSettings()
  return Boolean(settings.submitGasUrl && settings.spreadsheetUrl)
}

const syncUserProfileExternally = async (profile) => {
  const settings = getCurrentUserDataSettings()
  if (!settings.submitGasUrl || !settings.spreadsheetUrl) {
    return { status: 'skipped' }
  }

  try {
    const response = await fetch('/.netlify/functions/user-data-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        origin: window.location.href,
        source: isUserApp ? 'user-app' : 'admin-app',
        submittedAt: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      const message =
        payload?.message || 'ユーザー情報の保存に失敗しました。時間をおいて再度お試しください。'
      return { status: 'error', message }
    }

    return { status: 'success' }
  } catch (error) {
    console.error('Failed to sync user profile:', error)
    return {
      status: 'error',
      message: 'ユーザー情報の保存に失敗しました。ネットワーク状況をご確認ください。',
    }
  }
}

const setPasswordFieldType = (field, type) => {
  if (!field) return
  try {
    field.type = type
  } catch {
    // noop
  }
}

const updateAdminPasswordVisibility = () => {
  if (!userProfileFields.admin) return
  const isVisible = Boolean(userProfileFields.admin.toggle?.checked)
  const targetType = isVisible ? 'text' : 'password'
  setPasswordFieldType(userProfileFields.admin.password, targetType)
  setPasswordFieldType(userProfileFields.admin.passwordConfirm, targetType)
  if (userProfileFields.admin.status) {
    setToggleStatusText(userProfileFields.admin.status, isVisible)
  }
}

const hasUserProfileInputs = () =>
  Boolean(
    userProfileFields.storeName ||
      userProfileFields.storeKana ||
      userProfileFields.industry ||
      userProfileFields.customers ||
      userProfileFields.strengths ||
      userProfileFields.keywords.some(Boolean) ||
      userProfileFields.excludeWords.some(Boolean) ||
      userProfileFields.nearStation ||
      (userProfileFields.admin &&
        (userProfileFields.admin.name ||
          userProfileFields.admin.email ||
          userProfileFields.admin.password ||
          userProfileFields.admin.passwordConfirm)),
  )

const setUserProfileValues = (profile = {}) => {
  if (!hasUserProfileInputs()) return
  const assign = (field, value = '') => {
    if (field) field.value = value || ''
  }

  assign(userProfileFields.storeName, profile.storeName)
  assign(userProfileFields.storeKana, profile.storeKana)
  assign(userProfileFields.industry, profile.industry)
  assign(userProfileFields.customers, profile.customers)
  assign(userProfileFields.strengths, profile.strengths)

  const keywords = Array.isArray(profile.keywords) ? profile.keywords : []
  userProfileFields.keywords.forEach((field, index) => {
    assign(field, keywords[index] || '')
  })

  const excludeWords = Array.isArray(profile.excludeWords) ? profile.excludeWords : []
  userProfileFields.excludeWords.forEach((field, index) => {
    assign(field, excludeWords[index] || '')
  })

  const nearStation = Boolean(profile.nearStation)
  if (userProfileFields.nearStation) {
    userProfileFields.nearStation.checked = nearStation
  }
  if (userProfileFields.nearStationStatus) {
    setToggleStatusText(userProfileFields.nearStationStatus, nearStation)
  }

  const adminProfile = profile.admin || DEFAULT_USER_PROFILE.admin
  assign(userProfileFields.admin?.name, adminProfile.name)
  assign(userProfileFields.admin?.email, adminProfile.email)
  assign(userProfileFields.admin?.password, adminProfile.password)
  assign(userProfileFields.admin?.passwordConfirm, adminProfile.password)
  if (userProfileFields.admin?.toggle) {
    userProfileFields.admin.toggle.checked = false
  }
  updateAdminPasswordVisibility()
}

const collectProfileListValues = (fields) =>
  fields
    .map((field) => (field?.value || '').trim())
    .filter(Boolean)

const getUserProfilePayload = () => {
  if (!hasUserProfileInputs()) {
    return { ...(loadedConfig?.userProfile || DEFAULT_USER_PROFILE) }
  }

  const getValue = (field) => (field?.value || '').trim()

  return {
    storeName: getValue(userProfileFields.storeName),
    storeKana: getValue(userProfileFields.storeKana),
    industry: getValue(userProfileFields.industry),
    customers: getValue(userProfileFields.customers),
    strengths: getValue(userProfileFields.strengths),
    keywords: collectProfileListValues(userProfileFields.keywords),
    excludeWords: collectProfileListValues(userProfileFields.excludeWords),
    nearStation: Boolean(userProfileFields.nearStation?.checked),
    admin: {
      name: getValue(userProfileFields.admin?.name),
      email: getValue(userProfileFields.admin?.email),
      password: getValue(userProfileFields.admin?.password),
    },
  }
}

const setPromptGeneratorValues = (config = {}) => {
  const references = config.references || {}
  const hasGeminiApi = Boolean(config.hasGeminiApi || config.hasPromptGeneratorGeminiApi)
  if (promptGeneratorFields.geminiApi) {
    if (hasGeminiApi) {
      promptGeneratorFields.geminiApi.value = ''
      promptGeneratorFields.geminiApi.placeholder =
        '登録済みのキーがあります。更新する場合は新しいキーを入力'
      promptGeneratorFields.geminiApi.dataset.registered = 'true'
    } else {
      promptGeneratorFields.geminiApi.value = config.geminiApi || ''
      promptGeneratorFields.geminiApi.placeholder = '例: AIza...'
      delete promptGeneratorFields.geminiApi.dataset.registered
    }
  }
  if (promptGeneratorFields.prompt) {
    promptGeneratorFields.prompt.value = config.prompt || ''
  }
  if (promptGeneratorFields.references.light) {
    promptGeneratorFields.references.light.value = references.light || ''
  }
  if (promptGeneratorFields.references.standard) {
    promptGeneratorFields.references.standard.value = references.standard || ''
  }
  if (promptGeneratorFields.references.platinum) {
    promptGeneratorFields.references.platinum.value = references.platinum || ''
  }
  promptGeneratorData = {
    hasGeminiApi,
    prompt: config.prompt || '',
    references: {
      light: references.light || '',
      standard: references.standard || '',
      platinum: references.platinum || '',
    },
  }
}

const getPromptGeneratorPayload = () => {
  const payload = {
    geminiApi: (promptGeneratorFields.geminiApi?.value || '').trim(),
    prompt: (promptGeneratorFields.prompt?.value || '').trim(),
    references: {
      light: (promptGeneratorFields.references.light?.value || '').trim(),
      standard: (promptGeneratorFields.references.standard?.value || '').trim(),
      platinum: (promptGeneratorFields.references.platinum?.value || '').trim(),
    },
  }
  promptGeneratorData = {
    hasGeminiApi: promptGeneratorData.hasGeminiApi || Boolean(payload.geminiApi),
    prompt: payload.prompt,
    references: { ...payload.references },
  }
  return payload
}

const hidePromptPopover = () => {
  if (!promptPopover.element) return
  promptPopover.element.hidden = true
  promptPopover.currentKey = null
  promptPopover.anchor = null
}

const showPromptPopover = (button, promptKey) => {
  if (!promptPopover.element) return
  const rect = button.getBoundingClientRect()
  promptPopover.element.style.top = `${window.scrollY + rect.bottom + 8}px`
  promptPopover.element.style.left = `${window.scrollX + rect.left}px`
  promptPopover.element.hidden = false
  promptPopover.currentKey = promptKey
  promptPopover.anchor = button
}

let promptGeneratorRequestInFlight = false

const requestPromptGeneration = async ({ tier, promptKey }) => {
  if (promptGeneratorRequestInFlight) {
    return null
  }
  promptGeneratorRequestInFlight = true
  setStatus('AIがプロンプトを生成しています…', 'info')
  try {
    const response = await fetch('/.netlify/functions/prompt-generator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, promptKey }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.message || 'AI入力に失敗しました。')
    }
    const generatedPrompt = typeof data.prompt === 'string' ? data.prompt.trim() : ''
    if (!generatedPrompt) {
      throw new Error('AIが有効なプロンプトを返しませんでした。')
    }
    setStatus('AI入力でプロンプトを挿入しました。', 'success')
    return generatedPrompt
  } catch (error) {
    console.error('Prompt generator error:', error)
    setStatus(error.message, 'error')
    return null
  } finally {
    promptGeneratorRequestInFlight = false
  }
}

const getQrPageConfig = (key) =>
  QR_PAGE_TARGETS.find((page) => page.key === key) || QR_PAGE_TARGETS[0]

const getQrSizeValue = (key) => {
  const size = QR_SIZE_MAP[key]
  return size ? size.px : QR_SIZE_MAP.m.px
}

const getQrFormatConfig = (key) => QR_FORMATS[key] || QR_FORMATS.png

const buildQrTargetUrl = (key) => {
  const page = getQrPageConfig(key)
  try {
    return new URL(page.path, window.location.origin).href
  } catch {
    return window.location.origin
  }
}

const qrPreviewState = {
  canvas: null,
}

const setQrPreviewMessage = (message) => {
  if (!qrControls.preview) return
  const text = document.createElement('p')
  text.textContent = message
  qrControls.preview.innerHTML = ''
  qrControls.preview.appendChild(text)
}

const renderQrPreview = async () => {
  if (!qrControls.preview) return null
  const pageKey = qrControls.page?.value || QR_PAGE_TARGETS[0].key
  const sizeKey = qrControls.size?.value || 'm'
  const targetUrl = buildQrTargetUrl(pageKey)
  const sizePx = getQrSizeValue(sizeKey)

  if (!qrPreviewState.canvas) {
    qrPreviewState.canvas = document.createElement('canvas')
    qrPreviewState.canvas.setAttribute('aria-label', 'QRコードプレビュー')
  }

  setQrPreviewMessage('QRコードを生成中です…')

  try {
    await QRCode.toCanvas(qrPreviewState.canvas, targetUrl, {
      width: sizePx,
      margin: 1,
      color: {
        dark: '#1f2a16',
        light: '#ffffff',
      },
    })
    qrControls.preview.innerHTML = ''
    qrControls.preview.appendChild(qrPreviewState.canvas)
    return { pageKey, sizeKey, sizePx, targetUrl }
  } catch (error) {
    console.error('Failed to render QR preview', error)
    setQrPreviewMessage('QRコードの生成に失敗しました。時間をおいてお試しください。')
    throw error
  }
}

const downloadQrCode = async () => {
  const pageKey = qrControls.page?.value || QR_PAGE_TARGETS[0].key
  const formatKey = qrControls.format?.value || 'png'
  const sizeKey = qrControls.size?.value || 'm'
  const targetUrl = buildQrTargetUrl(pageKey)
  const sizePx = getQrSizeValue(sizeKey)
  const format = getQrFormatConfig(formatKey)

  try {
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      width: sizePx,
      margin: 1,
      type: format.mime,
      quality: format.quality,
      color: {
        dark: '#1f2a16',
        light: '#ffffff',
      },
    })

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `qr-${pageKey}-${sizePx}.${format.extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()

    setStatus('QRコードをダウンロードしました。', 'success')
  } catch (error) {
    console.error('Failed to download QR code', error)
    setStatus('QRコードのダウンロードに失敗しました。時間をおいてお試しください。', 'error')
  }
}

const sanitizeSurveyQuestionsConfig = (questions, fallbackQuestions) => {
  const fallback = Array.isArray(fallbackQuestions) ? fallbackQuestions : []

  if (!Array.isArray(questions)) {
    return fallback.map((question) => cloneQuestion(question))
  }

  const sanitized = questions
    .map((question) => {
      const normalized = createSurveyQuestion(question)
      normalized.title = (normalized.title || '').trim()
      normalized.options = normalized.options.map((option) => option.trim()).filter(Boolean)

      const requiresOptions = normalized.type === 'dropdown' || normalized.type === 'checkbox'
      if (requiresOptions && normalized.options.length === 0) {
        return null
      }

      if (!requiresOptions) {
        normalized.options = []
      }

      if (normalized.type !== 'checkbox') {
        normalized.allowMultiple = false
      }

      if (normalized.type === 'rating') {
        normalized.ratingStyle = normalizeRatingStyle(normalized.ratingStyle)
      } else {
        normalized.ratingStyle = 'stars'
      }

      if (normalized.type !== 'text') {
        normalized.placeholder = ''
      }
      normalized.includeInReview = typeof normalized.includeInReview === 'boolean' ? normalized.includeInReview : true

      return normalized
    })
    .filter(Boolean)

  return sanitized.length > 0 ? sanitized : fallback.map((question) => cloneQuestion(question))
}

const createSurveyQuestion = (overrides = {}) => {
  const type = normalizeQuestionType(overrides.type)
  const optionsSource = Array.isArray(overrides.options) ? overrides.options : []
  const normalizedOptions = optionsSource.length > 0 ? optionsSource : ['選択肢1', '選択肢2']

  const question = {
    id: overrides.id || createQuestionId(),
    title: typeof overrides.title === 'string' ? overrides.title : '',
    required: typeof overrides.required === 'boolean' ? overrides.required : true,
    type,
    allowMultiple: type === 'checkbox' ? Boolean(overrides.allowMultiple) : false,
    options: normalizedOptions.map((option) => option.trim()).filter(Boolean),
    ratingEnabled: typeof overrides.ratingEnabled === 'boolean' ? overrides.ratingEnabled : false,
    placeholder: typeof overrides.placeholder === 'string' ? overrides.placeholder : '',
    ratingStyle: normalizeRatingStyle(overrides.ratingStyle),
    includeInReview: typeof overrides.includeInReview === 'boolean' ? overrides.includeInReview : true,
  }

  if (question.type !== 'text' && question.options.length === 0) {
    question.options = ['選択肢1']
  }

  if (question.type === 'text') {
    question.options = []
  }

  if (question.type !== 'rating') {
    question.ratingStyle = 'stars'
  }

  if (typeof question.includeInReview !== 'boolean') {
    question.includeInReview = true
  }

  return question
}

function createSurveyFormManager({ key, fields, questionListEl, addButton, defaults }) {
  const fallbackQuestions = defaults?.questions || []
  let questions = fallbackQuestions.map((question) => cloneQuestion(question))

  const setQuestions = (nextQuestions) => {
    questions = sanitizeSurveyQuestionsConfig(nextQuestions, fallbackQuestions)
    renderQuestions()
  }

  const removeQuestion = (questionId) => {
    questions = questions.filter((question) => question.id !== questionId)
    renderQuestions()
  }

  const handleAddQuestion = () => {
    questions.push(
      createSurveyQuestion({
        title: '',
        options: ['選択肢1', '選択肢2'],
      }),
    )
    renderQuestions()
  }

  const buildQuestionElement = (question, index) => {
    const wrapper = document.createElement('article')
    wrapper.className = 'admin__question'
    wrapper.dataset.questionId = question.id

    const header = document.createElement('div')
    header.className = 'admin__question-header'

    const title = document.createElement('p')
    title.className = 'admin__question-title'
    title.textContent = `設問${index + 1}`
    header.appendChild(title)

    const removeButton = document.createElement('button')
    removeButton.type = 'button'
    removeButton.className = 'admin__icon-button'
    removeButton.textContent = '削除'
    removeButton.addEventListener('click', () => removeQuestion(question.id))
    header.appendChild(removeButton)

    wrapper.appendChild(header)

    const fieldsWrapper = document.createElement('div')
    fieldsWrapper.className = 'admin__fields admin__fields--single'

    const titleField = document.createElement('label')
    titleField.className = 'admin__field'
    titleField.innerHTML = '<span class="admin__field-label">質問内容</span>'
    const titleInput = document.createElement('input')
    titleInput.type = 'text'
    titleInput.placeholder = '例：今回のご利用目的を教えてください'
    titleInput.value = question.title
    titleInput.addEventListener('input', () => {
      question.title = titleInput.value
    })
    titleField.appendChild(titleInput)
    fieldsWrapper.appendChild(titleField)

    const typeField = document.createElement('label')
    typeField.className = 'admin__field'
    typeField.innerHTML = '<span class="admin__field-label">回答形式</span>'
    const typeSelect = document.createElement('select')
    QUESTION_TYPES.forEach(({ value, label }) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      typeSelect.appendChild(option)
    })
    typeSelect.value = normalizeQuestionType(question.type)
    typeSelect.addEventListener('change', () => {
      question.type = normalizeQuestionType(typeSelect.value)
      refreshQuestionState()
    })
    typeField.appendChild(typeSelect)
    const typeHint = document.createElement('span')
    typeHint.className = 'admin__field-hint'
    typeHint.textContent = '数字選択を選ぶと5段階評価の設問になります。'
    typeField.appendChild(typeHint)
    fieldsWrapper.appendChild(typeField)

    const ratingStyleField = document.createElement('label')
    ratingStyleField.className = 'admin__field'
    ratingStyleField.innerHTML = '<span class="admin__field-label">数字選択の表示</span>'
    const ratingStyleSelect = document.createElement('select')
    RATING_STYLES.forEach(({ value, label }) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      ratingStyleSelect.appendChild(option)
    })
    ratingStyleSelect.value = normalizeRatingStyle(question.ratingStyle)
    ratingStyleSelect.addEventListener('change', () => {
      question.ratingStyle = normalizeRatingStyle(ratingStyleSelect.value)
    })
    ratingStyleField.appendChild(ratingStyleSelect)
    const ratingStyleHint = document.createElement('span')
    ratingStyleHint.className = 'admin__field-hint'
    ratingStyleHint.textContent = '星（★）と数字ボタンのどちらで回答してもらうか選択できます。'
    ratingStyleField.appendChild(ratingStyleHint)
    fieldsWrapper.appendChild(ratingStyleField)

    const optionsField = document.createElement('label')
    optionsField.className = 'admin__field'
    optionsField.innerHTML = '<span class="admin__field-label">選択肢（1行につき1項目）</span>'
    const optionsTextarea = document.createElement('textarea')
    optionsTextarea.rows = 4
    optionsTextarea.placeholder = '例：ビジネス'
    optionsTextarea.value = question.options.join('\n')
    optionsTextarea.addEventListener('input', () => {
      const next = sanitizeOptionsList(optionsTextarea.value)
      question.options = next.length > 0 ? next : []
    })
    optionsField.appendChild(optionsTextarea)
    const optionsHint = document.createElement('span')
    optionsHint.className = 'admin__field-hint'
    optionsHint.textContent = 'ドロップダウン／チェックボックスで表示される回答候補です。空行は無視されます。'
    optionsField.appendChild(optionsHint)
    fieldsWrapper.appendChild(optionsField)

    const placeholderField = document.createElement('label')
    placeholderField.className = 'admin__field'
    placeholderField.innerHTML = '<span class="admin__field-label">プレースホルダー</span>'
    const placeholderInput = document.createElement('input')
    placeholderInput.type = 'text'
    placeholderInput.placeholder = '例：自由にご記入ください。'
    placeholderInput.value = question.placeholder || ''
    placeholderInput.addEventListener('input', () => {
      question.placeholder = placeholderInput.value
    })
    placeholderField.appendChild(placeholderInput)
    const placeholderHint = document.createElement('span')
    placeholderHint.className = 'admin__field-hint'
    placeholderHint.textContent = 'テキスト入力形式の補足文として表示されます。'
    placeholderField.appendChild(placeholderHint)
    fieldsWrapper.appendChild(placeholderField)

    wrapper.appendChild(fieldsWrapper)

    const settings = document.createElement('div')
    settings.className = 'admin__question-settings'

    const requiredToggle = document.createElement('label')
    requiredToggle.className = 'admin__toggle admin__toggle--compact'
    const requiredLabel = document.createElement('span')
    requiredLabel.className = 'admin__toggle-label'
    requiredLabel.textContent = '必須回答'
    requiredToggle.appendChild(requiredLabel)
    const requiredControl = document.createElement('span')
    requiredControl.className = 'admin__toggle-control'
    const requiredInput = document.createElement('input')
    requiredInput.type = 'checkbox'
    requiredInput.className = 'admin__toggle-input'
    requiredInput.checked = question.required
    const requiredTrack = document.createElement('span')
    requiredTrack.className = 'admin__toggle-track'
    const requiredThumb = document.createElement('span')
    requiredThumb.className = 'admin__toggle-thumb'
    requiredTrack.appendChild(requiredThumb)
    const requiredStatus = document.createElement('span')
    requiredStatus.className = 'admin__toggle-status'
    setToggleStatusText(requiredStatus, question.required)
    requiredInput.addEventListener('change', () => {
      question.required = requiredInput.checked
      setToggleStatusText(requiredStatus, requiredInput.checked)
    })
    requiredControl.append(requiredInput, requiredTrack, requiredStatus)
    requiredToggle.appendChild(requiredControl)
    settings.appendChild(requiredToggle)

    const reviewToggle = document.createElement('label')
    reviewToggle.className = 'admin__toggle admin__toggle--compact'
    const reviewLabel = document.createElement('span')
    reviewLabel.className = 'admin__toggle-label'
    reviewLabel.textContent = '口コミに反映'
    reviewToggle.appendChild(reviewLabel)
    const reviewControl = document.createElement('span')
    reviewControl.className = 'admin__toggle-control'
    const reviewInput = document.createElement('input')
    reviewInput.type = 'checkbox'
    reviewInput.className = 'admin__toggle-input'
    reviewInput.checked = question.includeInReview !== false
    const reviewTrack = document.createElement('span')
    reviewTrack.className = 'admin__toggle-track'
    const reviewThumb = document.createElement('span')
    reviewThumb.className = 'admin__toggle-thumb'
    reviewTrack.appendChild(reviewThumb)
    const reviewStatus = document.createElement('span')
    reviewStatus.className = 'admin__toggle-status'
    setToggleStatusText(reviewStatus, reviewInput.checked)
    reviewInput.addEventListener('change', () => {
      question.includeInReview = reviewInput.checked
      setToggleStatusText(reviewStatus, reviewInput.checked)
    })
    reviewControl.append(reviewInput, reviewTrack, reviewStatus)
    reviewToggle.appendChild(reviewControl)
    settings.appendChild(reviewToggle)

    const multipleWrapper = document.createElement('label')
    multipleWrapper.className = 'admin__checkbox'
    const multipleInput = document.createElement('input')
    multipleInput.type = 'checkbox'
    multipleInput.checked = question.allowMultiple
    multipleWrapper.appendChild(multipleInput)
    const multipleLabel = document.createElement('span')
    multipleLabel.textContent = '複数回答可'
    multipleWrapper.appendChild(multipleLabel)
    settings.appendChild(multipleWrapper)

    const ratingStyleFieldWrapper = ratingStyleField

    const refreshQuestionState = () => {
      const isCheckbox = question.type === 'checkbox'
      const isText = question.type === 'text'
      const isRating = question.type === 'rating'
      const requiresOptions = question.type === 'dropdown' || question.type === 'checkbox'

      if (!isCheckbox) {
        multipleInput.checked = false
        multipleInput.disabled = true
        question.allowMultiple = false
        multipleWrapper.classList.add('is-disabled')
      } else {
        multipleInput.disabled = false
        multipleWrapper.classList.remove('is-disabled')
        multipleInput.checked = question.allowMultiple
      }

      setElementHidden(optionsField, !requiresOptions)
      optionsTextarea.disabled = !requiresOptions
      setElementHidden(placeholderField, !isText)
      placeholderInput.disabled = !isText
      setElementHidden(ratingStyleFieldWrapper, !isRating)
      ratingStyleSelect.disabled = !isRating
    }

    multipleInput.addEventListener('change', () => {
      question.allowMultiple = multipleInput.checked
    })

    refreshQuestionState()

    wrapper.appendChild(settings)

    const helper = document.createElement('p')
    helper.className = 'admin__options-hint'
    helper.textContent = '数字選択を選ぶと5段階（星 or 数字）のボタンが表示されます。'
    wrapper.appendChild(helper)

    return wrapper
  }

  const renderQuestions = () => {
    if (!questionListEl) return
    questionListEl.innerHTML = ''

    if (questions.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'admin__options-hint'
      empty.textContent = '設問がありません。「設問を追加」ボタンから新しい設問を作成してください。'
      questionListEl.appendChild(empty)
      return
    }

    questions.forEach((question, index) => {
      questionListEl.appendChild(buildQuestionElement(question, index))
    })
  }

  const getPayloadQuestions = () =>
    questions
      .map((question) => {
        const type = normalizeQuestionType(question.type)
        const requiresOptions = type === 'dropdown' || type === 'checkbox'
        const options = requiresOptions
          ? (question.options || []).map((option) => option.trim()).filter(Boolean)
          : []
        return {
          id: question.id || createQuestionId(),
          title: (question.title || '').trim(),
          required: Boolean(question.required),
          type,
          allowMultiple: type === 'checkbox' ? Boolean(question.allowMultiple) : false,
          options,
          ratingEnabled: false,
          ratingStyle: type === 'rating' ? normalizeRatingStyle(question.ratingStyle) : 'stars',
          placeholder: type === 'text' ? (question.placeholder || '').trim() : '',
          includeInReview: typeof question.includeInReview === 'boolean' ? question.includeInReview : true,
        }
      })
      .filter((question) => {
        if (question.type === 'text' || question.type === 'rating') {
          return Boolean(question.title)
        }
        return question.title && question.options.length > 0
      })

  addButton?.addEventListener('click', handleAddQuestion)
  renderQuestions()

  return {
    key,
    defaults,
    fields,
    setQuestions,
    load: (config = {}) => {
      if (fields.title) {
        fields.title.value = config.title || defaults.title
      }
      if (fields.lead) {
        fields.lead.value = config.description || defaults.description
      }
      setQuestions(config.questions)
    },
    toPayload: () => {
      const titleValue = (fields.title?.value || '').trim()
      const leadValue = (fields.lead?.value || '').trim()
      const questionPayload = getPayloadQuestions()
      return {
        title: titleValue || defaults.title,
        description: leadValue || defaults.description,
        questions:
          questionPayload.length > 0
            ? questionPayload
            : fallbackQuestions.map((question) => cloneQuestion(question)),
      }
    },
  }
}

const surveyFormConfigs = [
  {
    key: 'form1',
    fields: {
      title: form.elements.form1Title,
      lead: form.elements.form1Lead,
    },
    questionListEl: app.querySelector('[data-role="form1-question-list"]'),
    addButton: app.querySelector('[data-role="form1-add-question"]'),
    defaults: DEFAULT_FORM1,
  },
  {
    key: 'form2',
    fields: {
      title: form.elements.form2Title,
      lead: form.elements.form2Lead,
    },
    questionListEl: app.querySelector('[data-role="form2-question-list"]'),
    addButton: app.querySelector('[data-role="form2-add-question"]'),
    defaults: DEFAULT_FORM2,
  },
  {
    key: 'form3',
    fields: {
      title: form.elements.form3Title,
      lead: form.elements.form3Lead,
    },
    questionListEl: app.querySelector('[data-role="form3-question-list"]'),
    addButton: app.querySelector('[data-role="form3-add-question"]'),
    defaults: DEFAULT_FORM3,
  },
]

const surveyFormManagers = surveyFormConfigs.reduce((acc, config) => {
  const manager = createSurveyFormManager(config)
  if (manager) {
    acc[config.key] = manager
  }
  return acc
}, {})

const inferFaviconType = (value) => {
  if (!value) return 'image/svg+xml'
  if (value.startsWith('data:image/')) {
    const match = value.match(/^data:(image\/[^;]+)/i)
    if (match) return match[1]
  }
  if (value.endsWith('.png')) return 'image/png'
  if (value.endsWith('.ico')) return 'image/x-icon'
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg'
  if (value.endsWith('.svg')) return 'image/svg+xml'
  return 'image/png'
}

const getFaviconLinks = () => {
  const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
  if (links.length > 0) {
    return Array.from(links)
  }
  const newLink = document.createElement('link')
  newLink.setAttribute('rel', 'icon')
  document.head.appendChild(newLink)
  return [newLink]
}

const setDocumentFavicon = (dataUrl) => {
  const href = dataUrl || DEFAULT_FAVICON_PATH
  const type = inferFaviconType(href)
  const links = getFaviconLinks()
  links.forEach((link) => {
    link.setAttribute('href', href)
    if (type) {
      link.setAttribute('type', type)
    }
  })
}

const brandingFields = {
  fileInput: form.elements.brandingFavicon,
  dataInput: form.elements.brandingFaviconData,
  preview: app.querySelector('[data-role="favicon-preview"]'),
  removeButton: app.querySelector('[data-role="favicon-remove"]'),
}

const applyBrandingToUI = (value) => {
  const dataUrl = typeof value === 'string' ? value : ''
  if (brandingFields.dataInput) {
    brandingFields.dataInput.value = dataUrl
  }
  if (brandingFields.preview) {
    brandingFields.preview.src = dataUrl || DEFAULT_FAVICON_PATH
  }
  setDocumentFavicon(dataUrl)
}

const handleBrandingFileChange = () => {
  const file = brandingFields.fileInput?.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    setStatus('画像ファイルを選択してください。', 'error')
    brandingFields.fileInput.value = ''
    return
  }

  if (file.size > MAX_FAVICON_SIZE) {
    const sizeKB = Math.round(MAX_FAVICON_SIZE / 1024)
    setStatus(`ファビコン画像は${sizeKB}KB以内のファイルを選択してください。`, 'error')
    brandingFields.fileInput.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      applyBrandingToUI(reader.result)
    }
  }
  reader.onerror = () => {
    setStatus('画像の読み込みに失敗しました。別のファイルをお試しください。', 'error')
  }
  reader.readAsDataURL(file)
}

const handleBrandingRemove = () => {
  if (brandingFields.fileInput) {
    brandingFields.fileInput.value = ''
  }
  applyBrandingToUI('')
}

const getBrandingValue = () => brandingFields.dataInput?.value?.trim() || ''

const cachedConfig = readCachedConfig()
if (cachedConfig) {
  populateForm(cachedConfig)
}

const setStatus = (message, type = 'info') => {
  if (!message) {
    statusEl.textContent = ''
    statusEl.setAttribute('hidden', '')
    statusEl.dataset.type = ''
    return
  }

  statusEl.textContent = message
  statusEl.removeAttribute('hidden')
  statusEl.dataset.type = type
}

const initializeQrControls = () => {
  if (!qrControls.preview) return

  const refresh = () => {
    renderQrPreview().catch(() => {
      // 表示領域にエラーメッセージを出すので追加処理は不要
    })
  }

  ;['page', 'size', 'format'].forEach((key) => {
    const control = qrControls[key]
    control?.addEventListener('change', refresh)
  })

  if (qrControls.refreshButton) {
    qrControls.refreshButton.addEventListener('click', refresh)
  }

  if (qrControls.downloadButton) {
    qrControls.downloadButton.addEventListener('click', () => {
      downloadQrCode()
    })
  }

  refresh()
}

const activateTab = (target) => {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === target
    button.classList.toggle('is-active', isActive)
  })

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === target
    panel.classList.toggle('is-active', isActive)
  })
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activateTab(button.dataset.tabTarget)
  })
})

initializeQrControls()

if (brandingFields.fileInput) {
  brandingFields.fileInput.addEventListener('change', handleBrandingFileChange)
}
if (brandingFields.removeButton) {
  brandingFields.removeButton.addEventListener('click', handleBrandingRemove)
}

if (promptInsertButtons.length > 0 && promptPopover.element) {
  promptInsertButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      const promptKey = button.dataset.promptKey
      if (!promptKey) return
      if (!promptGeneratorData.hasGeminiApi) {
        setStatus('プロンプトジェネレーターのGemini APIキーが未設定です。管理画面で登録してください。', 'error')
        hidePromptPopover()
        return
      }
      if (!promptPopover.element.hidden && promptPopover.currentKey === promptKey) {
        hidePromptPopover()
      } else {
        showPromptPopover(button, promptKey)
      }
    })
  })

  promptPopover.options.forEach((option) => {
    option.addEventListener('click', async () => {
      if (!promptPopover.currentKey) return
      const tier = option.dataset.tier || 'light'
      const targetField = getPromptFieldByKey(promptPopover.currentKey)
      if (!targetField?.prompt) {
        hidePromptPopover()
        return
      }
      option.disabled = true
      const generatedPrompt = await requestPromptGeneration({
        tier,
        promptKey: promptPopover.currentKey,
      })
      option.disabled = false
      hidePromptPopover()
      if (generatedPrompt) {
        targetField.prompt.value = generatedPrompt
      }
    })
  })

  document.addEventListener('click', (event) => {
    if (!promptPopover.element || promptPopover.element.hidden) return
    if (promptPopover.element.contains(event.target)) return
    if (event.target.closest('[data-role="prompt-insert"]')) return
    hidePromptPopover()
  })

  window.addEventListener('scroll', () => {
    if (!promptPopover.element || promptPopover.element.hidden) return
    if (promptPopover.anchor && promptPopover.currentKey) {
      showPromptPopover(promptPopover.anchor, promptPopover.currentKey)
    }
  })

  window.addEventListener('resize', hidePromptPopover)
}

if (userProfileFields.nearStation) {
  userProfileFields.nearStation.addEventListener('change', () => {
    setToggleStatusText(userProfileFields.nearStationStatus, userProfileFields.nearStation.checked)
  })
}

if (userProfileFields.admin?.toggle) {
  userProfileFields.admin.toggle.addEventListener('change', () => {
    updateAdminPasswordVisibility()
  })
  updateAdminPasswordVisibility()
} else {
  updateAdminPasswordVisibility()
}

if (tabButtons.length > 0) {
  activateTab(tabButtons[0].dataset.tabTarget)
}

function populateForm(config) {
  loadedConfig = config
  TIERS.forEach(({ key, defaultLabel }) => {
    const labelInput = form.elements[`${key}Label`]
    const linksInput = form.elements[`${key}Links`]

    if (labelInput) {
      labelInput.value = config.labels?.[key] ?? defaultLabel
    }

    if (linksInput) {
      const links = config.tiers?.[key]?.links ?? []
      linksInput.value = links.join('\n')
    }
  })

  const ai = config.aiSettings || {}
  if (aiFields.geminiApiKey) {
    if (ai.hasGeminiApiKey) {
      aiFields.geminiApiKey.value = ''
      aiFields.geminiApiKey.placeholder = '登録済みのキーがあります。更新する場合は新しいキーを入力'
      aiFields.geminiApiKey.dataset.registered = 'true'
    } else {
      aiFields.geminiApiKey.value = ai.geminiApiKey || ''
      aiFields.geminiApiKey.placeholder = '例: AIza...'
      delete aiFields.geminiApiKey.dataset.registered
    }
  }
  if (aiFields.mapsLink) aiFields.mapsLink.value = ai.mapsLink || ''
  if (aiFields.model) aiFields.model.value = ai.model || ''

  setUserProfileValues(config.userProfile || {})
  setPromptGeneratorValues(config.promptGenerator || DEFAULT_PROMPT_GENERATOR)

  const prompts = config.prompts || {}
  promptFields.forEach(({ key, gasUrl, prompt }) => {
    const promptConfig = prompts[key] || {}
    if (gasUrl) gasUrl.value = promptConfig.gasUrl || ''
    if (prompt) prompt.value = promptConfig.prompt || ''
  })

  const surveyResults = {
    ...DEFAULT_SURVEY_RESULTS,
    ...(config.surveyResults || {}),
  }
  if (surveyResultsFields.spreadsheetUrl) {
    surveyResultsFields.spreadsheetUrl.value = surveyResults.spreadsheetUrl || ''
  }
  if (surveyResultsFields.endpointUrl) {
    surveyResultsFields.endpointUrl.value = surveyResults.endpointUrl || ''
  }
  if (surveyResultsFields.apiKey) {
    surveyResultsFields.apiKey.value = surveyResults.apiKey || ''
  }

  const userDataSettings = {
    ...DEFAULT_USER_DATA_SETTINGS,
    ...(config.userDataSettings || {}),
  }
  if (userDataFields.spreadsheetUrl) {
    userDataFields.spreadsheetUrl.value = userDataSettings.spreadsheetUrl || ''
  }
  if (userDataFields.submitGasUrl) {
    userDataFields.submitGasUrl.value = userDataSettings.submitGasUrl || ''
  }
  if (userDataFields.readGasUrl) {
    userDataFields.readGasUrl.value = userDataSettings.readGasUrl || ''
  }

  surveyFormConfigs.forEach(({ key }) => {
    const manager = surveyFormManagers[key]
    if (!manager) return
    const defaults = SURVEY_FORM_DEFAULTS[key] || DEFAULT_FORM2
    const formConfig = config[key] || defaults
    manager.load(formConfig)
  })

  const branding = config.branding || {}
  applyBrandingToUI(branding.faviconDataUrl || '')
}

const loadConfig = async () => {
  setStatus('設定を読み込み中です…')
  try {
    const response = await fetch('/.netlify/functions/config')
    if (!response.ok) {
      throw new Error('設定の取得に失敗しました。ネットワーク状況をご確認ください。')
    }
    const payload = await response.json()
    populateForm(payload)
    writeCachedConfig(payload)
    setStatus('最新の設定を読み込みました。', 'success')
  } catch (error) {
    console.error(error)
    const cached = readCachedConfig()
    if (cached) {
      populateForm(cached)
    }
    setStatus(error.message, 'error')
  }
}

const parseLinks = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const hasInvalidUrl = (value) => {
  try {
    if (!value) return false
    // eslint-disable-next-line no-new
    new URL(value)
    return false
  } catch {
    return true
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const payload = {
    labels: { ...(loadedConfig?.labels || {}) },
    tiers: { ...(loadedConfig?.tiers || {}) },
    aiSettings: { ...(loadedConfig?.aiSettings || {}) },
    prompts: { ...(loadedConfig?.prompts || {}) },
    branding: { ...(loadedConfig?.branding || {}) },
    surveyResults: {
      ...DEFAULT_SURVEY_RESULTS,
      ...(loadedConfig?.surveyResults || {}),
    },
    userDataSettings: {
      ...DEFAULT_USER_DATA_SETTINGS,
      ...(loadedConfig?.userDataSettings || {}),
    },
    userProfile: { ...(loadedConfig?.userProfile || {}) },
    promptGenerator: { ...(loadedConfig?.promptGenerator || DEFAULT_PROMPT_GENERATOR) },
  }
  const cloneFormConfig = (key) =>
    loadedConfig?.[key] ? JSON.parse(JSON.stringify(loadedConfig[key])) : undefined
  payload.form1 = cloneFormConfig('form1')
  payload.form2 = cloneFormConfig('form2')
  payload.form3 = cloneFormConfig('form3')

  const errors = []

  TIERS.forEach(({ key, defaultLabel }) => {
    const labelInput = form.elements[`${key}Label`]
    const linksInput = form.elements[`${key}Links`]

    if (labelInput) {
      payload.labels[key] = labelInput.value.trim() || defaultLabel
    } else if (!payload.labels[key]) {
      payload.labels[key] = defaultLabel
    }

    if (linksInput) {
      const links = parseLinks(linksInput.value)
      const invalidLink = links.find(hasInvalidUrl)
      if (invalidLink) {
        errors.push(`${defaultLabel}リンクのURL形式が正しくありません: ${invalidLink}`)
      }
      payload.tiers[key] = { links }
    } else if (!payload.tiers[key]) {
      payload.tiers[key] = { links: [] }
    }
  })

  const aiSettings = { ...(payload.aiSettings || {}) }
  if (aiFields.geminiApiKey) {
    aiSettings.geminiApiKey = (aiFields.geminiApiKey.value || '').trim()
  }
  if (aiFields.model) {
    aiSettings.model = (aiFields.model.value || '').trim()
  }
  if (aiFields.mapsLink) {
    aiSettings.mapsLink = (aiFields.mapsLink.value || '').trim()

    if (aiSettings.mapsLink) {
      try {
        // eslint-disable-next-line no-new
        new URL(aiSettings.mapsLink)
      } catch {
        errors.push('Googleマップリンク のURL形式が正しくありません。')
      }
    }
  }

  payload.aiSettings = aiSettings

  promptFields.forEach(({ key, gasUrl, prompt }) => {
    const current = { ...(payload.prompts[key] || {}) }
    const label = PROMPT_CONFIGS.find((item) => item.key === key)?.label || key

    if (gasUrl) {
      const gasValue = (gasUrl.value || '').trim()
      if (gasValue) {
        try {
          // eslint-disable-next-line no-new
          new URL(gasValue)
        } catch {
          errors.push(`${label} のGASアプリURL形式が正しくありません。`)
        }
      }
      current.gasUrl = gasValue
    }

    if (prompt) {
      current.prompt = (prompt.value || '').trim()
    }

    payload.prompts[key] = current
  })

  const surveyResults = { ...(payload.surveyResults || DEFAULT_SURVEY_RESULTS) }
  if (surveyResultsFields.spreadsheetUrl) {
    surveyResults.spreadsheetUrl = (surveyResultsFields.spreadsheetUrl.value || '').trim()
    if (surveyResults.spreadsheetUrl && hasInvalidUrl(surveyResults.spreadsheetUrl)) {
      errors.push('スプレッドシートURLの形式が正しくありません。')
    }
  }

  if (surveyResultsFields.endpointUrl) {
    surveyResults.endpointUrl = (surveyResultsFields.endpointUrl.value || '').trim()
    if (surveyResults.endpointUrl && hasInvalidUrl(surveyResults.endpointUrl)) {
      errors.push('送信先API(URL)の形式が正しくありません。')
    }
  }

  if (surveyResultsFields.apiKey) {
    surveyResults.apiKey = (surveyResultsFields.apiKey.value || '').trim()
  }

  payload.surveyResults = surveyResults

  const userDataSettings = { ...(payload.userDataSettings || DEFAULT_USER_DATA_SETTINGS) }
  if (userDataFields.spreadsheetUrl) {
    userDataSettings.spreadsheetUrl = (userDataFields.spreadsheetUrl.value || '').trim()
    if (userDataSettings.spreadsheetUrl && hasInvalidUrl(userDataSettings.spreadsheetUrl)) {
      errors.push('ユーザー情報のスプレッドシートURLの形式が正しくありません。')
    }
  }

  if (userDataFields.submitGasUrl) {
    userDataSettings.submitGasUrl = (userDataFields.submitGasUrl.value || '').trim()
    if (userDataSettings.submitGasUrl && hasInvalidUrl(userDataSettings.submitGasUrl)) {
      errors.push('ユーザー情報保存GASエンドポイントのURL形式が正しくありません。')
    }
  }

  if (userDataFields.readGasUrl) {
    userDataSettings.readGasUrl = (userDataFields.readGasUrl.value || '').trim()
    if (userDataSettings.readGasUrl && hasInvalidUrl(userDataSettings.readGasUrl)) {
      errors.push('ユーザー情報読み取りGAS URLの形式が正しくありません。')
    }
  }

  payload.userDataSettings = userDataSettings

  if (brandingFields.dataInput) {
    payload.branding = {
      ...payload.branding,
      faviconDataUrl: getBrandingValue(),
    }
  }

  payload.userProfile = getUserProfilePayload()
  if (userProfileFields.admin?.password && userProfileFields.admin?.passwordConfirm) {
    const passwordValue = (userProfileFields.admin.password.value || '').trim()
    const confirmValue = (userProfileFields.admin.passwordConfirm.value || '').trim()
    if (passwordValue !== confirmValue) {
      errors.push('管理者のパスワードと確認が一致しません。')
    }
  }
  payload.promptGenerator = getPromptGeneratorPayload()

  surveyFormConfigs.forEach(({ key }) => {
    const manager = surveyFormManagers[key]
    if (!manager) return
    payload[key] = manager.toPayload()
  })

  if (errors.length > 0) {
    setStatus(errors.join(' / '), 'error')
    return
  }

  setStatus('設定を保存しています…')
  try {
    const response = await fetch('/.netlify/functions/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      const errorMessage =
        errorPayload?.message || '保存に失敗しました。時間を空けて再度お試しください。'
      throw new Error(errorMessage)
    }

    const savedConfig = await response.json().catch(() => null)
    if (savedConfig) {
      loadedConfig = savedConfig
      writeCachedConfig(savedConfig)
      applyBrandingToUI(savedConfig.branding?.faviconDataUrl || '')
    } else {
      const fallbackConfig = {
        labels: payload.labels,
        tiers: payload.tiers,
        aiSettings: payload.aiSettings,
        prompts: payload.prompts,
        branding: payload.branding,
        surveyResults: payload.surveyResults,
        userDataSettings: payload.userDataSettings,
        form1: payload.form1,
        form2: payload.form2,
        form3: payload.form3,
        userProfile: payload.userProfile,
        promptGenerator: payload.promptGenerator,
      }
      loadedConfig = fallbackConfig
      writeCachedConfig(fallbackConfig)
      applyBrandingToUI(payload.branding.faviconDataUrl)
    }

    let userProfileSyncResult = { status: 'skipped' }
    if (isUserApp && hasUserDataSyncConfig()) {
      setStatus('ユーザー情報を保存しています…')
      userProfileSyncResult = await syncUserProfileExternally(payload.userProfile)
      if (userProfileSyncResult.status === 'error') {
        setStatus(userProfileSyncResult.message, 'error')
        return
      }
    }

    if (userProfileSyncResult.status === 'success') {
      setStatus('設定とユーザー情報を保存しました。', 'success')
    } else {
      setStatus('設定を保存しました。', 'success')
    }
  } catch (error) {
    console.error(error)
    setStatus(error.message, 'error')
  }
})

loadConfig()

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    loadConfig()
  }
})
