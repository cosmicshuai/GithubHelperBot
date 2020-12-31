// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// index.js is used to setup and configure your bot

// Import required pckages
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { BotFrameworkAdapter } = require('botbuilder');

// Import bot definitions
const { BotActivityHandler } = require('./botActivityHandler');

// Read botFilePath and botFileSecret from .env file.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new BotFrameworkAdapter({
    appId: process.env.BotId,
    appPassword: process.env.BotPassword
});

adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights.
    console.error(`\n [onTurnError] unhandled error: ${ error }`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${ error }`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send a message to the user
    await context.sendActivity('The bot encountered an error or bug.');
    await context.sendActivity('To continue to run this bot, please fix the bot source code.');
};

// Create bot handlers
const conversationReferences = {}
const botActivityHandler = new BotActivityHandler(conversationReferences);

// Create HTTP server.
const server = express();
server.use(bodyParser.json());
const port = process.env.port || process.env.PORT || 3978;
server.listen(port, () => 
    console.log(`\Bot/ME service listening at http://localhost:${port}`)
);

// Listen for incoming requests.
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        // Process bot activity
        await botActivityHandler.run(context);
    });
});

// Listen for incoming notifications and send proactive messages to users.
server.post('/api/notify', async (req, res) => {
    console.log(conversationReferences);
    const body = await req.body;
    const headers = await req.headers;
    let event = headers['x-github-event'];
    console.log('github message received')
    let msg = '';
    if (event === 'issue_comment') {
      const commentBody = body.comment.body;
      const author = body.comment.user.login;
      const repoName = body.repository.full_name;
      const title = body.issue.title;
      const link = body.comment.html_url;
      const createdTime = body.comment.created_at;
      const mentionedIds = extractMentions(commentBody);
      
      msg = `${author} left a comment under ${title} of ${repoName}.\n \tContent: ${commentBody}\n\tThe link is ${link}`
    }

    console.log(body);
    for (const conversationReference of Object.values(conversationReferences)) {
        await adapter.continueConversation(conversationReference, async turnContext => {
            // If you encounter permission-related errors when sending this message, see
            // https://aka.ms/BotTrustServiceUrl
            await turnContext.sendActivity(msg);
        });
    }

    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.write('<html><body><h1>Proactive messages have been sent.</h1></body></html>');
    res.end();
});

server.post('/push', async (req, res) => {
    const body = await req.body;
    const headers = await req.headers;
    let event = headers['x-github-event'];
    let msg = '';
    if (event === 'issue_comment') {
      console.log(body.comment.body);
      const commentBody = body.comment.body;
      const author = body.comment.user.login;
      const repoName = body.repository.full_name;
      const title = body.issue.title;
      const link = body.comment.html_url;
      const createdTime = body.comment.created_at;
      const mentionedIds = extractMentions(commentBody);
      msg = `${author} left a comment under ${title} of ${repoName}.\n \tContent: ${commentBody}\n\tThe link is ${link}`;
      console.log(mentionedIds);
      console.log(botActivityHandler.state);
      mentionedIds.forEach(async (id) => {
        const memory = botActivityHandler.state[id];
        if(memory) {
            const conversationReference = memory.conversationReference;
            await adapter.continueConversation(conversationReference, async turnContext => {
                // If you encounter permission-related errors when sending this message, see
                // https://aka.ms/BotTrustServiceUrl
                await turnContext.sendActivity(msg);
            });
        }
      });
    }

    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.write('<html><body><h1>Proactive messages have been sent.</h1></body></html>');
    res.end();
});



server.get('/greeting', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        // Process bot activity
        await botActivityHandler.run(context);
    });
});


function extractMentions(body){
    const result = []
    const pattern = /@[A-Za-z0-9_-]*/g;
    const matched = body.match(pattern);
    if (matched) {
        matched.forEach(e => result.push(e.substr(1, e.length - 1)));
    }

    return result;
}