function speedoMeter(sp){
  var maxSp = 12000;
  var speedRatio = Math.min(1, Math.max(0, sp / maxSp));
  var mph = Math.floor(speedRatio * 200); 
  
  var cx = width - 150;
  var cy = height - 150;
  var r = 130; // Gauge radius
  
  ctx.save();
  
  // 1. Outer Bezel
  var gradBezel = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  gradBezel.addColorStop(0, "#8aa0b6");
  gradBezel.addColorStop(0.5, "#4a5a6a");
  gradBezel.addColorStop(1, "#1a2a3a");
  
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = gradBezel;
  ctx.fill();
  
  // Inner dark rim
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
  ctx.fillStyle = "#050505";
  ctx.fill();
  
  var rimGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rimGrad.addColorStop(0, "#222");
  rimGrad.addColorStop(1, "#666");
  ctx.lineWidth = 4;
  ctx.strokeStyle = rimGrad;
  ctx.stroke();
  
  // Screws
  var screwAngles = [0, Math.PI/2, Math.PI, Math.PI*1.5];
  ctx.fillStyle = "#555";
  for(var i=0; i<screwAngles.length; i++) {
    var sx = cx + Math.cos(screwAngles[i]) * (r - 5);
    var sy = cy + Math.sin(screwAngles[i]) * (r - 5);
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Screw slot
    ctx.beginPath();
    ctx.moveTo(sx - 2, sy - 2);
    ctx.lineTo(sx + 2, sy + 2);
    ctx.stroke();
  }

  // 2. Colored Arcs
  var startAng = 150 * Math.PI/180;
  var endAng = 390 * Math.PI/180;
  
  var greenEnd = (150 + (85/140)*240) * Math.PI/180;
  var yellowEnd = (150 + (105/140)*240) * Math.PI/180;
  var arcR = r - 28;
  
  ctx.lineWidth = 14;
  
  // Green
  ctx.beginPath();
  ctx.arc(cx, cy, arcR, startAng, greenEnd);
  ctx.strokeStyle = "#00E500";
  ctx.stroke();
  
  // Yellow
  ctx.beginPath();
  ctx.arc(cx, cy, arcR, greenEnd, yellowEnd);
  ctx.strokeStyle = "#FFE500";
  ctx.stroke();
  
  // Red
  ctx.beginPath();
  ctx.arc(cx, cy, arcR, yellowEnd, endAng);
  ctx.strokeStyle = "#E50000";
  ctx.stroke();

  // Draw discrete block lines to simulate the segmented look in the image
  for(var a = 150; a <= 390; a += 4) {
    ctx.beginPath();
    var segA = a * Math.PI/180;
    ctx.moveTo(cx + Math.cos(segA) * (arcR - 8), cy + Math.sin(segA) * (arcR - 8));
    ctx.lineTo(cx + Math.cos(segA) * (arcR + 8), cy + Math.sin(segA) * (arcR + 8));
    ctx.strokeStyle = "#050505";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 3. Ticks and Labels
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFF";
  ctx.font = "bold 18px 'Exo 2', sans-serif";
  
  for(var v = 0; v <= 140; v += 10) {
    var ang = (150 + (v/140)*240) * Math.PI/180;
    var cosA = Math.cos(ang);
    var sinA = Math.sin(ang);
    
    var isMajor = (v % 20 === 0);
    var inner = isMajor ? arcR - 20 : arcR - 10;
    var outer = arcR - 7; // Ends right before the colored band starts
    
    ctx.beginPath();
    ctx.moveTo(cx + cosA * inner, cy + sinA * inner);
    ctx.lineTo(cx + cosA * outer, cy + sinA * outer);
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = isMajor ? 3 : 1.5;
    ctx.stroke();
    
    if (isMajor) {
      var textX = cx + cosA * (arcR - 35);
      var textY = cy + sinA * (arcR - 35);
      ctx.fillText(v, textX, textY);
    }
  }

  // 4. Digital Readout
  var boxW = 60;
  var boxH = 30;
  var boxX = cx - boxW/2;
  var boxY = cy + 40;
  
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
  } else {
    ctx.rect(boxX, boxY, boxW, boxH);
  }
  ctx.strokeStyle = "#00FFFF";
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.fillStyle = "#00FF00";
  ctx.font = "normal 28px 'DS-DIGIT', sans-serif";
  ctx.fillText(mph, cx, boxY + boxH/2 + 2);
  
  ctx.fillStyle = "#00FFFF";
  ctx.font = "bold 14px 'Exo 2', sans-serif";
  ctx.fillText("MPH", cx, boxY + boxH + 12);

  // 5. Needle
  var needleAng = (150 + Math.min(mph, 160) / 140 * 240 - 90) * Math.PI/180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(needleAng);
  
  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.lineTo(1, arcR - 4);
  ctx.lineTo(-1, arcR - 4);
  ctx.closePath();
  ctx.fillStyle = "#D00000";
  ctx.fill();
  
  // Reset shadow for center cap
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  // Center cap
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI*2);
  ctx.fillStyle = "#222";
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI*2);
  ctx.fillStyle = "#111";
  ctx.fill();
  
  ctx.restore(); // restore translate/rotate
  ctx.restore(); // restore main save
}

function displayCountdown(c){
  if (c === "PRESS ANY KEY/BUTTON") {
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
      ctx.font = "italic 700 36px 'Exo 2', sans-serif";
      
      var text_width = ctx.measureText(c).width;
      // Lower middle center
      ctx.fillText(c, width/2 - text_width/2, height - 100); 
  } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "italic 900 240px 'Exo 2', sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;
      
      var text_width = ctx.measureText(c).width;
      ctx.fillText(c, width/2 - text_width/2, height/2 - 180);
      
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
  }
}

function displayRank(a,b){
  ctx.fillStyle = "#FFD700"; // Gold
  ctx.font = "italic 700 32px 'DS-DIGIT', sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  
  ctx.fillText("RANK: " + a + "/" + b, 30, 60);
  
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}
