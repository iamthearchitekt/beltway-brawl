window.onerror = function(msg, url, lineNo, columnNo, error) {
    alert("CRASH: " + msg + "\nLine: " + lineNo + "\n" + (error && error.stack));
    return false;
};

function update(dt) {

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

  // Inside Turn Advantage (Player)
  var clampedOffset = Math.max(-1, Math.min(1, playerX));
  var curveAdvantage = playerSegment.curve * clampedOffset;
  var speedMultiplier = 1.0;
  if (curveAdvantage > 0) {
      speedMultiplier = 1.0 + (curveAdvantage * 0.04); // Up to 16% speed boost for hugging the inside
  } else if (curveAdvantage < 0) {
      speedMultiplier = 1.0 + (curveAdvantage * 0.04); // Up to 16% penalty for taking the outside
  }
  
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

  if (currentPosition > trackLength) {
    crossFinish = true;
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

    // Apply lean to velocity
    playerVelocityX = playerLean * dx * 1.25;
    playerX += playerVelocityX;

    playerX = playerX - (dx * speedPercent * playerSegment.curve * centrifugal);

    if (window.playerCrashedTimer > 0) {
      speed = AllFn.accelerate(speed, decel * 2, dt); // Decelerate quickly if crashed
    } else if (keyFaster) {
      // Dynamic acceleration: Fast off the line, gradual at the top end
      var currentAccel = accel * (1.5 - (speed / maxSpeed) * 1.2); 
      speed = AllFn.accelerate(speed, currentAccel, dt);
    }
    else if (keySlower) {
      speed = AllFn.accelerate(speed, breaking, dt);
    }
    else {
      speed = AllFn.accelerate(speed, decel, dt);
    }
  }
  else{
    // Hard decelerate player after finish line
    speed = AllFn.accelerate(speed, breaking, dt);
    if (speed < 0) speed = 0;
    
    // Still update AI so they line up at the finish line!
    updateBikes(dt, playerSegment, playerW);
    updateCars(dt, playerSegment, playerW);
  }



  if (((playerX < -1) || (playerX > 1)) && (speed > offRoadLimit))
    speed = AllFn.accelerate(speed, offRoadDecel, dt);

  // Spawn Player Dust — screen-space particles, dead simple and guaranteed visible
  if (Math.abs(playerX) > 0.9 && speed > maxSpeed * 0.1) {
    for (var ds = 0; ds < 3; ds++) {
      dustParticles.push({
        sx:    width/2 + (playerX * width * 0.18) + (Math.random() - 0.5) * 40,
        sy:    height - 20 + (Math.random() * 10),
        vx:    (Math.random() - 0.5) * 60,
        vy:    -(40 + Math.random() * 80),
        r:     6 + Math.random() * 10,
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


  for(n = 0 ; n < playerSegment.cars.length ; n++) {
    car  = playerSegment.cars[n];
    carW = car.sprite.w * SPRITES.SCALE;
    if (speed > car.speed) {
      if (AllFn.overlap(playerX, playerW, car.offset, carW, 0.8)) {
        crash.play();
        window.playerCrashedTimer = 3.0; // 3 second crash penalty
        speed    = car.speed * (car.speed/speed);
        position = AllFn.increase(car.z, -playerZ, trackLength);
        break;
      }
    }
  }


  for(n = 0 ; n < playerSegment.bikes.length ; n++) {
    bike  = playerSegment.bikes[n];
    bikeW = 21 * SPRITES.SCALE;
    
    // Weapon range is wider (1.2) than physical bodies (0.7)
    if (AllFn.overlap(playerX, playerW, bike.offset, bikeW, 1.2)) {
      var isSwingingRight = (window.playerAttackSide === 1 && window.playerAttackTimer > 0);
      var isSwingingLeft = (window.playerAttackSide === -1 && window.playerAttackTimer > 0);
      var hitLanded = false;

      if (playerX < bike.offset && isSwingingRight){
        crowbarHitSound.currentTime = 0;
        crowbarHitSound.play().catch(e => {});
        bike.offset += 0.5; // knock them away
        bike.health = (bike.health || 3) - 1;
        bike.damageTimer = 0.5;
        bike.damageSide = 1; // hit on their left, pushes them right
        if (bike.health <= 0) { bike.speed = 0; bike.crashedTimer = 3.0; } // knock them down!
        hitLanded = true;
      }
      else if (playerX > bike.offset && isSwingingLeft){
        crowbarHitSound.currentTime = 0;
        crowbarHitSound.play().catch(e => {});
        bike.offset -= 0.5; // knock them away
        bike.health = (bike.health || 3) - 1;
        bike.damageTimer = 0.5;
        bike.damageSide = -1; // hit on their right, pushes them left
        if (bike.health <= 0) { bike.speed = 0; bike.crashedTimer = 3.0; } // knock them down!
        hitLanded = true;
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
            
            playerX = AllFn.limit(playerX, -2, 2);
            bike.offset = AllFn.limit(bike.offset, -2, 2);
        }
      }
    }
  }



  playerX = AllFn.limit(playerX, -2, 2);
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
    var targetSpeed = maxSpeed * bike.maxSpeedMult;
    if (!gameStart || bike.finished) {
      targetSpeed = 0;
    } else {
      // Rubber band: purely position-delta based, like the real game
      var dist = bike.z - (position + playerZ);
      if (dist <  -trackLength/2) dist += trackLength;
      if (dist >   trackLength/2) dist -= trackLength;
      if (dist < -4000) targetSpeed *= 1.15;  // Far behind: speed boost
      if (dist >  5000) targetSpeed *= 0.88;  // Far ahead: ease off

      // Off-road penalty (Road Rash 3: significant slowdown on the shoulder)
      if (Math.abs(bike.offset) > 1.0)
        targetSpeed = Math.min(targetSpeed, offRoadLimit);
    }

    // Smooth acceleration toward target
    if (bike.speed < targetSpeed)
      bike.speed = Math.min(bike.speed + accel * bike.accelMult * dt, targetSpeed);
    else
      bike.speed = Math.max(bike.speed - accel * dt, targetSpeed);
    bike.speed = AllFn.limit(bike.speed, 0, maxSpeed * 1.2);

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

    // 1. Emergency road recovery — highest priority
    if (bike.offset < -0.95) {
      steerDir = 1.0;
    } else if (bike.offset > 0.95) {
      steerDir = -1.0;
    } else {
      // 2. Look ahead for obstacles to dodge
      var lookahead = 15;
      for (var i = 1; i < lookahead && steerDir === 0; i++) {
        var seg = segments[(oldSegment.index + i) % segments.length];

        // Dodge player
        if (seg === playerSegment && bike.speed > speed &&
            AllFn.overlap(playerX, playerW, bike.offset, bikeW, 1.1)) {
          steerDir = (bike.offset >= playerX) ? (1/i) : -(1/i);
        }

        // Dodge slower AI
        for (var j = 0; j < seg.bikes.length && steerDir === 0; j++) {
          var ob = seg.bikes[j];
          if (ob !== bike && bike.speed > ob.speed &&
              AllFn.overlap(bike.offset, bikeW, ob.offset, ob.sprite.w * SPRITES.SCALE, 1.1)) {
            steerDir = (bike.offset >= ob.offset) ? (1/i) : -(1/i);
          }
        }

        // Dodge traffic cars
        for (var k = 0; k < seg.cars.length && steerDir === 0; k++) {
          var oc = seg.cars[k];
          if (bike.speed > oc.speed &&
              AllFn.overlap(bike.offset, bikeW, oc.offset, oc.sprite.w * SPRITES.SCALE, 1.1)) {
            steerDir = (bike.offset >= oc.offset) ? (1/i) : -(1/i);
          }
        }
      }

      // 3. Gentle drift back toward preferred lane when no obstacles
      if (steerDir === 0) {
        var laneTarget = bike.laneOffset || 0;
        var diff = laneTarget - bike.offset;
        steerDir = Math.max(-0.3, Math.min(0.3, diff * 2.0));
      }
    }

    bike.offset += steerDir * dt * 3.0;
    bike.offset  = Math.max(-1.5, Math.min(1.5, bike.offset));

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

    // Finish line
    if (bike.z < oldZ && (position + playerZ) > trackLength / 2)
      bike.finished = true;

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
    oldSegment  = findSegment(car.z);
    car.offset  = car.offset + handleCarDirection(car, oldSegment, playerSegment, playerW);
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

  var i, j, dir, segment, othercar, othercarW, lookahead = 20, carW = car.sprite.w * SPRITES.SCALE;

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
      othercarW = othercar.sprite.w * SPRITES.SCALE;
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
  var gradient = ctx.createLinearGradient(0, 0, 0, height/2 + 100);
  gradient.addColorStop(0, "#1F0322");   // Deep purple/black at the top
  gradient.addColorStop(0.3, "#8A1C49"); // Crimson red
  gradient.addColorStop(0.6, "#E25822"); // Sunset orange
  gradient.addColorStop(1, "#FCD02D");   // Golden yellow near the horizon
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Draw the low glowing sun — tracks dead ahead using road curve
  ctx.save();
  // Accumulate the curve offset so the sun follows the vanishing point
  var curveAccum = 0;
  for (var si = 0; si < Math.min(100, drawDistance); si++) {
    curveAccum += segments[(baseSegment.index + si) % segments.length].curve;
  }
  var sunX = width / 2 - (curveAccum * 0.4);
  var sunY = height / 2 - 70; // Lifted above the horizon line

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
      Render.sprite(ctx, width, height, resolution, roadWidth, sprites, car.sprite, spriteScale * 0.95, spriteX, spriteY, -0.5, -1, segment.clip, spriteScale * 0.82);
    }

    for(i = 0 ; i < segment.bikes.length ; i++) {
      bike        = segment.bikes[i];
      sprite      = bike.sprite;
      // console.log(sprite);
      spriteScale = AllFn.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, bike.percent);
      spriteX     = AllFn.interpolate(segment.p1.screen.x,     segment.p2.screen.x,     bike.percent) + (spriteScale * bike.offset * roadWidth * width/2);
      spriteY     = AllFn.interpolate(segment.p1.screen.y,     segment.p2.screen.y,     bike.percent);

      var bikeWorldY = AllFn.interpolate(segment.p1.world.y, segment.p2.world.y, bike.percent);
      var screenJumpOffset = spriteScale * Math.max(0, (bike.elevation || bikeWorldY) - bikeWorldY) * height/2;
      var customBikeScale = spriteScale * (21 / bike.sprite.w) * 2.8;

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
  speedoMeter(speed);
  displayRank(rank,bikes.length+1);

  // Draw screen-space dust particles on top of everything
  if (dustParticles.length > 0) {
    ctx.save();
    for (var dri = 0; dri < dustParticles.length; dri++) {
      var dr = dustParticles[dri];
      var alpha = Math.max(0, (dr.life / (dr.maxLife || 1.0)) * 0.75);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#DDB882';
      ctx.beginPath();
      ctx.arc(dr.sx, dr.sy, dr.r, 0, Math.PI * 2);
      ctx.fill();
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

  // 1. Starting straight to build speed before hitting the dunes
  addStraight(100);

  // 2. First rolling dune (gentle right curve, uphill then downhill)
  addCurve(150, 1.5, 20);
  addCurve(150, 1.5, -20);
  
  // 3. Valley floor straight
  addStraight(50);

  // 4. Sweeping left dune (long climb, steep drop)
  addCurve(250, -2.0, 30);
  addCurve(100, -2.0, -30);

  // 5. Short straight transition
  addStraight(50);

  // 6. Tight S-curve through a dune pass
  addCurve(150, 2.5, 15);
  addCurve(150, -2.5, -15);
  
  // 7. Long, undulating right sweeper (coastline cruise)
  addCurve(200, 1.8, 10);
  addCurve(200, 1.8, -10);
  addCurve(200, 1.8, 15);
  
  // 8. Dropping back down to sea level with a left turn
  addCurve(250, -2.2, -15);
  
  // 9. Quick roller-coaster bumps (mini dunes)
  addCurve(100, 1.5, 20);
  addCurve(100, -1.5, -20);
  addCurve(100, 1.5, 20);
  addCurve(100, -1.5, -20);

  // 10. Long straight to rest
  addStraight(100);

  // 11. Final massive dune climb and leftward drop to the finish
  addCurve(250, -1.5, 40);
  addCurve(200, -2.5, -40);

  // CRITICAL: Bring the track back down to Y=0 to create a seamless loop!
  addDownhillToEnd();

  resetSprites();
  resetBikes();
  resetCars();

  segments[findSegment(playerZ).index + 12].color = COLORS.START;
  segments[findSegment(playerZ).index + 13].color = COLORS.START;
  for(var n = 0 ; n < rumbleLength ; n++)
    segments[segments.length-1-n].color       = COLORS.FINISH;

  trackLength = segments.length * segmentLength;
}

function findSegment(z) {
  return segments[Math.floor(z/segmentLength) % segments.length];
}

//playerposition


function updatePlayerPosition(){
    if(true){ //to be checked if  crossFinish is true or not=================================================


        var playerPosition=[];
        var alreadyFinished=0;

        for (var i = 0; i < bikes.length; i++) {
            if(bikes[i].crossFinish){
                alreadyFinished++;
            }
            else{
                var key = bikes[i].name || ('enemy'+i);
                playerPosition.push({'name':key,
                    'position' : bikes[i].z});
            }

        }
        playerPosition.push({'name':'player',
            'position':position});

        playerPosition.sort((a,b)=>{
            return b.position-a.position;
        });
        
        // Export globally for the post-race screen
        window.raceLeaderboard = playerPosition;

        for(var i=0;i<playerPosition.length;i++){
          if(playerPosition[i].name=='player'){
              var pposition=i+1+alreadyFinished;
              rank = pposition;
              // console.log(pposition, bikes.length+1);
              lastPosition=pposition;
              break;
          }
      }
  }
  else{
      console.log(lastPosition,enemies.length + 1);
  }

}


function resetCars() {
  cars = [];
  var n, car, segment, offset, z, sprite, speed;
  for (var n = 0 ; n < totalCars ; n++) {
    offset = Math.random() * 0.8; // Only right side of the road
    
    var validZ = false;
    var attempts = 0;
    while (!validZ && attempts < 50) {
      z = (Math.floor(Math.random() * (segments.length - 40)) + 40) * segmentLength;
      validZ = true;
      for (var j = 0; j < cars.length; j++) {
         if (Math.abs(cars[j].z - z) < segmentLength * 80) { // Keep them at least 80 segments apart
             validZ = false;
             break;
         }
      }
      attempts++;
    }

    sprite = AllFn.randomChoice(SPRITES.CARS);
    speed  = maxSpeed/4;
    car = { offset: offset, z: z, sprite: sprite, speed: speed };
    segment = findSegment(car.z);
    segment.cars.push(car);
    cars.push(car);
  }
}







function resetBikes() {
  bikes = [];
  var n, bike, segment;
  var NAMES = ["Axel Graves", "Roxy Vane", "Mack 'Roadkill' Mercer", "Jett Malone", "Vera Knox", "Bishop Kane", "Duke Holloway", "Cassidy Blaze", "Rex Calhoun"];
  var laneOffsets = [-0.5, 0.5, -0.3, 0.3, -0.6, 0.6, -0.4, 0.4, 0];

  for (n = 0; n < totalBikes; n++) {
    var isLeader    = (n >= totalBikes - 3);
    var laneOff     = laneOffsets[n % laneOffsets.length];
    var maxSpeedMult, accelMult, startZ;

    if (isLeader) {
      maxSpeedMult = 1.05 + Math.random() * 0.10;
      accelMult    = 1.0;
      startZ       = (cameraHeight * cameraDepth) + segmentLength * (10 + (n - (totalBikes - 3)) * 4);
    } else {
      var row      = Math.floor(n / 2);
      maxSpeedMult = 0.88 + Math.random() * 0.18;
      accelMult    = 1.1;
      startZ       = (cameraHeight * cameraDepth) + segmentLength * (1.5 + row * 2);
    }

    bike = {
      name:         (n < NAMES.length) ? NAMES[n] : 'Rival ' + n,
      offset:       laneOff,
      laneOffset:   laneOff,
      z:            startZ,
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
    "start-screen", "start-screen2"
  ],
  keys: [
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
