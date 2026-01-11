const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Contact = require('../models/Contact');

// Free AI API integration for auto-replies
// Using Hugging Face Inference API (free tier) or similar
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';
const SENTIMENT_MODEL = 'cardiffnlp/twitter-roberta-base-sentiment-latest';

// Simple keyword-based sentiment analysis (fallback)
function analyzeSentimentSimple(message) {
  const lowerMsg = message.toLowerCase();
  
  const positiveWords = ['thank', 'thanks', 'great', 'good', 'excellent', 'happy', 'satisfied', 'love', 'perfect', 'awesome', 'amazing', 'wonderful', 'pleased'];
  const negativeWords = ['bad', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'hate', 'problem', 'issue', 'error', 'wrong', 'broken', 'refund', 'cancel', 'complaint'];
  
  const positiveCount = positiveWords.filter(word => lowerMsg.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerMsg.includes(word)).length;
  
  if (negativeCount > positiveCount) return { sentiment: 'negative', score: 0.7 };
  if (positiveCount > negativeCount) return { sentiment: 'positive', score: 0.7 };
  return { sentiment: 'neutral', score: 0.5 };
}

// Generate smart reply suggestions based on message content
function generateSmartReplies(customerMessage, conversationHistory = []) {
  const lowerMsg = customerMessage.toLowerCase();
  const suggestions = [];
  
  // Greeting detection
  if (lowerMsg.match(/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/)) {
    suggestions.push({
      text: 'Hello! How can I assist you today?',
      confidence: 0.9,
      category: 'greeting'
    });
    suggestions.push({
      text: 'Hi there! What can I help you with?',
      confidence: 0.85,
      category: 'greeting'
    });
  }
  
  // Question detection
  if (lowerMsg.includes('?') || lowerMsg.match(/\b(how|what|when|where|why|can|could|would)\b/)) {
    suggestions.push({
      text: 'Let me check that for you right away.',
      confidence: 0.8,
      category: 'acknowledgment'
    });
    suggestions.push({
      text: 'I\'ll look into that and get back to you shortly.',
      confidence: 0.75,
      category: 'acknowledgment'
    });
  }
  
  // Problem/issue detection
  if (lowerMsg.match(/\b(problem|issue|error|wrong|broken|not working|doesn\'t work|failed)\b/)) {
    suggestions.push({
      text: 'I understand the issue. Let me help you resolve this.',
      confidence: 0.9,
      category: 'support'
    });
    suggestions.push({
      text: 'I\'m sorry to hear about the problem. Let me investigate this for you.',
      confidence: 0.85,
      category: 'support'
    });
  }
  
  // Order inquiry
  if (lowerMsg.match(/\b(order|delivery|shipping|track|status|when will|where is)\b/)) {
    suggestions.push({
      text: 'Let me check your order status. Can you please provide your order number?',
      confidence: 0.9,
      category: 'order'
    });
    suggestions.push({
      text: 'I\'ll look up your order details right away.',
      confidence: 0.8,
      category: 'order'
    });
  }
  
  // Payment/billing
  if (lowerMsg.match(/\b(payment|billing|charge|refund|invoice|bill|paid)\b/)) {
    suggestions.push({
      text: 'I can help you with billing questions. Let me check your account.',
      confidence: 0.9,
      category: 'billing'
    });
    suggestions.push({
      text: 'I\'ll review your billing information and get back to you.',
      confidence: 0.85,
      category: 'billing'
    });
  }
  
  // Thank you detection
  if (lowerMsg.match(/\b(thank|thanks|appreciate|grateful)\b/)) {
    suggestions.push({
      text: 'You\'re welcome! Is there anything else I can help with?',
      confidence: 0.95,
      category: 'closing'
    });
    suggestions.push({
      text: 'Happy to help! Feel free to reach out anytime.',
      confidence: 0.9,
      category: 'closing'
    });
  }
  
  // Generic fallback
  if (suggestions.length === 0) {
    suggestions.push({
      text: 'Thank you for your message. How can I assist you?',
      confidence: 0.7,
      category: 'generic'
    });
    suggestions.push({
      text: 'I\'m here to help. Could you provide more details?',
      confidence: 0.65,
      category: 'generic'
    });
  }
  
  // Return top 3 suggestions
  return suggestions.slice(0, 3);
}

// Get smart reply suggestions
router.post('/smart-reply', async (req, res) => {
  try {
    const { message, contactId } = req.body;
    
    if (!message || message.trim().length < 3) {
      return res.json({ suggestions: [] });
    }
    
    // Get conversation history for context
    let conversationHistory = [];
    if (contactId) {
      const messages = await Message.find({ contactId })
        .sort({ timestamp: -1 })
        .limit(5);
      conversationHistory = messages.map(m => m.message);
    }
    
    // Generate smart replies
    const suggestions = generateSmartReplies(message, conversationHistory);
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating smart replies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze sentiment
router.post('/sentiment', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Use simple sentiment analysis (free, no API key needed)
    const sentiment = analyzeSentimentSimple(message);
    
    res.json(sentiment);
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get auto-greeting template based on time
router.get('/auto-greeting', async (req, res) => {
  try {
    const hour = new Date().getHours();
    let greeting;
    
    if (hour < 12) {
      greeting = 'Good morning! How can I assist you today?';
    } else if (hour < 17) {
      greeting = 'Good afternoon! How can I help you?';
    } else if (hour < 21) {
      greeting = 'Good evening! What can I do for you?';
    } else {
      greeting = 'Hello! How can I assist you?';
    }
    
    res.json({ greeting, timeBased: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze conversation context for better replies
router.post('/analyze-context', async (req, res) => {
  try {
    const { contactId, currentMessage } = req.body;
    
    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }
    
    // Get recent conversation
    const messages = await Message.find({ contactId })
      .sort({ timestamp: -1 })
      .limit(10);
    
    // Analyze conversation context
    const context = {
      messageCount: messages.length,
      lastMessageDirection: messages[0]?.direction || 'outbound',
      hasUnresolvedIssue: messages.some(m => 
        m.direction === 'inbound' && 
        m.message.toLowerCase().match(/\b(problem|issue|error|help|need)\b/)
      ),
      conversationTopic: extractTopic(messages),
      suggestedAction: suggestAction(messages, currentMessage)
    };
    
    res.json(context);
  } catch (error) {
    console.error('Error analyzing context:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function extractTopic(messages) {
  const allText = messages.map(m => m.message.toLowerCase()).join(' ');
  
  if (allText.match(/\b(order|delivery|shipping)\b/)) return 'order';
  if (allText.match(/\b(payment|billing|refund)\b/)) return 'billing';
  if (allText.match(/\b(problem|issue|error|broken)\b/)) return 'support';
  if (allText.match(/\b(product|item|feature)\b/)) return 'product';
  
  return 'general';
}

function suggestAction(messages, currentMessage) {
  if (!currentMessage) return 'acknowledge';
  
  const lowerMsg = currentMessage.toLowerCase();
  
  if (lowerMsg.match(/\b(thank|thanks)\b/)) return 'close';
  if (lowerMsg.match(/\b(problem|issue|error)\b/)) return 'investigate';
  if (lowerMsg.match(/\b(order|delivery)\b/)) return 'check_order';
  if (lowerMsg.match(/\?\s*$/)) return 'answer_question';
  
  return 'respond';
}

module.exports = router;

