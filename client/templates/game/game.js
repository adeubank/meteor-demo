var gameLoop;

Template.game.helpers({
  displayScoreboard: function () {
    var currentPlayer = Players.findOne(Session.get('currentPlayer'));

    if (!currentPlayer) {
      return;
    }

    // display the scoreboard on mobile screens only when the player is dead
    return currentPlayer.dead || (!currentPlayer.dead && !Meteor.Device.isPhone());
  },
  currentPlayer: function () {
    return Players.findOne(Session.get('currentPlayer'));
  }
});

var touchCoords;
Template.game.events({
  'click #play_again': function () {
    var deadPlayer = Players.findOne({
      _id: Session.get('currentPlayer'),
      dead: true
    });
    if (deadPlayer) {
      Meteor.call('resurrectPlayer', deadPlayer._id);
    } else {
      Router.go('menu');
    }
  },

  'touchstart #js-game-board': function (event, template) {
    var changedTouches = event.originalEvent.changedTouches[0];
    touchCoords = {
      x: changedTouches.pageX,
      y: changedTouches.pageY
    };
  },

  'touchmove #js-game-board': function (event) {
    event.preventDefault();

    var changedTouches = event.originalEvent.changedTouches[0];
    var dX = changedTouches.pageX - touchCoords.x;
    var dY = changedTouches.pageY - touchCoords.y;
    var threshold = 50;
    var restraint = 25;
    var swipeDir;

    if (Math.abs(dX) >= threshold && Math.abs(dY) <= restraint) { // 2nd condition for horizontal swipe met
      swipeDir = (dX < 0) ? 'left' : 'right'; // if dist traveled is negative, it indicates left swipe
    } else if (Math.abs(dY) >= threshold && Math.abs(dX) <= restraint) { // 2nd condition for vertical swipe met
      swipeDir = (dY < 0) ? 'up' : 'down'; // if dist traveled is negative, it indicates up swipe
    }

    if (swipeDir) {
      updateDirection(swipeDir);
    }
  },

  'touchend #js-game-board': function (event, template) {
    var changedTouches = event.originalEvent.changedTouches[0];
    var dX = changedTouches.pageX - touchCoords.x;
    var dY = changedTouches.pageY - touchCoords.y;
    var threshold = 50;
    var restraint = 25;
    var swipeDir;

    if (Math.abs(dX) >= threshold && Math.abs(dY) <= restraint) { // 2nd condition for horizontal swipe met
      swipeDir = (dX < 0) ? 'left' : 'right'; // if dist traveled is negative, it indicates left swipe
    } else if (Math.abs(dY) >= threshold && Math.abs(dX) <= restraint) { // 2nd condition for vertical swipe met
      swipeDir = (dY < 0) ? 'up' : 'down'; // if dist traveled is negative, it indicates up swipe
    }

    if (swipeDir) {
      updateDirection(swipeDir);
    }
  }
});

Template.game.onCreated(function () {

  // make sure we always have a player to start with
  if (!Players.findOne(Session.get('currentPlayer'))) {
    Session.set('currentPlayer', '');
    Router.go('menu');
    return;
  }

  // reset the game messages
  Session.set('gameMessages', '');

  // add the keyboard controls
  $(document).on('keydown.game', function (e) {

    var key = e.which;
    var currentPlayer = Players.findOne(Session.get('currentPlayer'));

    // allow scrolling when player is dead
    if (currentPlayer && currentPlayer.dead) {
      // allow space to resurrect player
      if (key == "32") {
        Meteor.call('resurrectPlayer', Session.get('currentPlayer'));
        return false;
      }

      return true;
    }

    // add clause to prevent reverse gear
    if (key == "37") {
      updateDirection("left");
      return false;
    } else if (key == "65") {
      updateDirection("left");
      return false;
    } else if (key == "38") {
      updateDirection("up");
      return false;
    } else if (key == "87") {
      updateDirection("up");
      return false;
    } else if (key == "39") {
      updateDirection("right");
      return false;
    } else if (key == "68") {
      updateDirection("right");
      return false;
    } else if (key == "40") {
      updateDirection("down");
      return false;
    } else if (key == "83") {
      updateDirection("down");
      return false;
    }
  });
});

Template.game.onDestroyed(function () {
  $(document).off('.game');
  clearInterval(gameLoop);
});

Template.game.onRendered(function () {

  var self = this;
  var board;

  init();

  function init() {

    board = self.find('canvas').getContext('2d');
    if (!_.isUndefined(gameLoop)) clearInterval(gameLoop);
    gameLoop = setInterval(paint, 75);
  }

  function paint() {

    // avoid the snake trail we need to paint the BG on every frame
    // lets paint the canvas now
    board.fillStyle = "white";
    board.fillRect(0, 0, MAX_WIDTH, MAX_HEIGHT);

    // render the players
    var playersAlive = Players.find({ dead: false }).fetch();
    _.each(playersAlive, function (player) {

      var snakeParts = SnakeParts.findOne({ playerId: player._id });

      if (!snakeParts || !snakeParts.snakeParts) {
        return;
      }

      _.each(snakeParts.snakeParts, function (snakePart) {
        if (player._id === Session.get('currentPlayer'))
        // paint current players snake blue
          paintCell(snakePart.x, snakePart.y);
        else
        // paint other players red
          paintOtherPlayerCell(snakePart.x, snakePart.y);
      });
    });

    // paint the food
    _.each(Food.find().fetch(), function (food) {
      paintFoodCell(food.x, food.y);
    });

        // look up our current player
    var currentPlayer = Players.findOne(Session.get('currentPlayer'));
    var currentPlayerSnakeParts = SnakeParts.findOne({ playerId: currentPlayer._id });

    // no current player, just return
    if (!currentPlayer || !currentPlayerSnakeParts || !currentPlayerSnakeParts.snakeParts) {
      return;
    }

    if (currentPlayer.dead && !Session.get('firstStart')) {
      Session.set('gameMessages', "You died :(");
      return;
    }

    // movement code for the snake to come here
    // logic is simple
    // pop out the tail cell and place it in front of the head cell
    var snakeParts = currentPlayerSnakeParts.snakeParts;
    var d = currentPlayer.direction;
    var nx = snakeParts[0].x;
    var ny = snakeParts[0].y;

    // these were the position of the head cell
    // increment it to get the new head position
    // add proper direction based movement now
    if (d == "right") nx++;
    else if (d == "left") nx--;
    else if (d == "up") ny--;
    else if (d == "down") ny++;

    // loop around if we hit a wall
    if (nx >= MAX_WIDTH / CELL_WIDTH)
      nx = 0;
    else if (nx < -1)
      nx = (MAX_WIDTH / CELL_WIDTH) - 1;

    if (ny >= MAX_HEIGHT / CELL_WIDTH)
      ny = 0;
    else if (ny < -1)
      ny = (MAX_HEIGHT / CELL_WIDTH) - 1;

    // find all the other alive players
    var otherSnakeParts = SnakeParts.find({}).fetch();

    // check for any collisions with the other players
    var executioner = _(otherSnakeParts).find(function (otherSnakePart) {
      return checkCollision(nx, ny, otherSnakePart.snakeParts);
    });

    if (executioner) {
      // mark player as dead
      Players.update(currentPlayer._id, {
        $set: {
          dead: true
        }
      });

      Meteor.call('giveKillCredit', executioner._id);

      return;
    }

    // check whether the current player collided with it's own snake
    if (checkCollision(nx, ny, snakeParts)) {
      Players.update(currentPlayer._id, {
        $set: {
          dead: true
        }
      });
      return;
    }

    // add the eat the food logic now
    // check if new head position matches with that of the food
    // create a new head instead of moving the tail
    var tail;

    // Check if this player found food
    var food = _(Food.find().fetch()).find(function (food) {
      // only have to check the head of the snake
      return (nx == food.x && ny == food.y);
    });

    if (food) {
      tail = {
        x: nx,
        y: ny
      };
    } else {
      tail = snakeParts.pop(); // pops out the last cell
      tail.x = nx;
      tail.y = ny;
    }

    // snake can eat the food
    snakeParts.unshift(tail); // puts the tail as the first cell

    // update this player's current position on the server
    Meteor.call('playerMoved', currentPlayer._id, snakeParts, function () {
      // update this players score
      if (food) {
        Meteor.call('playerScored', food);
      }
    });
  }

  function paintFoodCell(x, y) {
    board.fillStyle = "blue";
    board.fillRect(x * CELL_WIDTH, y * CELL_WIDTH, CELL_WIDTH, CELL_WIDTH);
    board.strokeText = "white";
    board.strokeRect(x * CELL_WIDTH, y * CELL_WIDTH, CELL_WIDTH,
      CELL_WIDTH);
  }

  function paintOtherPlayerCell(x, y) {
    board.fillStyle = "red";
    board.fillRect(x * CELL_WIDTH, y * CELL_WIDTH, CELL_WIDTH, CELL_WIDTH);
    board.strokeText = "white";
    board.strokeRect(x * CELL_WIDTH, y * CELL_WIDTH, CELL_WIDTH,
      CELL_WIDTH);
  }

  function paintCell(x, y) {
    board.fillStyle = "green";
    board.fillRect(x * CELL_WIDTH, y * CELL_WIDTH, CELL_WIDTH, CELL_WIDTH);
    board.strokeText = "white";
    board.strokeRect(x * CELL_WIDTH, y * CELL_WIDTH, CELL_WIDTH,
      CELL_WIDTH);
  }
});

function updateDirection(newDirection) {
  var currentPlayer = Players.findOne(Session.get('currentPlayer'));

  if (newDirection == "left" && currentPlayer.direction != "right") {
    Players.update(currentPlayer._id, {
      $set: {
        direction: newDirection
      }
    });
  } else if (newDirection == "up" && currentPlayer.direction != "down") {
    Players.update(currentPlayer._id, {
      $set: {
        direction: newDirection
      }
    });
  } else if (newDirection == "right" && currentPlayer.direction != "left") {
    Players.update(currentPlayer._id, {
      $set: {
        direction: newDirection
      }
    });
  } else if (newDirection == "down" && currentPlayer.direction != "up") {
    Players.update(currentPlayer._id, {
      $set: {
        direction: newDirection
      }
    });
  }
}

