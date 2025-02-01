const express = require('express');
const bodyParser = require('body-parser');

const mongoose = require('mongoose');

const twilio = require('twilio');
const cron = require('node-cron'); // For scheduling tasks

const app = express();
const port = 3000;

const cors = require('cors');
app.use(cors());

app.use(bodyParser.json());

// Twilio setup
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = require('twilio')(accountSid, authToken);

// MongoDB setup
const mongoURI =
  'mongodb+srv://java:passw0rd@cluster0.hzurcpu.mongodb.net/sms_reminder';
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Reminder schema and model
const reminderSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  message: { type: String, required: true },
  sendTime: { type: Date, required: true },
});

const Reminder = mongoose.model('Reminder', reminderSchema);

// Routes

app.get('/', (req, res) => {
  res.send('Hello! Your server is running successfully.');
});

app.post('/reminders', async (req, res) => {
  const { phone, message, sendTime } = req.body;

  try {
    const reminder = new Reminder({ phone, message, sendTime });
    await reminder.save();

    res.send({ success: true, message: 'Reminder scheduled!' });
  } catch (error) {
    console.error('Error saving reminder:', error);
    res
      .status(500)
      .send({ success: false, message: 'Failed to schedule reminder' });
  }
});

// Cron job to check and send reminders every minute
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const reminders = await Reminder.find({ sendTime: { $lte: now } });

  reminders.forEach(async (reminder) => {
    try {
      // Send SMS
      await client.messages.create({
        body: reminder.message,
        from: twilioPhoneNumber,
        to: reminder.phone,
      });

      console.log(`Reminder sent to ${reminder.phone}`);

      // Delete reminder after sending
      await Reminder.deleteOne({ _id: reminder._id });
    } catch (error) {
      console.error(`Failed to send reminder to ${reminder.phone}:`, error);
    }
  });
});

app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);
