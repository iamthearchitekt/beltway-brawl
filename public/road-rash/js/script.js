window.onerror = function(msg, url, lineNo, columnNo, error) {
    alert("CRASH: " + msg + "\nLine: " + lineNo + "\n" + (error && error.stack));
    return false;
};

function update(dt) {
  
    // Track elapsed race time
    if (typeof window.raceTime === 'undefined') window.raceTime = 0;
    if (gameStart && !playerFinish) {
      window.raceTime += dt;
    }

  // Gamepad polling
  if (navigator.getGamepads) {
    var pads = navigator.getGamepads();
    var pad = pads[0];
    if (pad) {
      keyFaster = (pad.axes[1] < -0.5) || (pad.buttons[12] && pad.buttons[12].pressed) || (pad.buttons[0] && pad.buttons[0].pressed);
      keySlower = (pad.axes[1] > 0.5) || (pad.buttons[13] && pad.buttons[13].pressed) || (pad.buttons[1] && pad.buttons[1].pressed);
      keyLeft   = (pad.axes[0] < -0.5) || (pad.buttons[14] && pad.buttons[14].pressed);
      keyRight  = (pad.axes[0] > 0.5) || (pad.buttons[15] && pad.buttons[15].pressed);
      
      // Attacks: B (button 1/2) for right, C (button 2/3) for left, depending on the controller mapping
      var attackRight = (pad.buttons[2] && pad.buttons[2].pressed) || (pad.buttons[5] && pad.buttons[5].pressed);
      var attackLeft = (pad.buttons[3] && pad.buttons[3].pressed) || (pad.buttons[4] && pad.buttons[4].pressed);
      
      if (attackLeft) { keyQ = true; keyZ = true; } else { keyQ = false; keyZ = false; }
      if (attackRight) { keyE = true; keyC = true; } else { keyE = false; keyC = false; }
    }
  }

  if (window.playerAttackTimer === undefined) {
    window.playerAttackTimer = -1.5;
    window.playerAttackSide = 0;
  }
  if (window.playerCrashedTimer === undefined) {
    window.playerCrashedTimer = 0;
  }
  if (window.playerCrashedTimer > 0) {
    window.playerCrashedTimer -= dt;
    if (window.playerCrashedTimer < 0) window.playerCrashedTimer = 0;
  }

  if (window.playerAttackTimer > -1.5) {
    window.playerAttackTimer -= dt;
  }
  
  var n, car, carW,bike,bikeW,sprite, spriteW;
  var playerSegment = findSegment(position+playerZ);
  var playerW       = SPRITES.PLAYER_STRAIGHT.w * SPRITES.SCALE;

  if (window.playerAttackTimer <= -1.5) {
    if (keyZ || keyQ || keyC || keyE) {
      window.playerAttackTimer = 0.3; // 300ms total animation
      swingWhiffSound.currentTime = 0;
      swingWhiffSound.play().catch(e=>{});
      var closestBike = null;
      var closestDist = Infinity;
      var searchSegments = [playerSegment, findSegment(position+playerZ+segmentLength)];
      
      for(var s=0; s<2; s++) {
        var seg = searchSegments[s];
        for (var i = 0; i < seg.bikes.length; i++) {
           var b = seg.bikes[i];
           var dz = Math.abs(b.z - (position+playerZ));
           if (dz < 1500) { // Only auto-detect bikes in combat range
               var dx = Math.abs(b.offset - playerX) * 1000; // scale horizontal offset
               var distSq = (dx * dx) + (dz * dz);
               if (distSq < closestDist) {
                   closestDist = distSq;
                   closestBike = b;
               }
           }
        }
      }
      
      if (closestBike) {
         window.playerAttackSide = (closestBike.offset > playerX) ? 1 : -1;
      } else {
         window.playerAttackSide = (keyC || keyE) ? 1 : -1; // Fallback to explicit key direction
      }
    }
  }

  var speedPercent  = speed/maxSpeed;
  var dx            = dt * 2 * speedPercent;
  // var unow = AllFn.timestamp();

  // var startPosition = position;

  // Racing Line Advantage (Player)
  // The curve value indicates bend direction. Positive playerX on a positive curve = inside line (apex).
  // curveAdvantage > 0 means player is on the inside of the turn (correct racing line).
  // curveAdvantage < 0 means player is on the outside (wrong line, fighting the corner).
  var clampedOffset = Math.max(-1, Math.min(1, playerX));
  var curveAdvantage = playerSegment.curve * clampedOffset;
  
  // Position advance multiplier: inside line = shorter arc = more ground covered
  var speedMultiplier = 1.0 + (curveAdvantage * 0.08); // Up to ~25% faster on apex, ~25% slower wide
  speedMultiplier = Math.max(0.75, Math.min(1.25, speedMultiplier));
  
  // Racing line friction factor: inside line bleeds almost no speed, outside line bleeds a lot
  // This is stored for use in the cornering friction block below
  window.racingLineFrictionFactor = 1.0 - (curveAdvantage * 0.6); // 0.4 on apex, 1.6 on outside line
  window.racingLineFrictionFactor = Math.max(0.1, Math.min(1.8, window.racingLineFrictionFactor));
  
  position = AllFn.increase(position, dt * speed * speedMultiplier, trackLength);
  currentPosition += dt * speed;

  // Jump Physics (Catch Air)
  if (window.playerElevation === undefined) {
      window.playerElevation = 0;
      window.playerVelocityY = 0;
  }
  var playerPercent = AllFn.percentRemaining(position+playerZ, segmentLength);
  var worldY = AllFn.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);
  
  var isSticking = true; // Heavy bikes ALWAYS stick to the road
  
  if (isSticking) {
      window.playerElevation = worldY;
      window.playerVelocityY = 0;
  } else {
      window.playerVelocityY -= 40000 * dt; // Heavy arcade gravity (snappy jumps)
      window.playerElevation += window.playerVelocityY * dt;
      if (window.playerElevation < worldY) {
          window.playerElevation = worldY;
          window.playerVelocityY = 0;
      }
  }

    var currentPosition = position;
    position = AllFn.increase(position, dt * speed, trackLength);
    // Trigger finish ONLY when position wraps from end of track to beginning
    if (position < currentPosition && currentPosition > trackLength / 2) {
      crossFinish = true;
      if (!window.playerFinishTime) window.playerFinishTime = window.raceTime;
    }

  skyOffset  = AllFn.increase(skyOffset,  skySpeed  * playerSegment.curve * speedPercent, 1);
  hillOffset = AllFn.increase(hillOffset, hillSpeed * playerSegment.curve * speedPercent, 1);
  treeOffset = AllFn.increase(treeOffset, treeSpeed * playerSegment.curve * speedPercent, 1);

// console.log(countdown);

  if(!crossFinish){

    updateBikes(dt,playerSegment, playerW);
    updateCars(dt, playerSegment,playerW);

    updatePlayerPosition();

    if (keyLeft) {
      playerLean = Math.max(playerLean - 2 * dt, -1);
    } else if (keyRight) {
      playerLean = Math.min(playerLean + 2 * dt, 1);
      } else {
        playerLean = playerLean > 0 ? Math.max(playerLean - 2 * dt, 0) : Math.min(playerLean + 2 * dt, 0);
      }
  
      // Apply lean to velocity (Increased steering authority to counter higher centrifugal forces)
      playerVelocityX = playerLean * dx * 2.0;
      playerX += playerVelocityX;

      playerX = playerX - (dx * speedPercent * playerSegment.curve * centrifugal);
  
      if (!gameStart) {
        speed = 0; // Completely prevent the player from getting a head start during the countdown
      } else if (window.playerCrashedTimer > 0) {
        speed = AllFn.accelerate(speed, decel * 2, dt); // Decelerate quickly if crashed
        } else if (keyFaster) {
          // Dynamic acceleration: Fast off the line, agonizingly gradual near 200mph
          var currentAccel = accel * Math.max(0.1, 1.5 - Math.pow(speed / maxSpeed, 2) * 1.4); 
          speed = AllFn.accelerate(speed, currentAccel, dt);
          // Hard cap player speed so they can't infinitely accelerate away from the pack
          speed = Math.min(speed, maxSpeed * 1.15);
        }
      else if (keySlower) {
        speed = AllFn.accelerate(speed, breaking, dt);
      }
      else {
        speed = AllFn.accelerate(speed, decel, dt);
      }
      
      // Cornering friction scaled by racing line.
      // Inside line (apex) = minimal friction. Outside line = heavy friction.
      // The player's advantage comes from the ANGLE they take, not braking.
      if (Math.abs(playerSegment.curve) > 0.3 && speed > maxSpeed * 0.35) {
        var baseFriction = Math.abs(playerSegment.curve) * 500 * dt;
        var lineFactor = window.racingLineFrictionFactor || 1.0;
        var cornerFriction = baseFriction * lineFactor;
        speed = Math.max(speed - cornerFriction, maxSpeed * 0.35);
      }
  }
  else{
    // Hard decelerate player after finish line
    speed = AllFn.accelerate(speed, breaking, dt);
    if (speed < 0) speed = 0;
    
    // Still update AI so they line up at the finish line!
    updateBikes(dt, playerSegment, playerW);
    updateCars(dt, playerSegment, playerW);
    updatePlayerPosition();
  }



  if (((playerX < -1) || (playerX > 1)) && (speed > offRoadLimit))
    speed = AllFn.accelerate(speed, offRoadDecel, dt);

  // Spawn Player Dust — screen-space particles, dead simple and guaranteed visible
  if (Math.abs(playerX) > 0.9 && speed > maxSpeed * 0.1) {
    for (var ds = 0; ds < 3; ds++) {
      dustParticles.push({
        sx:    width/2 + (Math.random() - 0.5) * 20, // Centered strictly on the tire
        sy:    height - 5 + (Math.random() * 10), // Pinned down to the bottom of the wheel
        vx:    (Math.random() - 0.5) * 60,
        vy:    -(20 + Math.random() * 40), // Float up gently
        r:     4 + Math.random() * 6, // Start as tiny pixels
        life:  0.5 + Math.random() * 0.4,
        maxLife: 1.0
      });
    }
  }

  // Update dust particles
  for (var di = dustParticles.length - 1; di >= 0; di--) {
    var dp = dustParticles[di];
    dp.life -= dt;
    if (dp.life <= 0) { dustParticles.splice(di, 1); continue; }
    dp.sx += dp.vx * dt;
    dp.sy += dp.vy * dt;
    dp.r  += dt * 15;
  }

  if ((playerX < -1) || (playerX > 1)) {

    if (speed > offRoadLimit)
      speed = AllFn.accelerate(speed, offRoadDecel, dt);

    for(n = 0 ; n < playerSegment.sprites.length ; n++) {
      sprite  = playerSegment.sprites[n];
      spriteW = sprite.source.w * SPRITES.SCALE;
      if (AllFn.overlap(playerX, playerW, sprite.offset + spriteW/2 * (sprite.offset > 0 ? 1 : -1), spriteW)) {
        if (window.playerCrashedTimer <= 0) {
          crash.play();
          window.playerCrashedTimer = 3.0;
          speed = maxSpeed/5;
          position = AllFn.increase(playerSegment.p1.world.z, -playerZ, trackLength);
        }
        break;
      }
    }
  }


    // Guard: never re-trigger while already crashed — prevents horn spam and position-reset loop
    if (window.playerCrashedTimer <= 0) {
      for(n = 0 ; n < playerSegment.cars.length ; n++) {
        car  = playerSegment.cars[n];
        
        var carSegScale = AllFn.interpolate(
          playerSegment.p1.screen.scale,
          playerSegment.p2.screen.scale,
          car.percent
        );
        carW = car.sprite.w * SPRITES.SCALE * 0.55 * (carSegScale / SPRITES.SCALE) * roadWidth;
        
        var speedDiff = speed - car.speed;
        if (speedDiff > 0 || car.originalSpeed < 0) {
          if (AllFn.overlap(playerX, playerW, car.offset, carW, 0.75)) {
            playHonk();
            crash.play();
            window.playerCrashedTimer = 3.0;
            
            if (car.originalSpeed < 0) {
                car.speed = 0;
                speed = 0;
            } else {
                car.speed = 0;
                car.stunTimer = 1.5;
                speed = car.originalSpeed;
            }
            
            position = AllFn.increase(car.z, -playerZ, trackLength);
            break;
          }
        }
      }
    }


  for(n = 0 ; n < playerSegment.bikes.length ; n++) {
    bike  = playerSegment.bikes[n];
    bikeW = 21 * SPRITES.SCALE;
    
    // Weapon range is horizontally generous (0.45)
    if (Math.abs(playerX - bike.offset) < 0.45) {
      var isSwingingRight = (window.playerAttackSide === 1 && window.playerAttackTimer > 0);
      var isSwingingLeft = (window.playerAttackSide === -1 && window.playerAttackTimer > 0);
      var hitLanded = false;

      if (playerX < bike.offset && isSwingingRight){
        if (typeof crowbarHitSound !== 'undefined') { crowbarHitSound.currentTime = 0; crowbarHitSound.play().catch(e => {}); }
        bike.offset += 0.5; // knock them away
        bike.health = (bike.health || 3) - 1;
        bike.damageTimer = 0.5;
        bike.damageSide = 1; // hit on their left, pushes them right
        if (bike.health <= 0) { bike.speed = 0; bike.crashedTimer = 3.0; } // knock them down!
        hitLanded = true;
      }
      else if (playerX > bike.offset && isSwingingLeft){
        if (typeof crowbarHitSound !== 'undefined') { crowbarHitSound.currentTime = 0; crowbarHitSound.play().catch(e => {}); }
        bike.offset -= 0.5; // knock them away
        bike.health = (bike.health || 3) - 1;
        bike.damageTimer = 0.5;
        bike.damageSide = -1; // hit on their right, pushes them left
        if (bike.health <= 0) { bike.speed = 0; bike.crashedTimer = 3.0; } // knock them down!
        hitLanded = true;
      }
    }
      
      // Physical body collision
      if (!hitLanded && AllFn.overlap(playerX, playerW, bike.offset, bikeW, 0.7) && window.playerCrashedTimer <= 0) {
        if (speed > bike.speed + (maxSpeed/4)) {
            crash.play();
            window.playerCrashedTimer = 3.0; // 3 second crash penalty
            speed = bike.speed;
            position = AllFn.increase(bike.z, -playerZ, trackLength);
        } else {
            // PIT Maneuver vs Soft Grind
            var isPittingRight = (playerX < bike.offset && keyRight);
            var isPittingLeft  = (playerX > bike.offset && keyLeft);

            if (isPittingRight || isPittingLeft) {
                // Hard PIT maneuver: shove the enemy hard!
                if (playerX < bike.offset) {
                    bike.offset += 0.25; 
                    playerX -= 0.05; // slight recoil
                } else {
                    bike.offset -= 0.25;
                    playerX += 0.05;
                }
                speed *= 0.98;
            } else {
                // Soft bump: just grind against them
                if (playerX < bike.offset) {
                    playerX -= 0.02; 
                    bike.offset += 0.02; 
                } else {
                    playerX += 0.02; 
                    bike.offset -= 0.02; 
                }
                speed *= 0.995; // very minor penalty
            }
            
            playerX = AllFn.limit(playerX, -3, 3);
            bike.offset = AllFn.limit(bike.offset, -3, 3);
        }
      }
  }



  playerX = AllFn.limit(playerX, -3, 3);
  speed   = AllFn.limit(speed, 0, maxSpeed);


  // console.log(AllFn.toInt(position));
  // if(position < playerZ){
  //   console.log(player);
  //   // if(gmOv>4){
  //   //   // gameOver();
  //   //   // console.log(gmOv);
  //   // }
  //   // else
  //     gmOv++;
  // }

  if (window.retroAudioEngine) {
      window.retroAudioEngine.update(
          dt, 
          speed, 
          window.lastFrameSpeed || 0, 
          keyFaster ? 1.0 : 0.0, 
          (window.playerElevation > worldY + 10), 
          (window.playerCrashedTimer > 0)
      );
      window.lastFrameSpeed = speed;
  }
}




function updateBikes(dt, playerSegment, playerW) {
  var m, bike, oldSegment, newSegment;

  for (m = 0; m < bikes.length; m++) {
    bike       = bikes[m];
    oldSegment = findSegment(bike.z);

    // Crash: sit still until timer expires
    if (bike.crashedTimer > 0) {
      bike.crashedTimer -= dt;
      if (bike.crashedTimer < 0) bike.crashedTimer = 0;
      bike.speed = 0;
      continue;
    }

      // --- SPEED (Road Rash 3 model: target speed + rubber band) ---
      var targetSpeed = 0;
      var currentBikeAccel = accel * bike.accelMult;
      
      if (!gameStart || bike.finished) {
        targetSpeed = 0;
      } else {
        // Rubber band and swarming logic
        var dist = bike.z - (position + playerZ);
        if (dist <  -trackLength/2) dist += trackLength;
        if (dist >   trackLength/2) dist -= trackLength;
        
        var isStartOfRace = (position < 20000); // The first several seconds of the race
        
        if (isStartOfRace) {
           // Everyone blasts off the line to create initial separation
           targetSpeed = maxSpeed * 1.3; 
           currentBikeAccel *= 5.0; 
        } else {
           var dist = bike.z - (position + playerZ);
           if (dist < -trackLength/2) dist += trackLength;
           if (dist >  trackLength/2) dist -= trackLength;

           // Ensure AI always maintains a minimum speed even if the player is parked/crashed
           var basePlayerSpeed = Math.max(speed, maxSpeed * 0.85);
           var error = (bike.targetOffsetZ || 0) - dist;

           if (error > 0) {
              // Behind target gap: PUNCH IT — scale boost by how far back they are
              var catchupFactor = Math.min(error / 15000, 2.0);
              targetSpeed = Math.max(basePlayerSpeed * (1.1 + catchupFactor), maxSpeed * 0.9);
              currentBikeAccel *= 5.0;
           } else {
              // At or ahead of target gap: race normally at their own top speed
              // Only apply a gentle cap if they're so far ahead they risk lapping the player
              targetSpeed = maxSpeed * bike.maxSpeedMult;
              if (dist > 60000) targetSpeed *= 0.85; // Only coast if nearly a lap ahead
           }

           // SWARM / COMBAT: right on the player, go hard
           if (Math.abs(dist) < 2000) {
              targetSpeed = Math.max(targetSpeed, basePlayerSpeed * 1.05 + Math.random() * 800);
              currentBikeAccel *= 1.5;
           }
        }
      }

      if (bike.speed < targetSpeed)
        bike.speed = Math.min(bike.speed + currentBikeAccel * dt, targetSpeed);
      else
        bike.speed = Math.max(bike.speed - accel * dt, targetSpeed);
      bike.speed = AllFn.limit(bike.speed, 0, maxSpeed * 3.0); // Allow AI to reach up to 3.0x maxSpeed to guarantee they can catch up

    // --- COMBAT LOGIC ---
    var bikeW = 21 * SPRITES.SCALE;
    if (bike.attackTimer === undefined) bike.attackTimer = 0;
    if (bike.damageTimer === undefined) bike.damageTimer = 0;
    
    var nearPlayer = (Math.abs(bike.z - (position + playerZ)) < segmentLength * 2);
    if (nearPlayer && bike.crashedTimer <= 0 && window.playerCrashedTimer <= 0 && gameStart) {
      // Check if we can swing at player
      var playerDist = Math.abs(bike.offset - playerX);
      if (playerDist < 0.9 && playerDist > 0.2) {
         if (bike.attackTimer <= 0 && Math.random() < 0.05 * bike.hostility) {
            bike.attackTimer = 0.3; // Swing animation
            bike.attackSide = (playerX > bike.offset) ? 1 : -1;
         }
      }
    }

    if (bike.attackTimer > 0) {
      bike.attackTimer -= dt;
      if (bike.attackTimer <= 0 && nearPlayer && window.playerCrashedTimer <= 0) {
        // Hit detection against player
        if (AllFn.overlap(bike.offset, bikeW, playerX, playerW, 1.2)) {
          var currentlyOnRight = (playerX > bike.offset);
          if ((bike.attackSide === 1 && currentlyOnRight) || (bike.attackSide === -1 && !currentlyOnRight)) {
            // Player gets hit by AI
            crash.play();
            window.playerCrashedTimer = 3.0;
            speed = maxSpeed / 5;
            position = AllFn.increase(playerSegment.p1.world.z, -playerZ, trackLength);
          }
        }
      }
    }

    if (bike.damageTimer > 0) {
      bike.damageTimer -= dt;
    }
      // --- STEERING (Road Rash 3 model: steer to avoid obstacles, recover from edge) ---
      var steerDir = 0;

      // Look ahead for obstacles to dodge. Lower skill = lower lookahead (they dodge very late)
      var lookahead = Math.floor(2 + bike.skillLevel * 13);
      for (var i = 1; i < lookahead && steerDir === 0; i++) {
        var seg = segments[(oldSegment.index + i) % segments.length];

        // Dodge player
        if (seg === playerSegment && bike.speed > speed &&
            AllFn.overlap(playerX, playerW, bike.offset, bikeW, 1.1)) {
          steerDir = (bike.offset >= playerX) ? (0.8/i) : -(0.8/i);
        }

        // Dodge traffic cars
        for (var k = 0; k < seg.cars.length && steerDir === 0; k++) {
          var oc = seg.cars[k];
          if (bike.speed > oc.speed &&
              AllFn.overlap(bike.offset, bikeW, oc.offset, oc.sprite.w * SPRITES.SCALE, 1.1)) {
            steerDir = (bike.offset >= oc.offset) ? (0.8/i) : -(0.8/i);
          }
        }
      }

      // Gentle drift back toward preferred lane when no obstacles
      if (steerDir === 0) {
        var laneTarget = bike.laneOffset || 0;
        var diff = laneTarget - bike.offset;
        steerDir = Math.max(-0.3, Math.min(0.3, diff * 2.0));
      }

      // Softly nudge away from extreme dirt edges
      if (bike.offset < -2.0) steerDir += 0.5;
      if (bike.offset >  2.0) steerDir -= 0.5;

      // --- CURVE SPEED LOSS (Core Road Rash mechanic) ---
      // All AI bikes lose speed on curves. Higher skill = less loss.
      // This is what lets the player gain ground by braking and apexing properly.
      if (Math.abs(oldSegment.curve) > 0.3) {
          var curveMagnitude = Math.abs(oldSegment.curve);
          // Elite (skill 0.85-1.0) lose very little. Novices (0.1-0.4) lose a lot.
          var skillFactor = 1.0 - bike.skillLevel; // 0 for perfect, 0.9 for novice
          var bikeCornerFriction = curveMagnitude * (800 + skillFactor * 1200) * dt;
          var bikeSpeedFloor = maxSpeed * (0.35 + bike.skillLevel * 0.15); // Elites hold higher floor speed
          bike.speed = Math.max(bike.speed - bikeCornerFriction, bikeSpeedFloor);
      }

      // --- CURVE DRIFT (Low skill bikes physically drift outward on turns) ---
      if (bike.skillLevel < 0.9 && Math.abs(oldSegment.curve) > 0.5) {
          var drift = oldSegment.curve * (1.0 - bike.skillLevel) * dt * 2.0;
          bike.offset -= drift; // Centrifugal drift outward
      }

      bike.offset += steerDir * dt * 3.0;
      // Hard clamp so they physically never exit the dirt shoulder boundary
      bike.offset  = Math.max(-2.5, Math.min(2.5, bike.offset));

    // --- SPRITE SELECTION (Dynamic) ---
    // Calculate a target lean based on steering and the road curve
    var targetLean = steerDir * 1.5; 
    targetLean += oldSegment.curve * 0.15; // Lean into the curve
    
    // Smooth the visual lean to prevent rapid flickering
    if (bike.visualLean === undefined) bike.visualLean = 0;
    bike.visualLean += (targetLean - bike.visualLean) * dt * 6.0;

    bike.flipX = false;
    if (bike.crashedTimer > 0) {
      if (bike.crashedTimer > 2.0) bike.sprite = SPRITES.ENEMY_DEATH1 || SPRITES.BIKE01;
      else if (bike.crashedTimer > 1.0) bike.sprite = SPRITES.ENEMY_DEATH2 || SPRITES.BIKE01;
      else bike.sprite = SPRITES.ENEMY_DEATH3 || SPRITES.BIKE01;
    } else if (bike.damageTimer > 0) {
      if (bike.damageSide === 1) bike.sprite = SPRITES.ENEMY_DAMAGE_RIGHT || SPRITES.BIKE01;
      else bike.sprite = SPRITES.ENEMY_DAMAGE_LEFT || SPRITES.BIKE01;
    } else if (bike.attackTimer > 0) {
      if (bike.attackTimer > 0.15) {
         bike.sprite = SPRITES.ENEMY_WIND_RIGHT || SPRITES.BIKE01;
      } else {
         bike.sprite = SPRITES.ENEMY_SWING_RIGHT || SPRITES.BIKE01;
      }
      if (bike.attackSide === -1) bike.flipX = true; // Mirror the right swing sprite
    } else {
      if (bike.visualLean < -0.5) bike.sprite = SPRITES.ENEMY_HARD_LEFT || SPRITES.BIKE01;
      else if (bike.visualLean < -0.15) bike.sprite = SPRITES.ENEMY_LEFT || SPRITES.BIKE01;
      else if (bike.visualLean > 0.5) bike.sprite = SPRITES.ENEMY_HARD_RIGHT || SPRITES.BIKE01;
      else if (bike.visualLean > 0.15) bike.sprite = SPRITES.ENEMY_RIGHT || SPRITES.BIKE01;
      else if (bike.speed > maxSpeed * 0.5) bike.sprite = SPRITES.ENEMY_ACCEL || SPRITES.BIKE01;
      else bike.sprite = SPRITES.ENEMY_DRIVE || SPRITES.BIKE01;
    }

    // --- MOVE FORWARD ---
    var oldZ = bike.z;
    bike.z = AllFn.increase(bike.z, dt * bike.speed, trackLength);

    // Finish line: bike wraps the track, meaning it crossed the finish line
    if (bike.z < oldZ && (position + playerZ) > trackLength / 2) {
      bike.finished = true;
      if (!bike.finishTime) bike.finishTime = window.raceTime;
      // Park the bike exactly at the finish line and hold it there
      bike.z = trackLength - playerZ - segmentLength * 2;
      bike.speed = 0;
    }
    
    // If already finished, keep it pinned at the finish line
    if (bike.finished) {
      bike.speed = 0;
      bike.z = trackLength - playerZ - segmentLength * 2;
    }

    // Update segment membership
    newSegment = findSegment(bike.z);
    if (oldSegment !== newSegment) {
      var ix = oldSegment.bikes.indexOf(bike);
      if (ix > -1) oldSegment.bikes.splice(ix, 1);
      newSegment.bikes.push(bike);
    }

    bike.percent = AllFn.percentRemaining(bike.z, segmentLength);
  }
}

function handleBikeDirection(bike, bikeSegment, playerSegment, playerW) {
  // Kept for compatibility but logic moved into updateBikes above
  return 0;
}


function updateCars(dt, playerSegment, playerW) {
    var n, car, oldSegment, newSegment;
    for(n = 0 ; n < cars.length ; n++) {
      car         = cars[n];
      
      // Handle resuming from collisions
      if (car.originalSpeed < 0) {
          if (car.speed === 0) {
              // Oncoming car waits until player is totally out of the way (ignoring X offset)
              var zDist = Math.abs(car.z - (position + playerZ));
              var isNear = (zDist < segmentLength * 10) || (trackLength - zDist < segmentLength * 10);
              if (!isNear) {
                  car.speed = car.originalSpeed;
              }
          }
      } else {
          if (car.stunTimer > 0) {
              car.stunTimer -= dt;
              if (car.stunTimer <= 0) {
                  car.speed = car.originalSpeed;
              }
          }
      }

      oldSegment  = findSegment(car.z);
    car.offset  = car.offset + handleCarDirection(car, oldSegment, playerSegment, playerW);
      
      // Enforce strict lane boundaries so they never swerve off the road or cross the center line
      if (car.speed < 0) {
          car.offset = -0.5; // Locked dead center in left lane
      } else {
          car.offset = 0.5; // Locked dead center in right lane
      }

      car.z       = AllFn.increase(car.z, dt * car.speed, trackLength);
    car.percent = AllFn.percentRemaining(car.z, segmentLength);
    newSegment  = findSegment(car.z);
    if (oldSegment != newSegment) {
      index = oldSegment.cars.indexOf(car);
      oldSegment.cars.splice(index, 1);
      newSegment.cars.push(car);
    }
  }
}

function handleCarDirection(car, carSegment, playerSegment, playerW) {
    if (car.speed < 0) return 0; // Oncoming cars stubbornly stay in their lane

    var i, j, dir, segment, othercar, othercarW, lookahead = 20, carW = 99 * SPRITES.SCALE;

  //when out of render distance, no need to handle the offset
  if ((carSegment.index - playerSegment.index) > drawDistance)
    return 0;

  for(i = 1 ; i < lookahead ; i++) {
    segment = segments[(carSegment.index+i)%segments.length];

    if ((segment === playerSegment) && (car.speed > speed) && (AllFn.overlap(playerX, playerW, car.offset, carW, 1.2))) {
      if (playerX > 0.5)
        dir = -1;
      else if (playerX < -0.5)
        dir = 1;
      else
        dir = (car.offset > playerX) ? 1 : -1;
      return dir * 1/i * (car.speed-speed)/maxSpeed;
    }

    for(j = 0 ; j < segment.cars.length ; j++) {
      othercar  = segment.cars[j];
      othercarW = 99 * SPRITES.SCALE;
      if ((car.speed > othercar.speed) && AllFn.overlap(car.offset, carW, othercar.offset, othercarW, 1.2)) {
        if (othercar.offset > 0.5)
          dir = -1;
        else if (othercar.offset < -0.5)
          dir = 1;
        else
          dir = (car.offset > othercar.offset) ? 1 : -1;
        return dir * 1/i * (car.speed-othercar.speed)/maxSpeed;
      }
    }
  }

  if (car.offset < -0.9)
    return 0.1;
  else if (car.offset > 0.9)
    return -0.1;
  else
    return 0;
}


function render() {

  var baseSegment   = findSegment(position);
  var basePercent   = AllFn.percentRemaining(position, segmentLength);
  var playerSegment = findSegment(position+playerZ);
  var playerPercent = AllFn.percentRemaining(position+playerZ, segmentLength);
  var playerY       = AllFn.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);
  var maxy          = height;

  var x  = 0;
  var dx = - (baseSegment.curve * basePercent);

  ctx.clearRect(0, 0, width, height);

  // Smooth sunset gradient
  var gradient = ctx.createLinearGradient(0, 0, 0, height * 0.35 + 100);
  gradient.addColorStop(0, "#1F0322");   // Deep purple/black at the top
  gradient.addColorStop(0.3, "#8A1C49"); // Crimson red
  gradient.addColorStop(0.6, "#E25822"); // Sunset orange
  gradient.addColorStop(1, "#FCD02D");   // Golden yellow near the horizon
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Draw the low glowing sun — fixed in the world coordinates
  ctx.save();
  // Use skyOffset to simulate the sun being a fixed point in the world
  // skyOffset goes 0 to 1 for a full 360 degree rotation. Let's make the 360 view 4x the screen width.
  var fovWidth = width * 4; 
  var sunX = width / 2 - (skyOffset * fovWidth);
  // Wrap sunX so it stays within a continuous 360 panorama
  sunX = sunX % fovWidth;
  if (sunX > fovWidth / 2) sunX -= fovWidth;
  if (sunX < -fovWidth / 2) sunX += fovWidth;
  
  // Lift the sun much higher into the sky
  var sunY = height * 0.15; 

  ctx.beginPath();
  ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
  ctx.fillStyle = '#FFE680';

  // Intense outer orange glow
  ctx.shadowColor = '#FF8C00';
  ctx.shadowBlur = 70;
  ctx.fill();

  // Tighter white-yellow core pop
  ctx.shadowColor = '#FFFFFF';
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();





  var n, i, segment, car,bike, sprite, spriteScale, spriteX, spriteY;


  for(n = 0 ; n < drawDistance ; n++) {


    segment        = segments[(baseSegment.index + n) % segments.length];
    segment.looped = segment.index < baseSegment.index;
    segment.clip   = maxy;

    AllFn.project(segment.p1, (playerX * roadWidth) - x,      playerY + cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);
    AllFn.project(segment.p2, (playerX * roadWidth) - x - dx, playerY + cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);

    x  = x + dx;
    dx = dx + segment.curve;

    if ((segment.p1.camera.z <= cameraDepth)         ||
        (segment.p2.screen.y >= segment.p1.screen.y) ||
        (segment.p2.screen.y >= maxy))
      continue;

    Render.segment(ctx, width, lanes,
                   segment.p1.screen.x,
                   segment.p1.screen.y,
                   segment.p1.screen.w,
                   segment.p2.screen.x,
                   segment.p2.screen.y,
                   segment.p2.screen.w,
                   segment.color,
                   sprites);

    maxy = segment.p1.screen.y;
  }


  for(n = (drawDistance-1) ; n > 0 ; n--) {
    segment = segments[(baseSegment.index + n) % segments.length];




    for(i = 0 ; i < segment.cars.length ; i++) {
      car        = segment.cars[i];
      sprite      = car.sprite;
      spriteScale = AllFn.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, car.percent);
      spriteX     = AllFn.interpolate(segment.p1.screen.x,     segment.p2.screen.x,     car.percent) + (spriteScale * car.offset * roadWidth * width/2);
      spriteY     = AllFn.interpolate(segment.p1.screen.y,     segment.p2.screen.y,     car.percent);
      
      var customCarScale = spriteScale * 1.13 * (86 / car.sprite.w); // Increased car size by 15%
      Render.sprite(ctx, width, height, resolution, roadWidth, sprites, car.sprite, customCarScale, spriteX, spriteY, -0.5, -1, segment.clip, customCarScale * 0.88);
    }

    for(i = 0 ; i < segment.bikes.length ; i++) {
      bike        = segment.bikes[i];
      spriteScale = AllFn.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, bike.percent);
      spriteX     = AllFn.interpolate(segment.p1.screen.x,     segment.p2.screen.x,     bike.percent) + (spriteScale * bike.offset * roadWidth * width/2);
      spriteY     = AllFn.interpolate(segment.p1.screen.y,     segment.p2.screen.y,     bike.percent);

      var bikeWorldY = AllFn.interpolate(segment.p1.world.y, segment.p2.world.y, bike.percent);
      var screenJumpOffset = spriteScale * Math.max(0, (bike.elevation || bikeWorldY) - bikeWorldY) * height/2;
      var customBikeScale = spriteScale * (21 / bike.sprite.w) * 2.875;

      Render.sprite(ctx, width, height, resolution, roadWidth, sprites, bike.sprite, customBikeScale, spriteX, spriteY - screenJumpOffset, -0.5, -1, segment.clip, customBikeScale, bike.flipX);
    }

    for(i = 0 ; i < segment.sprites.length ; i++) {
        sprite      = segment.sprites[i];
        spriteScale = 4 * segment.p1.screen.scale;
        // console.log(spriteScale);
        spriteX     = segment.p1.screen.x + (spriteScale * sprite.offset * roadWidth * width/2);
        spriteY     = segment.p1.screen.y;
        Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), -1, segment.clip);
      }
      
      // (segment-based particle rendering removed — dust now drawn in screen space at end of render)



    if (segment == playerSegment) {
      var screenJumpOffset = (cameraDepth/playerZ * Math.max(0, (window.playerElevation || playerY) - playerY) * height/2);
      Render.player(ctx, width, height, resolution, roadWidth, sprites, speed/maxSpeed,
                    cameraDepth/playerZ,
                    width/2,
                    height,
                    speed * (keyLeft ? -1 : keyRight ? 1 : 0),
                    playerSegment.p2.world.y - playerSegment.p1.world.y);
    }

  }
  
  

  // Draw screen-space dust particles on top of everything
  if (dustParticles.length > 0) {
    ctx.save();
    for (var dri = 0; dri < dustParticles.length; dri++) {
      var dr = dustParticles[dri];
      var alpha = Math.max(0, (dr.life / (dr.maxLife || 1.0)) * 0.75);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#DDB882';
      // Render as tiny square pixels instead of circles
      ctx.fillRect(dr.sx - dr.r/2, dr.sy - dr.r/2, dr.r, dr.r);
    }
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
  
  // Mood overlay: sunset gradient on top of the whole scene for moody atmosphere
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.12;
  var moodGrad = ctx.createLinearGradient(0, 0, 0, height);
  moodGrad.addColorStop(0,   "#1F0322");
  moodGrad.addColorStop(0.3, "#8A1C49");
  moodGrad.addColorStop(0.6, "#E25822");
  moodGrad.addColorStop(1,   "#FCD02D");
  ctx.fillStyle = moodGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Render HUD on top of everything else
  if (typeof renderHUD === 'function') {
    var rank = 1 + bikes.filter(b => (b.finished ? b.finishTime < window.playerFinishTime : (b.z > position + playerZ))).length;
    renderHUD(speed, rank, bikes.length + 1, window.raceTime || 0);
  }
}


//build the road

function lastY() {
  return (segments.length == 0) ? 0 : segments[segments.length-1].p2.world.y;
  }

function addSegment(curve, y) {
  var n = segments.length;
  segments.push({
     index: n,
     p1: { world: { y: lastY(), z:  n   *segmentLength }, camera: {}, screen: {} },
     p2: { world: { y: y,       z: (n+1)*segmentLength }, camera: {}, screen: {} },
     curve: curve,
     sprites: [],
     cars: [],
     bikes: [],
     color: Math.floor(n/rumbleLength)%2 ? COLORS.DARK : COLORS.LIGHT
  });
}


function addSprite(n, sprite, offset) {
  segments[n].sprites.push({ source: sprite, offset: offset });
}


function addRoad(enter, hold, leave, curve, y) {
  var startY   = lastY();
  var endY     = startY + (AllFn.toInt(y, 0) * segmentLength);
  var n, total = enter + hold + leave;
  for(n = 0 ; n < enter ; n++)
    addSegment(AllFn.transIn(0, curve, n/enter), AllFn.transInOut(startY, endY, n/total));
  for(n = 0 ; n < hold  ; n++)
    addSegment(curve, AllFn.transInOut(startY, endY, (enter+n)/total));
  for(n = 0 ; n < leave ; n++)
    addSegment(AllFn.transInOut(curve, 0, n/leave), AllFn.transInOut(startY, endY, (enter+hold+n)/total));
}

function addStraight(x) {
  x = x || 50;
  addRoad(x, x, x, 0, 0);
}

function addHill(x, height) {
  x    = x    || 50;
  height = height || 40;
  addRoad(x, x, x, 0, height);
}

function addCurve(x, curve, height) {
  x    = x    || 50;
  curve  = curve  || 4;
  height = height || 0;
  addRoad(x, x, x, curve, height);
}

function addLowRollingHills(x, height) {
  x    = x    || 25;
  height = height || 20;
  addRoad(x, x, x,  0,  height/2);
  addRoad(x, x, x,  0, -height);
  addRoad(x, x, x,  0,  height);
  addRoad(x, x, x,  0,  0);
  addRoad(x, x, x,  0,  height/2);
  addRoad(x, x, x,  0,  0);
}

function addSCurves() {
  addRoad(50, 50, 50,  -2,    0);
  addRoad(50, 50, 50,   4,  40);
  addRoad(50, 50, 50,   2,   -20);
  addRoad(50, 50, 50,  -2,    40);
  addRoad(50, 50, 50,  -4, -40);
}

function addDownhillToEnd(x) {
  x = x || 200;
  addRoad(x, x, x, -2, -lastY()/segmentLength);
}

function resetRoad() {
  segments = [];

  // 1. Starting straight to build speed
  addStraight(100);

  // 2. First rolling dune (slight increase in curve and hill)
  addCurve(150, 1.8, 60);
  addCurve(150, 1.8, -50);
  
  // 3. Valley floor straight
  addStraight(50);

  // 4. Sweeping left dune
  addCurve(250, -2.3, 80);
  addCurve(100, -2.3, -60);

  // 5. Short straight transition
  addStraight(50);

  // 6. Tight S-curve through a dune pass
  addCurve(150, 2.8, 50);
  addCurve(150, -2.8, -40);
  
  // 7. Long, undulating right sweeper (coastline cruise)
  addCurve(200, 2.1, 55);
  addCurve(200, 2.1, -45);
  addCurve(200, 2.1, 70);
  
  // 8. Dropping back down to sea level with a left turn
  // 10. Long straight to rest
  addStraight(100);

  // 11. Final massive dune climb and leftward drop to the finish
  addCurve(250, -2.0, 45);
  addCurve(200, -3.0, -45);

  // CRITICAL: Bring the track back down to Y=0 to create a seamless loop!
  addDownhillToEnd();

  // Calculate track length BEFORE spawning objects so they know where to spawn
  trackLength = segments.length * segmentLength;

  resetSprites();
  resetBikes();
  resetCars();

  for(var n = 0 ; n < rumbleLength ; n++) {
    segments[segments.length-1-n].color = (n % 2 === 0) ? COLORS.FINISH_EVEN : COLORS.FINISH_ODD;
  }
}

function findSegment(z) {
  return segments[Math.floor(z/segmentLength) % segments.length];
}

function updatePlayerPosition(){
    var allRacers = [];
    
    var pScore = crossFinish ? (trackLength + (100000 - (window.playerFinishTime || window.raceTime))) : position;
    allRacers.push({ name: 'player', score: pScore, isPlayer: true });
    
    for (var i = 0; i < bikes.length; i++) {
        var b = bikes[i];
        var bScore = b.finished ? (trackLength + (100000 - b.finishTime)) : b.z;
        allRacers.push({ name: b.name || ('Enemy ' + (i+1)), score: bScore, isPlayer: false, originalIndex: i });
    }
    
    allRacers.sort(function(a, b) {
        return b.score - a.score;
    });
    
    window.raceLeaderboard = allRacers;
    
    for(var i=0; i<allRacers.length; i++) {
        if(allRacers[i].isPlayer) {
            rank = i + 1;
            lastPosition = rank;
            break;
        }
    }
}


function resetCars() {
    cars = [];
    var n, car, segment, offset, z, sprite, speed;
    for (var n = 0 ; n < totalCars ; n++) {
      // 20% oncoming, 80% forward
      var isOncoming = Math.random() < 0.2;
      
      if (isOncoming) {
          offset = -0.5; // Perfectly centered in the left lane
          sprite = AllFn.randomChoice(SPRITES.CARS_ONCOMING);
          speed = -(maxSpeed * 0.5 + Math.random() * (maxSpeed * 0.2));
      } else {
          offset = 0.5; // Perfectly centered in the right lane
          sprite = AllFn.randomChoice(SPRITES.CARS_FORWARD);
          speed  = maxSpeed * 0.85 + Math.random() * (maxSpeed * 0.10);
      }
      
      var validZ = false;
      var attempts = 0;
      
      // Ensure cars only spawn on the far side of the track (never near the starting line or the very end of the lap)
      var minZ = trackLength * 0.40; // Start at 40% across the track (prevents oncoming cars from backing into the start line too soon)
      var availableZ = trackLength * 0.30; // Max spawn is 70% (prevents forward cars from wrapping around the finish line and passing the player at the start)

      while (!validZ && attempts < 50) {
        z = minZ + Math.random() * availableZ;
        validZ = true;
        for (var j = 0; j < cars.length; j++) {
           if (Math.abs(cars[j].z - z) < segmentLength * 300) { // Massive 300 segment gap between cars
             validZ = false;
             break;
           }
        }
        attempts++;
      }
  
      // If we couldn't find a valid spot after 50 random attempts, skip this car to prevent bunching
      if (!validZ) continue;

      car = { offset: offset, z: z, sprite: sprite, speed: speed, originalSpeed: speed, stunTimer: 0 };
      segment = findSegment(car.z);
      segment.cars.push(car);
      cars.push(car);
    }
}





function resetBikes() {
  bikes = [];
  var n, bike, segment;
  var NAMES = ["Axel Graves", "Roxy Vane", "Mack 'Roadkill' Mercer", "Jett Malone", "Vera Knox", "Bishop Kane", "Duke Holloway", "Cassidy Blaze", "Rex Calhoun"];
  var laneOffsets = [-0.4, 0.4, -0.2, 0.2, -0.3, 0.3, -0.1, 0.1, 0];

  for (n = 0; n < totalBikes; n++) {
    var isLeader    = (n >= totalBikes - 3);
    var isBackmarker = (n < 4); // First 4 placed bikes
    var laneOff     = laneOffsets[n % laneOffsets.length];
    var maxSpeedMult, accelMult, startZ, skillLevel, targetOffsetZ;
  
      if (isLeader) {
          skillLevel   = 0.88 + Math.random() * 0.12; // 0.88 to 1.0 — Elite
          maxSpeedMult = 1.20 + Math.random() * 0.05; // 120% to 125% — clearly faster than player
          accelMult    = 1.8;
          startZ       = (cameraHeight * cameraDepth) + segmentLength * (10 + (n - (totalBikes - 3)) * 4);
          targetOffsetZ = 8000 + Math.random() * 10000;
        } else if (isBackmarker) {
          var row      = Math.floor(n / 2);
          skillLevel   = 0.80 + Math.random() * 0.10; // 0.80 to 0.90
          maxSpeedMult = 1.16 + Math.random() * 0.04; // 116% to 120% — above player cap
          accelMult    = 1.6;
          startZ       = (cameraHeight * cameraDepth) + segmentLength * (1.5 + row * 2);
          targetOffsetZ = 2000 + Math.random() * 6000;
        } else {
          var row      = Math.floor(n / 2);
          skillLevel   = 0.83 + Math.random() * 0.10; // 0.83 to 0.93
          maxSpeedMult = 1.17 + Math.random() * 0.04; // 117% to 121% — above player cap
          accelMult    = 1.7;
          startZ       = (cameraHeight * cameraDepth) + segmentLength * (1.5 + row * 2);
          targetOffsetZ = 3000 + Math.random() * 8000;
        }

    bike = {
      name:         (n < NAMES.length) ? NAMES[n] : 'Rival ' + n,
      offset:       laneOff,
      laneOffset:   laneOff,
      z:            startZ,
      targetOffsetZ: targetOffsetZ,
      skillLevel:   skillLevel,
      percent:      AllFn.percentRemaining(startZ, segmentLength),
      sprite:       SPRITES.ENEMY_DRIVE,
      speed:        0,
      maxSpeedMult: maxSpeedMult,
      accelMult:    accelMult,
      crashedTimer: 0,
      finished:     false
    };

    segment = findSegment(bike.z);
    segment.bikes.push(bike);
    bikes.push(bike);
  }
}

function resetSprites() {
  var n,i;
  for(n=20; n<segments.length; n++){

    // addSprite(n,SPRITES.BUILDING_LEFT,-1);
    // addSprite(n,SPRITES.BUILDING_RIGHT,1);
    // n+=19;
    if(n%200 == 0)
      addSprite(n,SPRITES.LIGHTHOUSE,3);
    if(n%260 == 0)
      addSprite(n,SPRITES.LIGHTHOUSE,-2);
  }

  for(i = 200 ; i < segments.length ; i += 80) {
    addSprite(i, AllFn.randomChoice(SPRITES.SHIPS), AllFn.randomChoice([1,-1]) * (2 + Math.random() * 5));
  }


}


Game.run({
  canvas: canvas,
  render: render,
  update: update,
  step: step,
  images: [
    "background", "sprites",
    "accelerate", "drive", "hard-left-turn", "hard-right-turn", 
    "idle", "left-turn", "right-turn", 
    "weapon-swing-left", "weapon-swing-right", 
    "weapon-wind-up-left", "weapon-wind-up-right",
    "enemy-accelerate", "enemy-damage-left", "enemy-damage-right",
    "enemy-death1", "enemy-death2", "enemy-death3",
    "enemy-drive", "enemy-hard-left-turn", "enemy-hard-right-turn",
    "enemy-left-turn", "enemy-right-turn",
    "enemy-weapon-swing-right", "enemy-weapon-wind-up-right",
    "start-screen", "start-screen2",
    "cars/sedan-back", "cars/sedan-front",
    "cars/sports-car-back", "cars/sports-car-front",
    "cars/suv-back", "cars/suv-front",
    "game-ui-dashboard"
  ],
  keys: [
    { keys: [KEY.ESCAPE], mode: 'down', action: function() { 
      gamePaused = !gamePaused; 
      if (typeof audioCtx !== 'undefined') {
        if (gamePaused && audioCtx.state === 'running') audioCtx.suspend();
        else if (!gamePaused && audioCtx.state === 'suspended') audioCtx.resume();
      }
      if (window.retroAudioEngine && window.retroAudioEngine.audioCtx) {
        if (gamePaused && window.retroAudioEngine.audioCtx.state === 'running') window.retroAudioEngine.audioCtx.suspend();
        else if (!gamePaused && window.retroAudioEngine.audioCtx.state === 'suspended') window.retroAudioEngine.audioCtx.resume();
      }
    } },
    { keys: [KEY.LEFT,  KEY.A], mode: 'down', action: function() { keyLeft   = true;  } },
    { keys: [KEY.RIGHT, KEY.D], mode: 'down', action: function() { keyRight  = true;  } },
    { keys: [KEY.UP,    KEY.W], mode: 'down', action: function() { keyFaster = true;  } },
    { keys: [KEY.DOWN,  KEY.S], mode: 'down', action: function() { keySlower = true;  } },
    { keys: [KEY.Q],            mode: 'down', action: function() { keyQ      = true;  } },
    { keys: [KEY.E],            mode: 'down', action: function() { keyE      = true;  } },
    { keys: [KEY.Z],            mode: 'down', action: function() { keyZ      = true;  } },
    { keys: [KEY.C],            mode: 'down', action: function() { keyC      = true;  } },
    { keys: [KEY.LEFT,  KEY.A], mode: 'up',   action: function() { keyLeft   = false; } },
    { keys: [KEY.RIGHT, KEY.D], mode: 'up',   action: function() { keyRight  = false; } },
    { keys: [KEY.UP,    KEY.W], mode: 'up',   action: function() { keyFaster = false; } },
    { keys: [KEY.DOWN,  KEY.S], mode: 'up',   action: function() { keySlower = false; } },
    { keys: [KEY.Q],            mode: 'up',   action: function() { keyQ      = false; } },
    { keys: [KEY.E],            mode: 'up',   action: function() { keyE      = false; } },
    { keys: [KEY.Z],            mode: 'up',   action: function() { keyZ      = false; } },
    { keys: [KEY.C],            mode: 'up',   action: function() { keyC      = false; } },
  ],
  ready: function(images) {
    background = images[0];
    sprites    = images[1];
    
    SPRITES.PLAYER_ACCEL = { image: images[2], w: images[2].width, h: images[2].height };
    SPRITES.PLAYER_DRIVE = { image: images[3], w: images[3].width, h: images[3].height };
    SPRITES.PLAYER_HARD_LEFT = { image: images[4], w: images[4].width, h: images[4].height };
    SPRITES.PLAYER_HARD_RIGHT = { image: images[5], w: images[5].width, h: images[5].height };
    SPRITES.PLAYER_IDLE = { image: images[6], w: images[6].width, h: images[6].height };
    SPRITES.PLAYER_LEFT = { image: images[7], w: images[7].width, h: images[7].height };
    SPRITES.PLAYER_RIGHT = { image: images[8], w: images[8].width, h: images[8].height };
    SPRITES.PLAYER_SWING_LEFT = { image: images[9], w: images[9].width, h: images[9].height };
    SPRITES.PLAYER_SWING_RIGHT = { image: images[10], w: images[10].width, h: images[10].height };
    SPRITES.PLAYER_WIND_LEFT = { image: images[11], w: images[11].width, h: images[11].height };
    SPRITES.PLAYER_WIND_RIGHT = { image: images[12], w: images[12].width, h: images[12].height };
    
    SPRITES.ENEMY_ACCEL = { image: images[13], w: images[13].width, h: images[13].height };
    SPRITES.ENEMY_DAMAGE_LEFT = { image: images[14], w: images[14].width, h: images[14].height };
    SPRITES.ENEMY_DAMAGE_RIGHT = { image: images[15], w: images[15].width, h: images[15].height };
    SPRITES.ENEMY_DEATH1 = { image: images[16], w: images[16].width, h: images[16].height };
    SPRITES.ENEMY_DEATH2 = { image: images[17], w: images[17].width, h: images[17].height };
    SPRITES.ENEMY_DEATH3 = { image: images[18], w: images[18].width, h: images[18].height };
    SPRITES.ENEMY_DRIVE = { image: images[19], w: images[19].width, h: images[19].height };
    SPRITES.ENEMY_HARD_LEFT = { image: images[20], w: images[20].width, h: images[20].height };
    SPRITES.ENEMY_HARD_RIGHT = { image: images[21], w: images[21].width, h: images[21].height };
    SPRITES.ENEMY_LEFT = { image: images[22], w: images[22].width, h: images[22].height };
    SPRITES.ENEMY_RIGHT = { image: images[23], w: images[23].width, h: images[23].height };
    SPRITES.ENEMY_SWING_RIGHT = { image: images[24], w: images[24].width, h: images[24].height };
    SPRITES.ENEMY_WIND_RIGHT = { image: images[25], w: images[25].width, h: images[25].height };
    
    window.startScreenImage = images[26];
    window.startScreenImage2 = images[27];
      
      SPRITES.CARS_FORWARD = [
          { image: images[28], w: 1023, h: 882 },
          { image: images[30], w: 1023, h: 882 },
          { image: images[32], w: 1023, h: 882 }
      ];
      
      SPRITES.CARS_ONCOMING = [
          { image: images[29], w: 1023, h: 882 },
          { image: images[31], w: 1023, h: 882 },
          { image: images[33], w: 1023, h: 882 }
      ];

      reset();
  }
});

// Try to play music using Web Audio API immediately
playMusic();
if (window.retroAudioEngine) window.retroAudioEngine.init();

// Fallback: Start the music on the user's first interaction if the browser blocked the initial autoplay
document.addEventListener('keydown', function() {
  playMusic();
  if (window.retroAudioEngine) window.retroAudioEngine.init();
}, { once: true });

function reset(options) {
  options       = options || {};
  canvas.width  = width  = AllFn.toInt(options.width,          width);
  canvas.height = height = AllFn.toInt(options.height,         height);
  lanes                  = AllFn.toInt(options.lanes,          lanes);
  roadWidth              = AllFn.toInt(options.roadWidth,      roadWidth);
  cameraHeight           = AllFn.toInt(options.cameraHeight,   cameraHeight);
  drawDistance           = AllFn.toInt(options.drawDistance,   drawDistance);
  fieldOfView            = AllFn.toInt(options.fieldOfView,    fieldOfView);
  segmentLength          = AllFn.toInt(options.segmentLength,  segmentLength);
  rumbleLength           = AllFn.toInt(options.rumbleLength,   rumbleLength);
  cameraDepth            = 1 / Math.tan((fieldOfView/2) * Math.PI/180);
  playerZ                = (cameraHeight * cameraDepth);
  resolution             = height/480;

  if ((segments.length==0) || (options.segmentLength) || (options.rumbleLength))
    resetRoad();
}

