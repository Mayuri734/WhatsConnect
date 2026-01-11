const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Contact = require('../models/Contact');

// Get all messages
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find()
      .populate('contactId')
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    // Return empty array instead of error
    res.json([]);
  }
});

// Get messages for a contact
router.get('/contact/:contactId', async (req, res) => {
  try {
    const messages = await Message.find({ contactId: req.params.contactId })
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages by phone number
router.get('/phone/:phone', async (req, res) => {
  try {
    const cleanedPhone = req.params.phone.replace(/\D/g, '');
    const messages = await Message.find({ phone: cleanedPhone })
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages with sentiment analysis
router.get('/contact/:contactId/with-sentiment', async (req, res) => {
  try {
    const messages = await Message.find({ contactId: req.params.contactId })
      .sort({ timestamp: 1 });
    
    // Add sentiment to each message
    const messagesWithSentiment = messages.map(msg => {
      const sentiment = analyzeMessageSentiment(msg.message);
      return {
        ...msg.toObject(),
        sentiment: sentiment.sentiment,
        sentimentScore: sentiment.score
      };
    });
    
    res.json(messagesWithSentiment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function for sentiment (same as in ai.js)
function analyzeMessageSentiment(message) {
  const lowerMsg = message.toLowerCase();
  
  const positiveWords = ['thank', 'thanks', 'great', 'good', 'excellent', 'happy', 'satisfied', 'love', 'perfect', 'awesome', 'amazing', 'wonderful', 'pleased'];
  const negativeWords = ['bad', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'hate', 'problem', 'issue', 'error', 'wrong', 'broken', 'refund', 'cancel', 'complaint'];
  
  const positiveCount = positiveWords.filter(word => lowerMsg.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerMsg.includes(word)).length;
  
  if (negativeCount > positiveCount) return { sentiment: 'negative', score: 0.7 };
  if (positiveCount > negativeCount) return { sentiment: 'positive', score: 0.7 };
  return { sentiment: 'neutral', score: 0.5 };
}

// Create message
router.post('/', async (req, res) => {
  try {
    const message = new Message(req.body);
    await message.save();
    
    // Update contact's lastContacted
    if (req.body.contactId) {
      await Contact.findByIdAndUpdate(req.body.contactId, {
        lastContacted: new Date()
      });
    }
    
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get message statistics
router.get('/stats/summary', async (req, res) => {
  try {
    // Return default values if database query fails (for new installations)
    let totalMessages = 0;
    let inboundMessages = 0;
    let outboundMessages = 0;
    let messagesToday = 0;
    
    try {
      totalMessages = await Message.countDocuments();
      inboundMessages = await Message.countDocuments({ direction: 'inbound' });
      outboundMessages = await Message.countDocuments({ direction: 'outbound' });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      messagesToday = await Message.countDocuments({ timestamp: { $gte: today } });
    } catch (dbError) {
      console.error('Database query error (returning defaults):', dbError.message);
      // Return zeros if database not connected - this is OK for new installations
    }
    
    res.json({
      totalMessages,
      inboundMessages,
      outboundMessages,
      messagesToday
    });
  } catch (error) {
    console.error('Error in stats/summary:', error);
    // Return default values instead of error
    res.json({
      totalMessages: 0,
      inboundMessages: 0,
      outboundMessages: 0,
      messagesToday: 0
    });
  }
});

module.exports = router;

