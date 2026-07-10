const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Catch everything directly from the page
    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('ERROR:', err.toString()));
    
    // Go to the game HTML and DO NOT wait for networkidle
    await page.goto('http://localhost:5173/road-rash/game.html');
    
    // Give it 2 seconds to run the game loop and crash
    await new Promise(r => setTimeout(r, 2000));
    
    // Also simulate pressing ArrowUp to trigger the crash
    await page.keyboard.press('ArrowUp');
    await new Promise(r => setTimeout(r, 1000));
    
    // Grab the on-screen error log just in case
    try {
        const errs = await page.$eval('#error-log', el => el.innerHTML);
        console.log('Error Log Div:', errs);
    } catch(e) {
        console.log('Error reading div:', e.message);
    }
    
    await browser.close();
})();
