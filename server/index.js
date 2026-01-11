const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend running fine 🚀' });
});

// Routes
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/ai', require('./routes/ai'));

// WhatsApp ONLY locally
if (process.env.NODE_ENV !== "production") {
  app.use('/api/whatsapp', require('./routes/whatsapp'));
} else {
  console.log("WhatsApp routes disabled in production");
}

// MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsconnect';
if (mongoURI) {
  mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));
} else {
  console.warn('MongoDB URI not provided. Database features will be unavailable.');
}

// Error safety
process.on('unhandledRejection', err => console.error(err));
process.on('uncaughtException', err => console.error(err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
