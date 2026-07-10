const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('ERROR:', err.toString()));
    
    try {
        await page.goto('http://localhost:5173/road-rash/game.html', { waitUntil: 'networkidle2', timeout: 5000 });
    } catch(e) {
        console.log('Timeout, but checking anyway');
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    try {
        const errs = await page.$eval('#error-log', el => el.innerHTML);
        console.log('Error Log Div:', errs);
    } catch(e) {
        console.log('No error-log div found');
    }
    
    await browser.close();
})();
