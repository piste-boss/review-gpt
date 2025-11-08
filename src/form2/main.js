const CONFIG_CACHE_KEY = 'oisoya_review_config_cache'

const DEFAULT_FORMS = {
  form1: {
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
  },
  form2: {
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
  },
  form3: {
    title: '詳細アンケートにご協力ください',
    description: '選択式と自由入力で体験の詳細をお聞きします。わかる範囲でお答えください。',
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
  },
}

const RATING_SCALE = [1, 2, 3, 4, 5]

const app = document.querySelector('#form2-app')
if (!app) {
  throw new Error('#form2-app が見つかりません。')
}

const FORM_KEY = app.dataset.formKey || 'form2'
const DEFAULT_FORM = DEFAULT_FORMS[FORM_KEY] || DEFAULT_FORMS.form2

const titleEl = app.querySelector('[data-role="title"]')
const leadEl = app.querySelector('[data-role="lead"]')
const questionListEl = app.querySelector('[data-role="question-list"]')
const statusEl = app.querySelector('[data-role="status"]')
const submitButton = app.querySelector('[data-role="submit"]')

const questionRefs = new Map()
let currentFormConfig = DEFAULT_FORM

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

const clearQuestionStatus = (statusNode) => {
  if (!statusNode) return
  statusNode.textContent = ''
  statusNode.setAttribute('hidden', '')
}

const setQuestionError = (statusNode, message) => {
  if (!statusNode) return
  statusNode.textContent = message
  statusNode.removeAttribute('hidden')
}

const normalizeQuestionType = (value) => {
  if (value === 'checkbox') return 'checkbox'
  if (value === 'text') return 'text'
  if (value === 'rating') return 'rating'
  return 'dropdown'
}

const normalizeRatingStyle = (value) => (value === 'numbers' ? 'numbers' : 'stars')

const normalizeQuestions = (questions = []) => {
  if (!Array.isArray(questions)) return DEFAULT_FORM.questions
  const normalized = questions
    .map((question, index) => {
      const options = Array.isArray(question?.options)
        ? question.options.map((option) => (typeof option === 'string' ? option.trim() : '')).filter(Boolean)
        : []
      const type = normalizeQuestionType(question.type)
      const requiresOptions = type === 'dropdown' || type === 'checkbox'
      if (requiresOptions && options.length === 0) {
        return null
      }
      const normalizedOptions = requiresOptions ? options : []
      return {
        id: typeof question.id === 'string' && question.id.trim() ? question.id : `form2-q-${index + 1}`,
        title: typeof question.title === 'string' && question.title.trim() ? question.title : `設問${index + 1}`,
        required: Boolean(question.required),
        type,
        allowMultiple: type === 'checkbox' ? Boolean(question.allowMultiple) : false,
        options: normalizedOptions,
        ratingEnabled: type !== 'rating' && Boolean(question.ratingEnabled),
        ratingStyle: type === 'rating' ? normalizeRatingStyle(question.ratingStyle) : 'stars',
        placeholder: type === 'text' && typeof question.placeholder === 'string' ? question.placeholder : '',
        includeInReview: question.includeInReview !== false,
      }
    })
    .filter(Boolean)

  return normalized.length > 0 ? normalized : DEFAULT_FORM.questions
}

const describeQuestion = (question) => {
  if (question.type === 'checkbox') {
    if (question.allowMultiple) return '該当する項目をすべて選択してください。'
    return 'もっとも当てはまる項目を1つ選択してください。'
  }
  if (question.type === 'rating') {
    if (question.ratingStyle === 'numbers') {
      return '1〜5の数字から今回の評価を選択してください。'
    }
    return '星マークをタップして今回の評価を選択してください。'
  }
  if (question.type === 'text') {
    return '自由入力欄です。感じたことをそのままご記入ください。'
  }
  return 'プルダウンから1つ選択してください。'
}

const buildDropdown = (question, statusNode) => {
  const select = document.createElement('select')
  select.className = 'form2__select'
  select.dataset.questionControl = question.id

  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '選択してください'
  select.appendChild(placeholder)

  question.options.forEach((option) => {
    const optionEl = document.createElement('option')
    optionEl.value = option
    optionEl.textContent = option
    select.appendChild(optionEl)
  })

  select.addEventListener('change', () => {
    if (select.value) {
      clearQuestionStatus(statusNode)
    }
  })

  return select
}

const buildCheckboxGroup = (question, statusNode) => {
  const container = document.createElement('div')
  container.className = 'form2__options'

  const inputs = question.options.map((option) => {
    const label = document.createElement('label')
    label.className = 'form2__option'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.name = question.id
    input.value = option
    input.addEventListener('change', () => {
      if (!question.allowMultiple && input.checked) {
        inputs.forEach((other) => {
          if (other !== input) {
            other.checked = false
          }
        })
      }
      if (input.checked) {
        clearQuestionStatus(statusNode)
      }
    })
    label.appendChild(input)
    const text = document.createElement('span')
    text.textContent = option
    label.appendChild(text)
    container.appendChild(label)
    return input
  })

  return { container, inputs }
}

const buildTextInput = (question, statusNode) => {
  const textarea = document.createElement('textarea')
  textarea.className = 'form2__textarea'
  textarea.rows = 4
  textarea.placeholder = question.placeholder || '自由にご記入ください。'
  textarea.dataset.questionControl = question.id
  textarea.addEventListener('input', () => {
    if ((textarea.value || '').trim()) {
      clearQuestionStatus(statusNode)
    }
  })
  return textarea
}

const highlightRatingButtons = (buttons, score) => {
  buttons.forEach((button) => {
    const value = Number(button.dataset.score)
    button.classList.toggle('is-active', value === score)
    button.classList.toggle('is-filled', value <= score)
    button.setAttribute('aria-pressed', value === score ? 'true' : 'false')
  })
}

const buildRatingControls = ({ mode = 'stars' } = {}) => {
  const container = document.createElement('div')
  container.className = 'form2__rating'

  const guides = document.createElement('div')
  guides.className = 'form2__rating-guides'
  const lowGuide = document.createElement('span')
  lowGuide.textContent = mode === 'numbers' ? '1（低い）' : '低い'
  const highGuide = document.createElement('span')
  highGuide.textContent = mode === 'numbers' ? '5（高い）' : '高い'
  guides.append(lowGuide, highGuide)
  container.appendChild(guides)

  const buttonsWrap = document.createElement('div')
  buttonsWrap.className = 'form2__rating-buttons'
  container.appendChild(buttonsWrap)

  const buttons = RATING_SCALE.map((score) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'form2__rating-button'
    button.dataset.score = String(score)
    button.setAttribute('aria-label', `${score}点`)
    if (mode === 'numbers') {
      button.classList.add('form2__rating-button--number')
      button.textContent = String(score)
    } else {
      button.classList.add('form2__rating-button--star')
      button.innerHTML = '<span aria-hidden="true">★</span>'
    }
    buttonsWrap.appendChild(button)
    return button
  })

  return { container, buttons }
}

const renderQuestions = () => {
  if (!questionListEl) return
  questionListEl.innerHTML = ''
  questionRefs.clear()

  currentFormConfig.questions.forEach((question) => {
    const questionCard = document.createElement('article')
    questionCard.className = 'form2__question'
    questionCard.dataset.questionId = question.id

    const heading = document.createElement('div')
    heading.className = 'form2__question-heading'
    const title = document.createElement('p')
    title.className = 'form2__question-title'
    title.textContent = question.title
    heading.appendChild(title)

    const badge = document.createElement('span')
    badge.className = 'form2__badge'
    badge.textContent = question.required ? '必須' : '任意'
    heading.appendChild(badge)
    questionCard.appendChild(heading)

    const instructions = document.createElement('p')
    instructions.className = 'form2__question-instructions'
    instructions.textContent = describeQuestion(question)
    questionCard.appendChild(instructions)

    const statusNode = document.createElement('p')
    statusNode.className = 'form2__question-status'
    statusNode.setAttribute('hidden', '')

    if (question.type === 'rating') {
      const ratingContent = buildRatingControls({
        mode: question.ratingStyle,
      })
      questionCard.appendChild(ratingContent.container)
      const ref = {
        type: 'rating',
        required: question.required,
        allowMultiple: false,
        selectEl: null,
        inputs: [],
        textEl: null,
        statusEl: statusNode,
        rating: {
          currentScore: 0,
          buttons: ratingContent.buttons,
        },
      }
      questionRefs.set(question.id, ref)
      ratingContent.buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const score = Number(button.dataset.score)
          ref.rating.currentScore = score
          highlightRatingButtons(ratingContent.buttons, score)
        })
      })
    } else if (question.type === 'dropdown') {
      const select = buildDropdown(question, statusNode)
      questionCard.appendChild(select)
      questionRefs.set(question.id, {
        type: 'dropdown',
        required: question.required,
        allowMultiple: false,
        selectEl: select,
        inputs: [],
        textEl: null,
        statusEl: statusNode,
        rating: null,
      })
    } else if (question.type === 'checkbox') {
      const { container, inputs } = buildCheckboxGroup(question, statusNode)
      questionCard.appendChild(container)
      questionRefs.set(question.id, {
        type: 'checkbox',
        required: question.required,
        allowMultiple: question.allowMultiple,
        selectEl: null,
        inputs,
        textEl: null,
        statusEl: statusNode,
        rating: null,
      })
    } else {
      const textarea = buildTextInput(question, statusNode)
      questionCard.appendChild(textarea)
      questionRefs.set(question.id, {
        type: 'text',
        required: question.required,
        allowMultiple: false,
        selectEl: null,
        inputs: [],
        textEl: textarea,
        statusEl: statusNode,
        rating: null,
      })
    }

    if (question.type !== 'rating' && question.ratingEnabled) {
      const ratingContent = buildRatingControls()
      questionCard.appendChild(ratingContent.container)
      const ref = questionRefs.get(question.id)
      if (ref) {
        ref.rating = {
          currentScore: 0,
          buttons: ratingContent.buttons,
        }
        ratingContent.buttons.forEach((button) => {
          button.addEventListener('click', () => {
            const score = Number(button.dataset.score)
            ref.rating.currentScore = score
            highlightRatingButtons(ratingContent.buttons, score)
          })
        })
      }
    }

    questionCard.appendChild(statusNode)
    questionListEl.appendChild(questionCard)
  })
}

const applyFormContent = (formConfig = {}) => {
  currentFormConfig = {
    ...DEFAULT_FORM,
    ...formConfig,
    questions: normalizeQuestions(formConfig.questions),
  }

  if (titleEl) {
    titleEl.textContent = currentFormConfig.title || DEFAULT_FORM.title
  }
  if (leadEl) {
    leadEl.textContent = currentFormConfig.description || DEFAULT_FORM.description
  }

  renderQuestions()
}

const loadConfig = async () => {
  try {
    const response = await fetch('/.netlify/functions/config')
    if (!response.ok) {
      throw new Error('フォーム設定の取得に失敗しました。')
    }
    const payload = await response.json()
    writeCachedConfig(payload)
    const formConfig = payload?.[FORM_KEY]
    if (formConfig) {
      applyFormContent(formConfig)
    }
  } catch (error) {
    console.warn(error)
  }
}

const initializeForm = () => {
  const cached = readCachedConfig()
  if (cached?.[FORM_KEY]) {
    applyFormContent(cached[FORM_KEY])
  } else {
    applyFormContent(DEFAULT_FORM)
  }

  loadConfig()
}

const collectAnswers = () => {
  const errors = []
  const answers = {}

  questionRefs.forEach((ref, questionId) => {
    clearQuestionStatus(ref.statusEl)
    let value

    if (ref.type === 'dropdown') {
      value = ref.selectEl?.value || ''
      if (ref.required && !value) {
        errors.push(questionId)
        setQuestionError(ref.statusEl, '選択してください。')
      }
    } else if (ref.type === 'checkbox') {
      const selected = ref.inputs.filter((input) => input.checked).map((input) => input.value)
      if (ref.required && selected.length === 0) {
        errors.push(questionId)
        setQuestionError(ref.statusEl, '該当する項目を選択してください。')
      }
      if (!ref.allowMultiple && selected.length > 1) {
        selected.splice(1)
      }
      value = ref.allowMultiple ? selected : selected[0] || ''
    } else if (ref.type === 'rating') {
      const score = ref.rating?.currentScore ?? 0
      if (ref.required && !score) {
        errors.push(questionId)
        setQuestionError(ref.statusEl, '評価を選択してください。')
      }
      value = score
    } else {
      const textValue = (ref.textEl?.value || '').trim()
      if (ref.required && !textValue) {
        errors.push(questionId)
        setQuestionError(ref.statusEl, '入力してください。')
      }
      value = textValue
    }

    answers[questionId] = {
      value,
      rating: ref.rating ? ref.rating.currentScore || 0 : 0,
    }
  })

  return { answers, errors }
}

submitButton?.addEventListener('click', () => {
  const { errors, answers } = collectAnswers()
  if (errors.length > 0) {
    setStatus('未回答の必須項目があります。', 'error')
    return
  }
  // eslint-disable-next-line no-console
  console.log(`${FORM_KEY} answers`, answers)
  setStatus('回答を保存しました。口コミ生成ページへ移動します。', 'success')
  window.setTimeout(() => {
    const redirectMap = {
      form1: '/generator/index.html',
      form2: '/generator/page2/index.html',
      form3: '/generator/page3/index.html',
    }
    window.location.href = redirectMap[FORM_KEY] || '/generator/page2/index.html'
  }, 600)
})

initializeForm()
