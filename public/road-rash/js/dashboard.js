function speedoMeter(sp){
  var maxSp = 12000;
  var speedRatio = Math.min(1, Math.max(0, sp / maxSp));
  var mph = Math.floor(speedRatio * 200); // Top speed 200 MPH
  
  // Dashboard background
  var dashX = width - 280;
  var dashY = 20;
  
  ctx.fillStyle = "rgba(10, 15, 20, 0.75)";
  ctx.fillRect(dashX, dashY, 250, 100);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.strokeRect(dashX, dashY, 250, 100);
  
  // MPH Text (LCD Italic)
  ctx.fillStyle = "#00FFCC";
  ctx.font = "italic 700 54px 'DS-DIGIT', sans-serif";
  ctx.shadowColor = "#00FFCC";
  ctx.shadowBlur = 10;
  ctx.fillText(mph, dashX + 20, dashY + 60);
  ctx.shadowBlur = 0;
  
  // "MPH" Label
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "italic 700 18px 'DS-DIGIT', sans-serif";
  ctx.fillText("MPH", dashX + 160, dashY + 60);
  
  // RPM Gauge Background
  var gaugeX = dashX + 20;
  var gaugeY = dashY + 75;
  var gaugeW = 210;
  var gaugeH = 12;
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
  
  // RPM Gauge Fill (Dynamic Gradient)
  if (speedRatio > 0) {
    var gradient = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeW, 0);
    gradient.addColorStop(0, "#00FF00");
    gradient.addColorStop(0.6, "#FFFF00");
    gradient.addColorStop(1, "#FF0000");
    ctx.fillStyle = gradient;
    ctx.fillRect(gaugeX, gaugeY, gaugeW * speedRatio, gaugeH);
  }
}

function displayCountdown(c){
  ctx.fillStyle = "#FF0000";
  ctx.font = "italic 900 120px 'Exo 2', sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 5;
  
  var text_width = ctx.measureText(c).width;
  ctx.fillText(c, width/2 - text_width/2, height/2);
  
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
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
