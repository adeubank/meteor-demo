Players = new Mongo.Collection('players');
if (Meteor.isServer) {
  // initialize an in memory snake parts on the server
  SnakeParts = new Mongo.Collection('snakeparts', { connection: null });
  Food = new Mongo.Collection('food', { connection: null });
} else if (Meteor.isClient) {
  // Must initialize the default collection on the client
  SnakeParts = new Mongo.Collection('snakeparts');
  Food = new Mongo.Collection('food');
}
HallOfFame = new Mongo.Collection('halloffame');

// board is 500px wide
// board is 50 x 50 cells
MAX_WIDTH = 500;
MAX_HEIGHT = 500;
CELL_WIDTH = 10; // each cell is 10px wide
MIN_FOOD = 25;

validatePlayer = function (player) {

  var errors = {};
  var existingPlayer = Players.findOne({ playerName: player.playerName });

  if (_.isEmpty(player.playerName))
    errors.playerName = 'Please enter a name';

  // only let users that own the player choose this one
  if (existingPlayer && existingPlayer.userId !== player.userId) {
    errors.playerName = 'Player already exists with that name';
  }

  return errors;
};

playerDefaults = function (firstStart) {
  var player = {};

  player.direction = "right";
  player.dead = firstStart || false;
  player.kills = 0;
  player.score = 0;

  return player;
};

//on player creation initialize with basic variables i.e. snakeParts array, score
Players.allow({
  insert: function(userId, doc) {

    doc = _.defaults(doc, playerDefaults(true));
    doc.userId = userId;
    return _.isEmpty(validatePlayer(doc));
  },
  update: function(userId, doc, fields, modifier) {

    if (_(fields).contains('kills')  || _(fields).contains('score')) {
      console.log(doc, fields, modifier);
    }

    if (_(fields).contains('dead') && modifier.$set.dead) {
      SnakeParts.remove({ playerId: doc._id });
      Meteor.call('addPlayerToHallOfFame', doc);
    }

    return userId === doc.userId;
  },
  remove: function(userId, doc) {
    return userId === doc.userId;
  }
});

Meteor.users.allow({
  insert: function (userId, doc) {
    return userId == doc.userId;
  },
  update: function (userId, doc, fields, modifier) {
    return userId === doc.userId;
  },
  remove: function (userId, doc) {
    return userId == doc.userId;
  }
});
