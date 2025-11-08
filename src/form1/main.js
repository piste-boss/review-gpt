const RATING_STORAGE_KEY = 'kuchikomi_gpt_form1_rating'

const app = document.querySelector('#form-app')
if (!app) {
  throw new Error('#form-app が見つかりません。')
}

const stars = Array.from(app.querySelectorAll('.form__star'))
const summaryEl = app.querySelector('[data-role="summary"]')
const nextButton = app.querySelector('[data-role="next"]')
const statusEl = app.querySelector('[data-role="status"]')

const RATING_MESSAGES = {
  1: '1 - 改善してほしい点がありました。',
  2: '2 - やや不満が残りました。',
  3: '3 - まずまず満足しました。',
  4: '4 - 十分満足しました。',
  5: '5 - とても満足しました！',
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

const highlightStars = (score) => {
  stars.forEach((star) => {
    const starScore = Number(star.dataset.score)
    star.classList.toggle('is-active', starScore === score)
    star.classList.toggle('is-filled', starScore <= score)
    star.setAttribute('aria-checked', starScore === score ? 'true' : 'false')
  })
  if (summaryEl) {
    summaryEl.textContent = score ? RATING_MESSAGES[score] || `${score} を選択しました。` : 'まだ選択されていません。'
  }
  if (nextButton) {
    nextButton.disabled = !score
  }
}

let currentScore = readStoredRating()
if (currentScore) {
  highlightStars(currentScore)
}

stars.forEach((star) => {
  star.addEventListener('click', () => {
    const score = Number(star.dataset.score)
    currentScore = score
    highlightStars(score)
    writeStoredRating(score)
    setStatus('')
  })
})

nextButton?.addEventListener('click', () => {
  if (!currentScore) {
    setStatus('星を選択してください。', 'error')
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
    highlightStars(stored)
  }
})
