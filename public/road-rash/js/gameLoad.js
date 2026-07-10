//game start/loop

var Game = {



  run: function(options) {

    Game.loadImages(options.images, function(images) {

      options.ready(images);

      Game.setKeyListener(options.keys);

      var canvas = options.canvas,
          update = options.update,
          render = options.render,
          step   = options.step,
          now    = null,
          last   = AllFn.timestamp(),
          dt     = 0,
          gdt    = 0;
          
      var pauseScreenImg = new Image();
      pauseScreenImg.src = "images/pause-screen.png";

// console.log(last);
      function frame() {
        now = AllFn.timestamp();
        
        if (gamePaused) {
            last = now; // prevent massive dt buildup
            requestAnimationFrame(frame);
            
            render(); // Render the frozen 3D scene underneath so the overlay doesn't stack to black
            
            // Draw Pause Overlay
              ctx.fillStyle = "rgba(0,0,0,0.7)";
              ctx.fillRect(0,0,width,height);
              
              if (pauseScreenImg.complete && pauseScreenImg.naturalWidth > 0) {
                  ctx.drawImage(pauseScreenImg, 0, 0, width, height);
              }
              
              if (typeof window.pauseMenuIndex === 'undefined') window.pauseMenuIndex = 0;
              
              // Draw Pause Menu
              ctx.textAlign = "center";
              
              var options = ["RESUME GAME", "RESTART GAME", "QUIT"];
              ctx.font = "40px 'Upheaval Pro', sans-serif";
              
              for (var i = 0; i < options.length; i++) {
                  if (i === window.pauseMenuIndex) {
                      ctx.fillStyle = "yellow";
                      ctx.shadowColor = "rgba(255, 255, 0, 0.5)";
                      ctx.shadowBlur = 8;
                  } else {
                      ctx.fillStyle = "white";
                      ctx.shadowColor = "black";
                      ctx.shadowBlur = 4;
                  }
                  ctx.fillText(options[i], width/2, height * 0.65 + (i * 60));
              }
              
              ctx.shadowBlur = 0;
              return;
        }

        if(gameStart){



          dt  = Math.min(1, (now - last) / 1000);
          gdt = gdt + dt;
          while (gdt > step) {
            gdt = gdt - step;
            update(step);
          }
          render();
          
          if (window.goFadeTimer > 0) {
              window.goFadeTimer -= (now - last);
              var goAlpha = Math.max(0, window.goFadeTimer / 1000);
              displayCountdown("GO!", goAlpha);
          }
          
          last = now;
          if(crossFinish){
            if (!window.finishTimerStart) {
                window.finishTimerStart = Date.now();
            }
            
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "italic 900 120px 'Exo 2', sans-serif";
            ctx.shadowColor = "rgba(0,0,0,0.9)";
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            var text_width = ctx.measureText("FINISHED").width;
            ctx.fillText("FINISHED", width/2 - text_width/2, height/2 - 100);
            
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw Leaderboard
            if (window.raceLeaderboard) {
              ctx.font = "italic 700 36px 'DS-DIGIT', sans-serif";
              
              var startY = height/2 - 20;
              for (var i = 0; i < window.raceLeaderboard.length; i++) {
                var entry = window.raceLeaderboard[i];
                var isPlayer = (entry.name === 'player');
                var nameText = (i + 1) + ". " + (isPlayer ? "YOU" : entry.name);
                
                ctx.fillStyle = isPlayer ? "#FFD700" : "#FFFFFF";
                if (isPlayer) {
                  ctx.shadowColor = "#FFD700";
                  ctx.shadowBlur = 15;
                } else {
                  ctx.shadowColor = "black";
                  ctx.shadowBlur = 8;
                }
                
                var entryW = ctx.measureText(nameText).width;
                ctx.fillText(nameText, width/2 - entryW/2, startY + (i * 45));
              }
              
              ctx.shadowBlur = 0;
              
              if (Date.now() - window.finishTimerStart > 2000) {
                  // Flashing restart text
                  var restartText = "PRESS START TO RESTART";
                  var alpha = 0.5 + Math.sin(Date.now() / 400) * 0.5;
                  ctx.fillStyle = "rgba(255, 255, 255, " + alpha + ")";
                  ctx.font = "italic 700 28px 'Exo 2', sans-serif";
                  var rw = ctx.measureText(restartText).width;
                  ctx.fillText(restartText, width/2 - rw/2, 80);

                  // Check gamepad
                  var gpPressed = false;
                  if (navigator.getGamepads) {
                     var pads = navigator.getGamepads();
                     for(var p=0; p<pads.length; p++) {
                        if(pads[p] && pads[p].buttons) {
                           for(var b=0; b<pads[p].buttons.length; b++) {
                               if(pads[p].buttons[b].pressed) gpPressed = true;
                           }
                        }
                     }
                  }

                  // Require release before accept
                  var anyPressed = (typeof keyFaster !== 'undefined' && (keyFaster || keySlower || keyLeft || keyRight)) || gpPressed;
                  
                  if (!window.waitForButtonRelease) {
                      if (!anyPressed) window.waitForButtonRelease = true;
                  } else if (anyPressed) {
                      gameStart = false;
                      crossFinish = false;
                      countdown = 3;
                      window.userInteracted = false;
                      window.finishTimerStart = 0;
                      window.raceLeaderboard = null;
                      window.waitForButtonRelease = false;
                      reset(); 
                  }
              }
            }
          }
        }
        else {
          if (!window.userInteracted) {
            render();
            displayCountdown("PRESS START");
            
            if (navigator.getGamepads) {
               var pads = navigator.getGamepads();
               for(var p=0; p<pads.length; p++) {
                  if(pads[p] && pads[p].buttons) {
                     for(var b=0; b<pads[p].buttons.length; b++) {
                         if(pads[p].buttons[b].pressed) {
                             window.userInteracted = true;
                             if (audioCtx.state === 'suspended') audioCtx.resume();
                         }
                     }
                  }
               }
            }
            last = now; // keep timer fresh
          }
            else {
              render(); // Keep the background rendering
              
              if (typeof window.countdownStarted === 'undefined') {
                  window.countdownStarted = true;
                  countdown = 3;
                  playBeep(440, 0.1);
                  if (typeof engineStartSound !== 'undefined') {
                     engineStartSound.play().catch(e => {});
                  }
                  last = now; // reset timer to start the first 1-second block perfectly
              }
              
              var timeSinceLast = now - last;
              var fadeAlpha = 1.0;
              // Fade out the number during the last 500ms of the 1000ms window
              if (timeSinceLast > 500) {
                 fadeAlpha = Math.max(0, 1.0 - ((timeSinceLast - 500) / 500));
              }
              
              if (timeSinceLast >= 1000) {
                  countdown--;
                  if (countdown == 0) {
                      playBeep(880, 0.4);
                      if (!engineStartSound.paused) {
                        let fadeVol = engineStartSound.volume;
                        let fadeAudio = setInterval(function () {
                          fadeVol -= 0.02;
                          if (fadeVol > 0) {
                              engineStartSound.volume = fadeVol;
                          } else {
                              engineStartSound.pause();
                              engineStartSound.currentTime = 0;
                              engineStartSound.volume = 0.5; // Reset for next race
                              clearInterval(fadeAudio);
                          }
                        }, 50); // Drops by 0.02 every 50ms = takes about 1.25 seconds to fade from 0.5 to 0
                      }
                      
                      gameStart = true;
                      window.goFadeTimer = 1000; // Let GO! fade over 1 second in the main game loop
                      delete window.countdownStarted; // Reset for next race
                  } else {
                        playBeep(440, 0.1);
                  }
                  last = now;
                  timeSinceLast = 0;
                  fadeAlpha = 1.0;
              }
              
              if (!gameStart) {
                  displayCountdown(countdown, fadeAlpha);
              }
            }
        }
        requestAnimationFrame(frame, canvas);
      }
      
      // Global key listener for interaction
        window.addEventListener('keydown', function(ev) {
            window.userInteracted = true;
            if (audioCtx.state === 'suspended') audioCtx.resume();
            if (window.retroAudioEngine) window.retroAudioEngine.resume();
            
            if (typeof gamePaused !== 'undefined' && gamePaused) {
                if (ev.keyCode === 38 || ev.keyCode === 87) { // UP or W
                    window.pauseMenuIndex--;
                    if (window.pauseMenuIndex < 0) window.pauseMenuIndex = 2;
                } else if (ev.keyCode === 40 || ev.keyCode === 83) { // DOWN or S
                    window.pauseMenuIndex++;
                    if (window.pauseMenuIndex > 2) window.pauseMenuIndex = 0;
                } else if (ev.keyCode === 13) { // ENTER
                    if (window.pauseMenuIndex === 0) {
                        gamePaused = false; // Resume
                        if (audioCtx.state === 'suspended') audioCtx.resume();
                        if (window.retroAudioEngine && window.retroAudioEngine.audioCtx.state === 'suspended') window.retroAudioEngine.audioCtx.resume();
                    } else if (window.pauseMenuIndex === 1) {
                        location.reload(); // Full clean restart
                    } else if (window.pauseMenuIndex === 2) {
                        window.location.href = '/'; // Quit
                    }
                }
            }
            
            // Restart the game if at the finish screen and 2 seconds have passed
          if (speed === 0 && crossFinish && window.finishTimerStart && Date.now() - window.finishTimerStart > 2000) {
              // Ignore Escape so it doesn't instantly restart if they were just trying to unpause
              if (ev.keyCode !== 27) {
                  location.reload();
              }
          }
      });
      
      frame();
      });
  },

  loadImages: function(names, callback) {
    var result = [];
    var count  = names.length;

    var onload = function() {
      if (--count == 0)
        callback(result);
    };

    for(var n = 0 ; n < names.length ; n++) {
      var name = names[n];
      result[n] = document.createElement('img');
      getOn.on(result[n], 'load', onload);
      result[n].src = "images/" + name + ".png";
    }
  },

  //---------------------------------------------------------------------------

  setKeyListener: function(keys) {
    var onkey = function(keyCode, mode) {
      var n, k;
      for(n = 0 ; n < keys.length ; n++) {
        k = keys[n];
        k.mode = k.mode || 'up';
        if ((k.key == keyCode) || (k.keys && (k.keys.indexOf(keyCode) >= 0))) {
          if (k.mode == mode) {
            k.action.call();
          }
        }
      }
    };

    getOn.on(document, 'keydown', function(ev) { onkey(ev.keyCode, 'down'); } );
    getOn.on(document, 'keyup',   function(ev) { onkey(ev.keyCode, 'up');   } );
  },

}
