const loader: { promise?: Promise<Turnstile> } = {}

export function loadTurnstile() {
  loader.promise ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script")
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error("Turnstile did not initialize"))
    }
    script.onerror = () => {
      loader.promise = undefined
      reject(new Error("Turnstile failed to load"))
    }
    document.head.append(script)
  })

  return loader.promise
}
