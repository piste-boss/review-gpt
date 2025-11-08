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
