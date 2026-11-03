// Test mode: on automatically with `npm run dev`, or on the live site by adding ?test
// to the address. It shows the "+ 5 test players" button and makes every tab a
// separate player, so you can test with one browser.
export const isTestMode =
  import.meta.env.DEV || new URLSearchParams(window.location.search).has('test')
