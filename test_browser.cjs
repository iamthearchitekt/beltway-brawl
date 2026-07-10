const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
        await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));
        await page.keyboard.press('ArrowUp');
        await new Promise(r => setTimeout(r, 2000));
        
        // Find iframe and extract error log
        const frames = page.frames();
        for (const frame of frames) {
            if (frame.url().includes('game.html')) {
                const errorLog = await frame.$eval('#error-log', el => el.innerHTML).catch(() => 'No error log div found');
                console.log('IFRAME ERROR LOG:', errorLog);
            }
        }
        
        await browser.close();
        console.log('Script completed.');
    } catch (e) {
        console.log('PUPPETEER ERROR:', e.toString());
        process.exit(1);
    }
})();
