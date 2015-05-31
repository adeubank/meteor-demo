Meteor.methods({
  'createFood': function () {
    Food.insert({
      x: Math.round(Math.random() * (MAX_WIDTH - CELL_WIDTH) / CELL_WIDTH),
      y: Math.round(Math.random() * (MAX_HEIGHT - CELL_WIDTH) / CELL_WIDTH)
    });
  },
  'resurrectPlayer': function (id) {

    if (Meteor.isClient)
      Session.set('firstStart', false);

    Players.update(id, {
      $set: playerDefaults()
    });

    // creates a cell with x,y between 10-19
    // always place player somewhere in the middle of the game
    var cellRange = _.range(10, (MAX_WIDTH / 2) / CELL_WIDTH - 10);
    var startX = _.sample(cellRange);
    var startY = _.sample(cellRange);

    var newSnakeParts = _.range(5).reverse().map(function (i) {
      return {
        x: startX + i,
        y: startY
      };
    });

    Meteor.call('playerMoved', id, newSnakeParts);
  },
  'playerScored': function (food) {

    var player = Players.findOne({
      userId: this.userId
    });

    check(player, Object);

    Players.update(player._id, {
      $inc: {
        score: 1
      }
    });
    Food.remove(food._id);

    if (Meteor.isServer) {
      Meteor.call('createFood');
    }
  },

  giveKillCredit: function (playerId) {
    // give executioner credit
    Players.update(playerId, {
      $inc: {
        kills: 1
      }
    });
  },

  'addPlayerToHallOfFame': function (playerId) {
    var player = Players.findOne(playerId);
    var hallOfFame = HallOfFame.findOne({
      deadPlayerId: playerId
    });

    // return if hall of fame score is higher than dead player score
    if (hallOfFame && hallOfFame.score > player.score) {
      return;
    }

    hallOfFame = {
      deadPlayerId: player._id,
      playerName: player.playerName,
      score: player.score,
      kills: player.kills,
      createdAt: new Date()
    };
    HallOfFame.upsert({
      deadPlayerId: player._id
    }, hallOfFame);
  },

  'playerMoved': function (playerId, snakeParts) {
    SnakeParts.upsert({ playerId: playerId }, {
      playerId: playerId,
      snakeParts: snakeParts
    });
  }
});

