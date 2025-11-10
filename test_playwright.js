import { chromium } from 'playwright'

(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    await page.goto('http://localhost:5173/')

    // 等待呼吸球内的文本元素可见
    const textSelector = '.breathing .ball .ball-content .phase'
    await page.waitForSelector(textSelector, { state: 'visible' })

    // 获取元素的 className 和计算后的样式
    const elementInfo = await page.evaluate((selector) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const computedStyle = window.getComputedStyle(element)
      return {
        className: element.className,
        color: computedStyle.getPropertyValue('color'),
        textShadow: computedStyle.getPropertyValue('text-shadow'),
      }
    }, textSelector)

    console.log('Breathing Ball Text Element Info:', elementInfo)

    await page.screenshot({ path: 'screenshot_after_style_change.png' })
    console.log('Screenshot saved as screenshot_after_style_change.png')

  } catch (error) {
    console.error('Playwright test failed:', error)
  } finally {
    await browser.close()
  }
})()