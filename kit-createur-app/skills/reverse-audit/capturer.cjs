// Capture d'audit : pleine page (clair, sombre), mobile, jetons CSS et polices.
// Usage : node .claude/skills/reverse-audit/capturer.cjs <url> <dossier>
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

;(async () => {
  const [url, dossier = 'audit'] = process.argv.slice(2)
  if (!url) throw new Error('Usage : capturer.cjs <url> <dossier>')
  fs.mkdirSync(dossier, { recursive: true })
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined
  const b = await chromium.launch(proxy ? { proxy } : {})
  for (const [nom, vue, schema] of [
    ['bureau-clair', { width: 1440, height: 900 }, 'light'],
    ['bureau-sombre', { width: 1440, height: 900 }, 'dark'],
    ['mobile', { width: 390, height: 844 }, 'light'],
  ]) {
    const ctx = await b.newContext({ viewport: vue, deviceScaleFactor: 2, colorScheme: schema, ignoreHTTPSErrors: true })
    const p = await ctx.newPage()
    await p.goto(url, { waitUntil: 'networkidle' })
    await p.waitForTimeout(2000)
    await p.screenshot({ path: path.join(dossier, `${nom}.png`), fullPage: true })
    if (nom === 'bureau-clair') {
      const jetons = await p.evaluate(() => {
        const vars = {}
        for (const s of document.styleSheets) {
          try {
            for (const r of s.cssRules) {
              if (r.selectorText && /:root|\[data-theme|html|\.dark|body/.test(r.selectorText))
                for (const n of r.style) if (n.startsWith('--')) vars[`${r.selectorText} ${n}`] = r.style.getPropertyValue(n).trim()
            }
          } catch {}
        }
        const style = (sel) => {
          const e = document.querySelector(sel)
          if (!e) return null
          const c = getComputedStyle(e)
          return { police: c.fontFamily, taille: c.fontSize, graisse: c.fontWeight, approche: c.letterSpacing, rayon: c.borderRadius, fond: c.backgroundColor, ombre: c.boxShadow }
        }
        return {
          polices: [...new Set([...document.fonts].map((f) => `${f.family} ${f.weight}`))],
          vars,
          h1: style('h1'),
          bouton: style('button'),
          corps: style('body'),
          classes: [...new Set([...document.querySelectorAll('[class]')].map((e) => e.className).filter((x) => typeof x === 'string'))].slice(0, 200),
        }
      })
      fs.writeFileSync(path.join(dossier, 'jetons.json'), JSON.stringify(jetons, null, 1))
    }
    await ctx.close()
  }
  await b.close()
  console.log(`Captures et jetons écrits dans ${dossier}`)
})()
