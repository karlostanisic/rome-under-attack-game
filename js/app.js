var requestAnimFrame = (function(){
    return window.requestAnimationFrame       ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame    ||
		window.oRequestAnimationFrame      ||
		window.msRequestAnimationFrame     ||
		function(callback){
			window.setTimeout(callback, 1000 / 60);
		};
})();

// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 512;
canvas.height = 480;
document.getElementById('wrapper').appendChild(canvas);

// Tracking of mouse position
var mousePosition = [];
canvas.onmousemove = function(e) { 
	mousePosition[0] = e.pageX - this.offsetLeft; 
	mousePosition[1] = e.pageY - this.offsetTop;
};

// Game elements definition
var gun = {
    size: [10, 40],
    pos: [canvas.width / 2, canvas.height - 20],
    angle: Math.PI / 2
};

var cityOfRome = {
    position: [0, 470],
    size: [canvas.width, canvas.height - 470]
};

// Game parameters definition. You can change them if you like
var fireDelay = 140;
var wmdFireDelay = 600;
var bombDamage = [20, 5, 0];
var medicBoxPoints = 5;
var maxDamage = 100;
var wmdPoints = 10000;

// Speed in pixels per second
var bulletSpeed = 500;
var enemySpeed = [150, 110, 200];

var enemyPoints = [200, 100, 0];

// Number of hits required to destroy entity [a-bomb, bomb, medic box]
var enemyHits = [5, 1, 1];

// Game state variables
// Entities arrays
var bullets = [];
var enemies = [];
var explosions = [];

// Time control variables
var lastTime;
var lastFire;
var wmdLastFire;
var gameTime;

// Counters
var damage = 0;;
var wmd = 0;
var score = 0;;

var isGameOver = true;
var terrainPattern;

// HTML interface elements
var scoreEl = document.getElementById('score');
scoreEl.innerHTML = 0;
var damageEl = document.getElementById('damage');
damageEl.innerHTML = 0;
var wmdEl = document.getElementById('wmd');
wmdEl.innerHTML = 0;

var highScore = parseInt(localStorage.getItem('highScore')) || 0;
var highScoreInitials = localStorage.getItem('highScoreInitials') || "";
var highScoreEl = document.getElementById('high-score');
highScoreEl.innerHTML = highScore;
var highScoreInitialsEl = document.getElementById('high-score-initials');
highScoreInitialsEl.innerHTML = highScoreInitials;
var gameOverScorePointsEl = document.getElementById('game-over-score-points');

document.getElementById("game-start-wrapper").style.display = 'table-cell';

// Events for buttons
document.getElementById("play").addEventListener("click", function() {
    document.getElementById("game-start-wrapper").style.display = "none";
    reset();
});

document.getElementById('play-again').addEventListener('click', function() {
    reset();
}); 

document.getElementById("submit-initials").addEventListener("click", function() {
    highScoreInitials = document.getElementById("initials-input").value;
    localStorage.setItem('highScoreInitials', highScoreInitials);
});

// The main game loop
function main() {
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    update(dt);
    render();

    lastTime = now;
    requestAnimFrame(main);
};

resources.load([
	'img/sprites.png',
	'img/rome.png',
	'img/rome-destroyed.png'
]);
resources.onReady(init);

function init() {
    terrainPattern = ctx.createPattern(resources.get('img/rome.png'), 'repeat');
    main();
}

// Reset game to original state
function reset() {
    document.getElementById('game-over-wrapper').style.display = 'none';
    gameTime = 0;
    score = 0;
    damage = 0;
    wmd = 0;
    terrainPattern = ctx.createPattern(resources.get('img/rome.png'), 'repeat')
    enemies = [];
    bullets = [];
    explosions = [];
    lastFire = Date.now();
    wmdLastFire = Date.now();
    lastTime = Date.now();
    highScoreEl.innerHTML = highScore;
    highScoreInitialsEl.innerHTML = highScoreInitials;
    isGameOver = false;
};

// Game over
function gameOver() {
    isGameOver = true;
    
    // Display game over screen
    document.getElementById('game-over-wrapper').style.display = 'table-cell';
    gameOverScorePointsEl.innerHTML = score;

    // Check for high score
    if (score > highScore || isNaN(highScore)) {
            localStorage.setItem('highScore', '' + score);
            highScore = score;
       document.getElementById('game-over-high-score').style.display = 'block';
    } else {
    document.getElementById('game-over-high-score').style.display = 'none';
    }
    
    // Change background
    terrainPattern = ctx.createPattern(resources.get('img/rome-destroyed.png'), 'repeat');
    
    // Play destruction SFX
    var snd = new Audio("sfx/destruction.mp3"); 
    snd.play();

    // Lot of explosions for the end of the game
    for(var i = 0; i < 100; i++){
        window.setTimeout(function() {
            explosions.push({
                pos: [Math.random() * (canvas.width) - 30, canvas.height - 140 - Math.random() * (50)],
                sprite: new Sprite(
                    'img/sprites.png',
                    [0, 163],
                    [65, 160],
                    8,
                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                    null,
                    true
                )
            });
        }, 500*Math.log(i+1));
    }
}

// Update score
function updateScore(points) {
    // Check if player earned new WMD
    if (Math.floor(score / wmdPoints) < Math.floor((score + points) / wmdPoints)) wmd++;
    score += points;
}

// Creating bomb/medicbox sprites
function createNewEntitySprite(type) {
    switch(type) {
        case 0:
            return new Sprite('img/sprites.png', [0, 100], [40, 60]);
            break;
        case 1:
            return new Sprite('img/sprites.png', [0, 12], [22, 38]);
            break;
        case 2:
            return new Sprite('img/sprites.png', [0, 323], [40, 30]);
            break;
        default:
            return null;
    } 
}

// Update game objects (dt = time interval from last update)
function update(dt) {
    gameTime += dt;

    handleInput(dt); // Check for user input
    updateEntities(dt); // Calculate entities positions

    // Create new entities
    if(!isGameOver) {
        // Randomly create medic boxes (type=2) with .0005 probability in every game frame
        if(Math.random() < .0005) {
            enemies.push({
                type: 2,
                hits: 0,
                pos: [Math.random() * (canvas.width - 40), 0],
                sprite: createNewEntitySprite(2)
            });
        }
        
        // Randomly create bombs with .030 probability in every game frame
        if(Math.random() < .035) {
            // .070 chances of atomic bomb (type=0), .930 chances for normal bomb (type=1)
            var bombType = (Math.random() < .070) ? 0 : 1;
            enemies.push({
                type: bombType,
                hits: 0,
                pos: [Math.random() * (canvas.width - 22), 0],
                sprite: createNewEntitySprite(bombType)
            });
        }
    }

    checkCollisions(); // Check for hits
    
    // Update HTML interface
    scoreEl.innerHTML = score;
    damageEl.innerHTML =  parseInt(damage / maxDamage * 100);
    wmdEl.innerHTML = wmd;
};

// Handles user input
function handleInput() {
    var x1 = mousePosition[0] - gun.pos[0];
    var y1 = gun.pos[1] - mousePosition[1];

    // Calculate gun angle
    if (x1 === 0){
            gun.angle = Math.PI / 2; 
    } else {
            gun.angle = Math.atan(y1 / x1);
            if (x1 < 0) {gun.angle += Math.PI;} 
    }

    // Check for angle boundaries
    if (gun.angle > Math.PI) {
            gun.angle = Math.PI;
    } else {
            if (gun.angle < 0) {
                    gun.angle = 0;
            }
    }
    
    // Check if it is possible to fire WMD
    if(input.isDown('SPACE') &&
        !isGameOver &&
        wmd > 0 &&
        Date.now() - wmdLastFire > wmdFireDelay) {

        wmd--;
        
        // Destroy all bombs on screen
        for(var i=0; i<enemies.length; i++) {
            updateScore(enemyPoints[enemies[i].type]);
            
            // Update damage if medic box
            if (enemies[i].type === 2) {
                damage = (damage - 5 < 0) ? 0 : damage - 5;
            }
            
            // Create explosion
            explosions.push({
                pos: enemies[i].pos,
                sprite: new Sprite(
                    'img/sprites.png',
                    [0, 53],
                    [39, 39],
                    16,
                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                    null,
                    true
                )
            });
            
            // Play explosion SFX
            var snd = new Audio("sfx/explosion.mp3"); 
            snd.play();
        }
        
        // Empty enemies array
        enemies = []; 
        
        wmdLastFire = Date.now();
    }

    // Check if it is possible to fire
    if((input.isDown('MOUSE') || input.isDown('A')) &&
        !isGameOver &&
        Date.now() - lastFire > fireDelay) {

        var x = gun.pos[0];
        var y = gun.pos[1];
        var ang = gun.angle;
        
        // Create bullet
        bullets.push({ 
            pos: [x, y],
            angle: ang,
            sprite: new Sprite('img/sprites.png', [0, 0], [8, 8]) 
        });
        
        // Play firing SFX
        var snd = new Audio("sfx/gun.mp3"); 
        snd.volume = .1;
        snd.play();
        
        lastFire = Date.now();
    }
}

function updateEntities(dt) {
    // Update all the bullets positions
    for(var i=0; i<bullets.length; i++) {
        var bullet = bullets[i];

        bullet.pos[1] -= bulletSpeed * dt * Math.sin(bullet.angle);
        bullet.pos[0] += bulletSpeed * dt * Math.cos(bullet.angle);

        // Remove the bullet if it goes offscreen
        if(bullet.pos[0] < 0 || bullet.pos[1] < 0 ||
           bullet.pos[0] > canvas.width) {
                bullets.splice(i, 1);
                i--;
        }
    }

    // Update all the flying objets
    for(var i=0; i<enemies.length; i++) {
        enemies[i].pos[1] += enemySpeed[enemies[i].type] * dt;
        var pos = enemies[i].pos;
        var size = enemies[i].sprite.size;
        
        // If bomb hits bottom
        if (pos[1] + size[1] > canvas.height - cityOfRome.size[1]) {
            if(!isGameOver) {
                // Update damage
                damage += bombDamage[enemies[i].type];
                damage = (damage > 100) ? 100 : damage;
            }
            
            // Check for bomm type
            if (enemies[i].type === 1) {
                // Play explosion SFX
                if (!isGameOver) {
                    var snd = new Audio("sfx/explosion.mp3"); 
                    snd.play();
                }
                // Create new explosion
                explosions.push({
                    pos: pos,
                    sprite: new Sprite(
                        'img/sprites.png',
                        [0, 53],
                        [39, 39],
                        16,
                        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                        null,
                        true
                    )
                });
            } else if (enemies[i].type === 0){
                // Play atomic explosion SFX
                if (!isGameOver) {
                    var snd = new Audio("sfx/atomic.mp3");
                    snd.play();
                }
                // Adjust position for atomic bomb explosion animation because it's bigger
                pos[0] -= (65 - enemies[i].sprite.size[0]) / 2;
                pos[1] = canvas.height - 160;
                // Create new atomic bomb explosion
                explosions.push({
                    pos: pos,
                    sprite: new Sprite(
                        'img/sprites.png',
                        [0, 163],
                        [65, 160],
                        8,
                        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                        null,
                        true
                    )
                });
            }
            
            // Check if game is over
            if (damage >= maxDamage && !isGameOver){gameOver();}
            
            // Remove entity from enemies array
            enemies.splice(i, 1)
        }
    }

    // Update all the explosions
    for(var i=0; i<explosions.length; i++) {
        explosions[i].sprite.update(dt);

        // Remove if animation is done
        if(explosions[i].sprite.done) {
            explosions.splice(i, 1);
            i--;
        }
    }
}

// Basic box collision detection
function collides(x, y, r, b, x2, y2, r2, b2) {
    return !(r <= x2 || x > r2 ||
             b <= y2 || y > b2);
}

function boxCollides(pos, size, pos2, size2) {
    return collides(pos[0], pos[1],
                    pos[0] + size[0], pos[1] + size[1],
                    pos2[0], pos2[1],
                    pos2[0] + size2[0], pos2[1] + size2[1]);
}

// Check if bullets are hitting targets
function checkCollisions() {
    // Run collision detection for all enemies and bullets
    for(var i=0; i<enemies.length; i++) {
        var pos = enemies[i].pos;
        var size = enemies[i].sprite.size;
        var enemyIsDestroyed = false;

        for(var j=0; j<bullets.length; j++) {
            var pos2 = bullets[j].pos;
            var size2 = bullets[j].sprite.size;
            
            // Check if bullet j hits target i
            if (boxCollides(pos, size, pos2, size2)) {
                // Hits counter. A-bomb needs 5 hits to be destroyed
                enemies[i].hits++;
                // Check if enemy is destroyed
                if (enemies[i].hits >= enemyHits[enemies[i].type]) {
                    // Update score
                    updateScore(enemyPoints[enemies[i].type]);
                    // Play explosion SFX
                    var snd = new Audio("sfx/explosion.mp3"); 
                    snd.play();
                    // Add an explosion
                    explosions.push({
                        pos: pos,
                        sprite: new Sprite(
                            'img/sprites.png',
                            [0, 53],
                            [39, 39],
                            16,
                            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                            null,
                            true
                        )
                    });
                    // Check if medic box is hit
                    if (enemies[i].type === 2) {
                        // Update damage
                        damage = (damage - medicBoxPoints < 0) ? 0 : damage - medicBoxPoints;
                    }
                    // Remove enemy
                    enemies.splice(i, 1);
                    i--;
                    // So we now we can skip iteration for this enemy
                    enemyIsDestroyed = true;
                }

                // Remove the bullet and stop this iteration
                bullets.splice(j, 1);
                j--;
                break;
            }
        }
        // If enemy is destroyed, stop iteration
        if (enemyIsDestroyed) break;
    }
}

// Draw everything
function render() {
    ctx.fillStyle = terrainPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    renderEntities(bullets);
    renderGun();
    renderEntities(enemies);
    renderEntities(explosions);
};

function renderGun(){
    ctx.save();
    ctx.beginPath();

    ctx.translate(gun.pos[0] + gun.size[0] / 2, gun.pos[1] + 4);
    ctx.rotate(Math.PI/2 - gun.angle);
    ctx.rect(-gun.size[0]/2, -gun.size[1], gun.size[0], gun.size[1]);

    ctx.fillStyle = "black";
    ctx.fill();

    ctx.restore();
};

function renderEntities(list) {
    for(var i=0; i<list.length; i++) {
        renderEntity(list[i]);
    }    
}

function renderEntity(entity) {
    ctx.save();
    ctx.translate(entity.pos[0], entity.pos[1]);
    entity.sprite.render(ctx);
    ctx.restore();
}