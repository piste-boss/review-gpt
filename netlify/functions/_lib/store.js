import { getStore } from '@netlify/blobs'

const DEFAULT_STORE_NAME = 'oiso-review-router-config'

const getCredentials = () => {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.BLOBS_SITE_ID
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN ||
    process.env.BLOBS_TOKEN

  if (!siteID && !token) {
    return null
  }

  return { siteID, token }
}

export const createStore = (name = DEFAULT_STORE_NAME, context) => {
  if (context?.netlify?.blobs?.getStore) {
    return context.netlify.blobs.getStore({ name })
  }

  const credentials = getCredentials()
  if (credentials) {
    return getStore({
      name,
      ...credentials,
    })
  }
  return getStore({ name })
}

export const getConfigStore = (context) => createStore(DEFAULT_STORE_NAME, context)
