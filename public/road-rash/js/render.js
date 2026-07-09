//render


var Render = {

  polygon: function(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  },

  segment: function(ctx, width, lanes, x1, y1, w1, x2, y2, w2, color,sprites) {

    var r1 = Render.rumbleWidth(w1, lanes),
        r2 = Render.rumbleWidth(w2, lanes),
        l1 = Render.laneMarkerWidth(w1, lanes),
        l2 = Render.laneMarkerWidth(w2, lanes),
        lanew1, lanew2, lanex1, lanex2, lane;

    var gnd=SPRITES.GROUND;
    ctx.drawImage(sprites,gnd.x,gnd.y,gnd.w,gnd.h,0, y2, width, y1 - y2);

    Render.polygon(ctx, x1-w1-r1, y1, x1-w1, y1, x2-w2, y2, x2-w2-r2, y2, color.rumble);
    Render.polygon(ctx, x1+w1+r1, y1, x1+w1, y1, x2+w2, y2, x2+w2+r2, y2, color.rumble);
    Render.polygon(ctx, x1-w1,    y1, x1+w1, y1, x2+w2, y2, x2-w2,    y2, color.road);

    if (color.lane) {
      lanew1 = w1*2/lanes;
      lanew2 = w2*2/lanes;
      lanex1 = x1 - w1 + lanew1;
      lanex2 = x2 - w2 + lanew2;
      for(lane = 1 ; lane < lanes ; lanex1 += lanew1, lanex2 += lanew2, lane++)
        Render.polygon(ctx, lanex1 - l1/2, y1, lanex1 + l1/2, y1, lanex2 + l2/2, y2, lanex2 - l2/2, y2, color.lane);
    }

  },

  background: function(ctx, background, width, height, layer, rotation, offset) {

    rotation = rotation || 0;
    offset   = offset   || 0;

    var imageW = layer.w/2;
    var imageH = layer.h;

    var sourceX = layer.x + Math.floor(layer.w * rotation);
    var sourceY = layer.y
    var sourceW = Math.min(imageW, layer.x+layer.w-sourceX);
    var sourceH = imageH;

    var destX = 0;
    var destY = offset;
    var destW = Math.floor(width * (sourceW/imageW));
    var destH = height;

    ctx.drawImage(background, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH);
    if (sourceW < imageW)
      ctx.drawImage(background, layer.x, sourceY, imageW-sourceW, sourceH, destW-1, destY, width-destW, destH);
  },



  sprite: function(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY, offsetX, offsetY, clipY) {

    var destW  = (sprite.w * scale * width/2) * (SPRITES.SCALE * roadWidth);
    var destH  = (sprite.h * scale * width/2) * (SPRITES.SCALE * roadWidth);

    destX = destX + (destW * (offsetX || 0));
    destY = destY + (destH * (offsetY || 0));

    var clipH = clipY ? Math.max(0, destY+destH-clipY) : 0;
    if (clipH < destH) {
      if (sprite.image) {
        ctx.drawImage(sprite.image, 0, 0, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);
      } else {
        ctx.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);
      }
    }
  },

  //---------------------------------------------------------------------------

  player: function(ctx, width, height, resolution, roadWidth, sprites, speedPercent, scale, destX, destY, steer) {

    var bounce = (1.5 * Math.random() * speedPercent * resolution) * AllFn.randomChoice([-1,1]);
    var sprite;
    
    // Base driving sprite based on speed
    if (speedPercent > 0.05) {
      sprite = keyFaster ? SPRITES.PLAYER_ACCEL : SPRITES.PLAYER_DRIVE;
    } else {
      sprite = SPRITES.PLAYER_IDLE;
    }

    // Steering / Lean logic
    if (steer < 0 || playerLean < -0.1) {
      sprite = (steer < -maxSpeed/2 || playerLean < -0.5) ? SPRITES.PLAYER_HARD_LEFT : SPRITES.PLAYER_LEFT;
    } else if (steer > 0 || playerLean > 0.1) {
      sprite = (steer > maxSpeed/2 || playerLean > 0.5) ? SPRITES.PLAYER_HARD_RIGHT : SPRITES.PLAYER_RIGHT;
    }

    // Combat animations take priority
    if (window.playerAttackTimer > 0) {
      var t = window.playerAttackTimer; // 0.3 down to 0
      var side = window.playerAttackSide;
      
      if (t > 0.2) {
         sprite = (side === -1) ? SPRITES.PLAYER_WIND_LEFT : SPRITES.PLAYER_WIND_RIGHT;
      } else if (t > 0.1) {
         sprite = (side === -1) ? SPRITES.PLAYER_SWING_LEFT : SPRITES.PLAYER_SWING_RIGHT;
      } else {
         sprite = (side === -1) ? SPRITES.PLAYER_WIND_LEFT : SPRITES.PLAYER_WIND_RIGHT;
      }
    }

    // Isolate player scaling from global SPRITES.SCALE (21 was the original sprite width, 2.8 is the desired magnification)
    var customScale = scale * (21 / sprite.w) * 2.8;

    Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, customScale, destX, destY + bounce, -0.5, -1);
  },


  rumbleWidth:     function(projectedRoadWidth, lanes) { return projectedRoadWidth/Math.max(6,  2*lanes); },
  laneMarkerWidth: function(projectedRoadWidth, lanes) { return projectedRoadWidth/Math.max(32, 8*lanes); }

}
