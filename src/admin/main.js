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

const form = app.querySelector('#config-form')
const statusEl = app.querySelector('[data-role="status"]')

if (!form || !statusEl) {
  throw new Error('管理画面の必須要素が見つかりません。')
}

const tabButtons = Array.from(app.querySelectorAll('[data-tab-target]'))
const tabPanels = Array.from(app.querySelectorAll('[data-tab-panel]'))


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
  acc[config.key] = createSurveyFormManager(config)
  return acc
}, {})

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

const createSurveyFormManager = ({ key, fields, questionListEl, addButton, defaults }) => {
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

setForm2Questions(DEFAULT_FORM2.questions)

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

if (brandingFields.fileInput) {
  brandingFields.fileInput.addEventListener('change', handleBrandingFileChange)
}
if (brandingFields.removeButton) {
  brandingFields.removeButton.addEventListener('click', handleBrandingRemove)
}

if (tabButtons.length > 0) {
  activateTab(tabButtons[0].dataset.tabTarget)
}

function populateForm(config) {
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

  const prompts = config.prompts || {}
  promptFields.forEach(({ key, gasUrl, prompt }) => {
    const promptConfig = prompts[key] || {}
    if (gasUrl) gasUrl.value = promptConfig.gasUrl || ''
    if (prompt) prompt.value = promptConfig.prompt || ''
  })

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

  const payload = { labels: {}, tiers: {}, aiSettings: {}, prompts: {}, branding: {} }
  const errors = []

  TIERS.forEach(({ key, defaultLabel }) => {
    const labelInput = form.elements[`${key}Label`]
    const linksInput = form.elements[`${key}Links`]

    const labelValue = labelInput.value.trim() || defaultLabel
    const links = parseLinks(linksInput.value)

    const invalidLink = links.find(hasInvalidUrl)
    if (invalidLink) {
      errors.push(`${defaultLabel}リンクのURL形式が正しくありません: ${invalidLink}`)
    }

    payload.labels[key] = labelValue
    payload.tiers[key] = { links }
  })

  const aiSettings = {
    geminiApiKey: (aiFields.geminiApiKey?.value || '').trim(),
    mapsLink: (aiFields.mapsLink?.value || '').trim(),
    model: (aiFields.model?.value || '').trim(),
  }

  if (aiSettings.mapsLink) {
    try {
      // eslint-disable-next-line no-new
      new URL(aiSettings.mapsLink)
    } catch {
      errors.push('Googleマップリンク のURL形式が正しくありません。')
    }
  }

  payload.aiSettings = aiSettings

  promptFields.forEach(({ key, gasUrl, prompt }) => {
    const gasValue = (gasUrl?.value || '').trim()
    const promptValue = (prompt?.value || '').trim()
    const label = PROMPT_CONFIGS.find((item) => item.key === key)?.label || key

    if (gasValue) {
      try {
        // eslint-disable-next-line no-new
        new URL(gasValue)
      } catch {
        errors.push(`${label} のGASアプリURL形式が正しくありません。`)
      }
    }

    payload.prompts[key] = {
      gasUrl: gasValue,
      prompt: promptValue,
    }
  })

  payload.branding = {
    faviconDataUrl: getBrandingValue(),
  }

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
      writeCachedConfig(savedConfig)
      applyBrandingToUI(savedConfig.branding?.faviconDataUrl || '')
    } else {
      const fallbackConfig = {
        labels: payload.labels,
        tiers: payload.tiers,
        aiSettings: payload.aiSettings,
        prompts: payload.prompts,
        branding: payload.branding,
        form1: payload.form1,
        form2: payload.form2,
        form3: payload.form3,
      }
      writeCachedConfig(fallbackConfig)
      applyBrandingToUI(payload.branding.faviconDataUrl)
    }

    setStatus('設定を保存しました。', 'success')
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
