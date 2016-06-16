require('dotenv').load();
var Botkit = require('botkit');
var redis = require('redis');
var moment = require('moment');
moment().format();

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
    
    // uses the arg to pull the item on the activitylist associated with that number
    var sayActivity = function(activity) {
        console.log('!*! activity index -> ' + activity);
        redisClient.lrange('activitylist', activity, activity, function(err,reply) {
            bot.say(
                {
                    text: '<!here> ' + reply,
                    // to_your_health: G1BMRM341; to_your_health_dev: G1E2WPCEP;
                    channel: 'G1E2WPCEP',
                }
            );
        });
    }    


    // feeds sayActivity a random number from 0 - n, n being the length of the activitylist
    //even
    var sayActivityListEven = function(){
        redisClient.llen('activitylist', function(err, length) {
            var randomnumber = (Math.floor(Math.random() * (length - 0 + 1)) + 0)-1;
            if (randomnumber % 2 != 0 && randomnumber != length) {
                randomnumber += 1;
                sayActivity(randomnumber);
            } else if (randomnumber % 2 != 0 && randomnumber == length) {
                randomnumber -= 1;
                sayActivity(randomnumber);
            } else {
                sayActivity(randomnumber);
            }
        });
    }
    var sayActivityListOdd = function(){
        redisClient.llen('activitylist', function(err, length) {
            var randomnumber = (Math.floor(Math.random() * (length - 0 + 1)) + 0)-1;
            if (randomnumber % 2 == 0 && randomnumber != 0) {
                randomnumber -= 1;
                sayActivity(randomnumber);
            } else if (randomnumber % 2 == 0 && randomnumber == 0) {
                randomnumber += 1;
                sayActivity(randomnumber);
            } else {
                sayActivity(randomnumber);
            }
        });
    }

    // sets the timer for when the activity is said by the bot during business-ish hours 
    setInterval(function(err) { 
        var t = moment();
        if (t.day() > 0 && t.day() < 6 && t.hour() > 6 && t.hour() < 19) { 
                    if (t.hour() % 2 == 0) {
                        //console.log(t.hour());
                        sayActivityListEven(); 
                    } else {
                        //console.log(t.hour());
                        sayActivityListOdd();
                    }
        } else {
            return;
        }  
    }, Math.floor(Math.random() * (3900000 - 3300000 + 1)) + 3300000); 
});

// give the bot something to listen for.
controller.hears(['(.*)'],['direct_message'], function(bot,message){
    bot.reply(message, 'Hi! I\'m not much for 1 on 1 chatting...I prefer a crowd. Head over to our channel \'to_your_health\'! When you\'re there say \'help\' for more info about me. :heart:');
});
controller.hears(['^hello (.*)$','^hi (.*)$', '^hi$', '^hello$'],['direct_mention','mention', 'ambient'],function(bot,message) {
    console.log(message);
    bot.reply(message, 'Hi Everybody!');
});

// help command 
controller.hears(['^help$'], ['direct_message','direct_mention','mention', 'ambient'],function(bot,message){
    console.log(message);
    bot.reply(message, 'Ok, here\'s what I can do: (btw, you have to say \'@wellness-bot:\' before any of the commands below)');
    bot.reply(message, 'Say \'add\' to contribute an activity to the list. Try to remember that I have to repeat it later :flushed:');
    bot.reply(message, 'To see the list we have so far say \'list\'.');
    bot.reply(message, 'If you really don\'t like something on the list say \'delete\', and I\'ll help you remove it.');
    bot.reply(message, '...PS If you\'re tired of messages popping up from a Slack channel, just type \'/mute\'.');
});

// add to activity list
var activity = '';
controller.hears(['^add(.*)$'], ['direct_mention'],function(bot,message) {
    console.log(message);
    bot.startConversation(message, function(err, convo){
        convo.ask('What activity should I add?', function(response, convo){
            console.log(response);
            if (response.text === 'cancel') {   
                convo.stop();
                return;             
            } 
            redisClient.rpush(['activitylist', response.text], function(err, reply) {
                console.log(reply);
                convo.say('Sounds like fun!');
                });
            convo.next();
        });
    });
});

// display the activity list, shifted by 1 for humans
controller.hears(['^list(,*)$', '^activities(.*)$'], ['direct_mention'],function(bot,message){
    console.log(message);
    bot.reply(message, ':scroll: :heart: :scroll:')

    redisClient.lrange('activitylist', 0, -1, function(err,reply) {
        for(var i in reply){
            var number = Number(i) + 1;
            bot.reply(message, number.toString() + '. ' + reply[i]);
        }
        bot.reply(message, ':scroll: :heart: :scroll:')
    });
});

//remove from activity list
controller.hears(['delete'], ['direct_mention'],function(bot,message){
    console.log(message);
    bot.reply(message, 'Ok, here\'s the list:');
    bot.reply(message, ':scroll: :skull_and_crossbones: :scroll:')
    
        // display ordered list
        redisClient.lrange('activitylist', 0, -1, function(err,reply) {
            for(var i in reply){
                var number = Number(i) + 1;
                bot.reply(message, number + '. ' + reply[i]);
            }
        bot.reply(message, ':scroll: :skull_and_crossbones: :scroll:')
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
                        redisClient.lrem('activitylist', -1, reply);
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



// !depricated! sign up to 'users' data object; 

/*controller.hears(['sign up', 'check in'],['direct_message'],function(bot,message) {
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
*/










