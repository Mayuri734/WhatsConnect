const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Contact = require('../models/Contact');

// Helper to calculate SLA time
function calculateSLATime(lastMessageTime, slaHours = 2) {
  if (!lastMessageTime) return null;
  
  const now = new Date();
  const lastMsg = new Date(lastMessageTime);
  const diffMs = now - lastMsg;
  const diffMins = Math.floor(diffMs / 60000);
  
  const remainingMins = (slaHours * 60) - diffMins;
  
  if (remainingMins <= 0) {
    return { 
      overdue: true, 
      minutes: Math.abs(remainingMins),
      text: `${Math.abs(remainingMins)}m overdue`, 
      urgent: true 
    };
  } else if (remainingMins <= 30) {
    return { 
      overdue: false, 
      minutes: remainingMins,
      text: `${remainingMins}m remaining`, 
      urgent: true 
    };
  } else {
    const hours = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;
    return { 
      overdue: false, 
      minutes: remainingMins,
      text: `${hours}h ${mins}m remaining`, 
      urgent: false 
    };
  }
}

// Get all conversations (grouped by contact)
router.get('/', async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $group: {
          _id: '$contactId',
          lastMessage: { $max: '$timestamp' },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { lastMessage: -1 } }
    ]);

    // Populate contact details with SLA info
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const contact = await Contact.findById(conv._id);
        const lastMessage = await Message.findOne({ contactId: conv._id })
          .sort({ timestamp: -1 });
        
        // Calculate SLA
        let slaInfo = null;
        if (contact && contact.lastContacted) {
          slaInfo = calculateSLATime(contact.lastContacted);
        }
        
        // Get sentiment of last message
        let sentiment = 'neutral';
        if (lastMessage && lastMessage.direction === 'inbound') {
          const lowerMsg = lastMessage.message.toLowerCase();
          const negativeWords = ['bad', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'hate', 'problem', 'issue', 'error'];
          const positiveWords = ['thank', 'great', 'good', 'excellent', 'happy', 'satisfied', 'love', 'perfect'];
          const negCount = negativeWords.filter(w => lowerMsg.includes(w)).length;
          const posCount = positiveWords.filter(w => lowerMsg.includes(w)).length;
          if (negCount > posCount) sentiment = 'negative';
          else if (posCount > negCount) sentiment = 'positive';
        }
        
        return {
          contact,
          lastMessage: lastMessage ? {
            message: lastMessage.message,
            timestamp: lastMessage.timestamp,
            direction: lastMessage.direction
          } : null,
          messageCount: conv.messageCount,
          unreadCount: conv.unreadCount || 0,
          sla: slaInfo,
          sentiment: sentiment
        };
      })
    );

    res.json(populatedConversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

