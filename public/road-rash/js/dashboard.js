function formatTime(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = Math.floor(totalSeconds % 60);
    var ms = Math.floor((totalSeconds * 100) % 100);
    
    var mStr = minutes < 10 ? "0" + minutes : minutes;
    var sStr = seconds < 10 ? "0" + seconds : seconds;
    var msStr = ms < 10 ? "0" + ms : ms;
    
    return mStr + ":" + sStr + ":" + msStr;
}

function renderHUD(speed, rank, maxRank, currentTime) {
    if (!window.dashboardUI) {
        window.dashboardUI = new Image();
        window.dashboardUI.src = "images/game-ui-dashboard.png";
    }

    // Only draw if image is loaded
    if (!window.dashboardUI.complete || window.dashboardUI.naturalWidth === 0) return;

    var maxSp = 12000;
    var speedRatio = Math.min(1, Math.max(0, speed / maxSp));
    // Visually scale: reach 150 early, then slowly creep up to 200
    var mph = Math.round(speedRatio < 0.6 ? (speedRatio / 0.6) * 150 : 150 + ((speedRatio - 0.6) / 0.4) * 50);
    // Dynamic top speed jitter
    if (speedRatio > 0.98) mph = 198 + Math.floor(Math.random() * 3);
    
    // Convert mph integer to a 3-character string with leading spaces
    var mphStr = ("   " + mph).slice(-3);
    
    // Scale the 1672x338 image to fit the width of the canvas, but cap height
    var imgW = window.dashboardUI.naturalWidth;
    var imgH = window.dashboardUI.naturalHeight;
    var scale = width / imgW;
    
    var drawHeight = imgH * scale;
    if (drawHeight > height * 0.28) {
        drawHeight = height * 0.28;
        scale = drawHeight / imgH;
    }
    
    // Shrink by 10%
    scale *= 0.9;
    drawHeight = imgH * scale;
    
    var drawWidth = imgW * scale;
    var drawX = (width - drawWidth) / 2;
    var drawY = height - drawHeight;

    ctx.drawImage(window.dashboardUI, drawX, drawY, drawWidth, drawHeight);

    // Render Text
    ctx.fillStyle = "#00FF00"; // Glowing green
    ctx.shadowColor = "#00FF00";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // POSITION
    var posX = drawX + drawWidth * 0.285;
    var posY = drawY + drawHeight * 0.62; // Nudged down
    ctx.font = "bold " + Math.floor(70 * scale) + "px 'DS-DIGIT', sans-serif"; // Made larger
    ctx.fillText(rank + " / " + maxRank, posX, posY);

    // SPEED (MPH)
    var speedX = drawX + drawWidth * 0.50;
    var speedY = drawY + drawHeight * 0.65; // Nudged down
    ctx.font = "bold " + Math.floor(140 * scale) + "px 'DS-DIGIT', sans-serif"; // Made larger still
    ctx.fillText(mph, speedX, speedY);

    // TIME
    var timeX = drawX + drawWidth * 0.715;
    var timeY = drawY + drawHeight * 0.58; // Matched position height
    ctx.font = "bold " + Math.floor(36 * scale) + "px 'DS-DIGIT', sans-serif"; // Made smaller
    ctx.fillText(formatTime(currentTime), timeX, timeY);
    
    ctx.shadowBlur = 0; // reset
    ctx.textAlign = "left"; // Prevent bleeding to other text rendering
    ctx.textBaseline = "alphabetic";
}

function displayCountdown(c, fadeAlpha = 1.0){
    if (c === "PRESS START") {
        var showFrame2 = Math.floor(Date.now() / 500) % 2 === 0;
        var activeImage = showFrame2 ? window.startScreenImage2 : window.startScreenImage;
        
        // Fallback to frame 1 if frame 2 hasn't loaded yet
        if (!activeImage) activeImage = window.startScreenImage;

        if (activeImage) {
           ctx.drawImage(activeImage, 0, 0, width, height);
        }
        
        // Slow strobe effect
        var alpha = 0.5 + Math.sin(Date.now() / 400) * 0.5; // Oscillates between 0 and 1
        ctx.fillStyle = "rgba(255, 255, 255, " + alpha + ")";
        ctx.font = "40px 'Upheaval Pro', sans-serif";
        
        var text_width = ctx.measureText(c).width;
        // Lower middle center of the visible viewport (just above dashboard)
        ctx.fillText(c, width/2 - text_width/2, height * 0.71); 
    } else {
        // Handle image-based countdown
        if (!window.countdownImages) {
            window.countdownImages = {};
            ['1', '2', '3', 'go'].forEach(function(k) {
                var img = new Image();
                img.src = "images/countdown/" + k.toLowerCase() + ".png";
                window.countdownImages[k.toLowerCase()] = img;
            });
        }

        var key = c.toString().toLowerCase().replace("!", "");
        var img = window.countdownImages[key];
        
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.globalAlpha = fadeAlpha;
            // Scale the image down so it isn't massive (target height ~240px to match old text)
            var targetHeight = 240;
            var scale = targetHeight / img.naturalHeight;
            var w = img.naturalWidth * scale;
            var h = targetHeight;
            
            // Nudge the image up slightly (height/3 instead of height/2)
            ctx.drawImage(img, width/2 - w/2, height/3 - h/2, w, h);
            ctx.globalAlpha = 1.0;
        }
    }
}
