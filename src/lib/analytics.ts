import posthog from 'posthog-js'

const key = import.meta.env.VITE_POSTHOG_KEY || ''
if (key) {
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.opt_out_capturing()
    },
  })
}

export default posthog
