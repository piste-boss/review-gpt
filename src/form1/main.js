const CONFIG_CACHE_KEY = 'oisoya_review_config_cache'
const RATING_STORAGE_KEY = 'kuchikomi_gpt_form1_rating'

const DEFAULT_FORM1 = {
  title: '体験の満足度を教えてください',
  description: '星をタップして今回のサービスの満足度をお選びください。選択内容は生成されるクチコミのトーンに反映されます。',
  inputStyle: 'stars',
  reasonEnabled: false,
}

const app = document.querySelector('#form-app')
if (!app) {
  throw new Error('#form-app が見つかりません。')
}

const summaryEl = app.querySelector('[data-role="summary"]')
const nextButton = app.querySelector('[data-role="next"]')
const statusEl = app.querySelector('[data-role="status"]')
const titleEl = app.querySelector('[data-role="title"]')
const leadEl = app.querySelector('[data-role="lead"]')
const ratingContainer = app.querySelector('[data-role="rating-options"]')
const reasonCard = app.querySelector('[data-role="reason-card"]')

const RATING_MESSAGES = {
  1: '1 - 改善してほしい点がありました。',
  2: '2 - やや不満が残りました。',
  3: '3 - まずまず満足しました。',
  4: '4 - 十分満足しました。',
  5: '5 - とても満足しました！',
}

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

const readStoredRating = () => {
  try {
    const value = window.localStorage.getItem(RATING_STORAGE_KEY)
    if (!value) return null
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return null
    return Math.min(Math.max(parsed, 1), 5)
  } catch {
    return null
  }
}

const writeStoredRating = (score) => {
  try {
    window.localStorage.setItem(RATING_STORAGE_KEY, String(score))
  } catch {
    // noop
  }
}

const setStatus = (message, type = 'info') => {
  if (!statusEl) return
  if (!message) {
    statusEl.textContent = ''
    statusEl.dataset.type = ''
    statusEl.setAttribute('hidden', '')
    return
  }
  statusEl.textContent = message
  statusEl.dataset.type = type
  statusEl.removeAttribute('hidden')
}

const normalizeMode = (value) => (value === 'numbers' ? 'numbers' : 'stars')

let ratingButtons = []
let currentScore = readStoredRating()
let currentFormConfig = DEFAULT_FORM1

const highlightRating = (score) => {
  ratingButtons.forEach((button) => {
    const buttonScore = Number(button.dataset.score)
    const isActive = buttonScore === score
    const isFilled = buttonScore <= score
    button.classList.toggle('is-active', isActive)
    button.classList.toggle('is-filled', isFilled)
    button.setAttribute('aria-checked', isActive ? 'true' : 'false')
  })
  if (summaryEl) {
    summaryEl.textContent = score ? RATING_MESSAGES[score] || `${score} を選択しました。` : 'まだ選択されていません。'
  }
  if (nextButton) {
    nextButton.disabled = !score
  }
}

const attachRatingHandlers = () => {
  ratingButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const score = Number(button.dataset.score)
      currentScore = score
      highlightRating(score)
      writeStoredRating(score)
      setStatus('')
    })
  })
}

const createRatingButton = (mode, score) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'form__rating-option'
  button.dataset.score = String(score)
  button.setAttribute('aria-label', String(score))
  button.setAttribute('role', 'radio')

  if (mode === 'numbers') {
    button.classList.add('form__rating-option--number')
    button.textContent = String(score)
  } else {
    button.classList.add('form__rating-option--star')
    button.innerHTML = '<span aria-hidden="true">★</span>'
  }

  return button
}

const renderRatingOptions = (mode) => {
  if (!ratingContainer) return

  const ratingMode = normalizeMode(mode)
  ratingContainer.innerHTML = ''
  ratingButtons = []

  for (let score = 1; score <= 5; score += 1) {
    const button = createRatingButton(ratingMode, score)
    ratingContainer.appendChild(button)
    ratingButtons.push(button)
  }

  attachRatingHandlers()
  highlightRating(currentScore)
}

const applyFormContent = (formConfig = {}) => {
  currentFormConfig = {
    ...DEFAULT_FORM1,
    ...formConfig,
    inputStyle: normalizeMode(formConfig.inputStyle),
    reasonEnabled: Boolean(formConfig.reasonEnabled),
  }

  if (titleEl) {
    titleEl.textContent = currentFormConfig.title || DEFAULT_FORM1.title
  }
  if (leadEl) {
    leadEl.textContent = currentFormConfig.description || DEFAULT_FORM1.description
  }

  renderRatingOptions(currentFormConfig.inputStyle)

  if (reasonCard) {
    if (currentFormConfig.reasonEnabled) {
      reasonCard.removeAttribute('hidden')
    } else {
      reasonCard.setAttribute('hidden', '')
    }
  }
}

const loadConfig = async () => {
  try {
    const response = await fetch('/.netlify/functions/config')
    if (!response.ok) {
      throw new Error('フォーム設定の取得に失敗しました。')
    }
    const payload = await response.json()
    writeCachedConfig(payload)
    if (payload?.form1) {
      applyFormContent(payload.form1)
    }
  } catch (error) {
    console.warn(error)
  }
}

const initializeForm = () => {
  const cached = readCachedConfig()
  if (cached?.form1) {
    applyFormContent(cached.form1)
  } else {
    applyFormContent(DEFAULT_FORM1)
  }

  if (currentScore) {
    highlightRating(currentScore)
  }

  loadConfig()
}

nextButton?.addEventListener('click', () => {
  if (!currentScore) {
    setStatus('評価を選択してください。', 'error')
    return
  }
  setStatus('回答を保存しました。口コミ生成ページへ移動します。', 'success')
  window.setTimeout(() => {
    window.location.href = '/generator/index.html'
  }, 600)
})

window.addEventListener('pageshow', () => {
  const stored = readStoredRating()
  if (stored) {
    currentScore = stored
    highlightRating(stored)
  }
})

initializeForm()
