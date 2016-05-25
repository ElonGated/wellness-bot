require('dotenv').load();
var Botkit = require('botkit');
var redis = require('redis');

// connect to data
var redisURL = process.env.REDIS_URL || 'redis://localhost:6379';
var redisClient = redis.createClient();

var controller = Botkit.slackbot({
    debug: true
});

// connect the bot to a stream of messages, token is saved in .env file
var bot = controller.spawn({
    token: process.env.SLACK_INTEGRATION_TOKEN
}).startRTM(function(err) {
    // connect to redis db and check connection
    redisClient.on('connect', function() {
        console.log('redis is connected');
    });
    
    // set up the timer for delivering activity messages
    var i = 0;
    var timer = setInterval(function() { sayActivity(i++) }, 5000);

    var sayActivity = function(activity) {
        console.log('timer works!!!! ' + activity);
        redisClient.lrange('activitylist', activity, activity, function(err,reply) {
            for(var activity in reply) {    
                bot.say(
                    {
                        
                        text: '<!here> ' + reply[activity],
                        channel: 'G1BL6B1U3',
                    }
                );
            }
        });
    }
});

// give the bot something to listen for.
controller.hears(['hello','hi'],['direct_message','direct_mention','mention'],function(bot,message) {
    console.log(message);
    bot.reply(message, 'Hi Everybody!');
});

// sign up to 'users' data object
controller.hears(['sign up', 'check in'],['direct_message'],function(bot,message) {
    console.log(message);
    redisClient.hget(message.user, 'name', function(err, reply) {
        console.log(reply + ' this should be the user name');
    
        if (reply === message.user) {
            bot.reply(message, 'Looks like you\'re already signed up.');
        } else {

            redisClient.hmset(message.user, {
                'name': message.user,
                'dmchannel': message.channel,
                'signuptime': message.ts,
                'ogmessage': message.text
            });
            bot.reply(message, {
                text: 'You got it Dude!',
                username: 'wellness-bot',
                icon_emoji: ':yougotitdude:',
            });
        };
    });
});

// unsubscribe
controller.hears(['unsubscribe'],['direct_message'],function(bot,message) {
    console.log(message);
    redisClient.hget(message.user, 'name', function(err, reply){

        if (reply != message.user) {
            bot.reply(message, 'I don\'t think you\'re on my list. If you\'d like to subscribe say \'sign up\'.');
        } else {
            redisClient.del(message.user);
            bot.reply(message, 'Farewell.');
        };
    });

});


// add to activity list
var activity = '';
controller.hears(['activity', 'add'], ['direct_message'],function(bot,message) {
    console.log(message);
    if (message.text) {
        var activity = message.text.slice(4);
    }
    redisClient.rpush(['activitylist', activity], function(err, reply) {
        console.log(reply);
    });
    bot.reply(message, 'Sounds like fun!');
});

// display the activity list, shifted by 1 for humans
controller.hears(['list', 'activities'], ['direct_message'],function(bot,message){
    console.log(message);
    redisClient.lrange('activitylist', 0, -1, function(err,reply) {
        for(var i in reply){
            var number = Number(i) + 1;
            bot.reply(message, number + '. ' + reply[i]);
        }
    });

});

//remove from activity list
controller.hears(['delete'], ['direct_message'],function(bot,message){
    console.log(message);
    bot.reply(message, 'Ok, here\'s the list:');
        // display ordered list
        redisClient.lrange('activitylist', 0, -1, function(err,reply) {
            for(var i in reply){
                var number = Number(i) + 1;
                bot.reply(message, number + '. ' + reply[i]);
            }
        });
    // ask what to delete
    bot.startConversation(message, function(err, convo) {
        convo.ask('What\'s the number of the activity you want me to delete?', function(response, convo) {
            console.log(response);
            var responseNumber = Number(response.text) - 1;
            console.log(responseNumber);
            redisClient.lrange('activitylist', responseNumber, responseNumber, function(err, reply) {
                convo.ask('Sure you want to remove: \"' + reply + '\" ?', [
                {
                    pattern: bot.utterances.yes,
                    callback: function(response, convo) {
                        convo.say('Yeah, I never liked that one either.');
                        redisClient.lrem('activitylist', 0, reply);
                        convo.next();
                    }
                },
                {
                    pattern: bot.utterances.no,
                    callback: function(response, convo) {
                        convo.say('Oh, ok I can leave it in then.');
                        convo.next();
                    }
                },
                {
                    default: true,
                    callback: function(response, convo) {
                        convo.repeat();
                        convo.next();
                    }
                }
                ]);
            });
        convo.next();
        });
    });
});









/*garrett info type: 'message',
  channel: 'D1A21PRJM',
  user: 'U0N6V46A1',
  text: 'sign up',
  ts: '1464190002.000006',
  team: 'T026FTM0X',
  event: 'direct_message',
  match: [ 'sign up', index: 0, input: 'sign up' ] }

*/

/*toyourhealthdev
{ type: 'message',
  channel: 'G1BL6B1U3',
  user: 'U0ASPPDFY',
  text: 'hi',
  ts: '1464191434.000005',
  team: 'T026FTM0X',
  event: 'ambient',
  match: [ 'hi', index: 0, input: 'hi' ] }

*/




