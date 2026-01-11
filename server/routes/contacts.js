const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// Get all contacts
router.get('/', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ updatedAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single contact
router.get('/:id', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create contact
router.post('/', async (req, res) => {
  try {
    const contact = new Contact(req.body);
    await contact.save();
    res.status(201).json(contact);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update contact
router.put('/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete contact
router.delete('/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search contacts
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const contacts = await Contact.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { company: { $regex: query, $options: 'i' } }
      ]
    });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update query status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'in-progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { queryStatus: status },
      { new: true }
    );
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark messages as read
router.post('/:id/read', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { unreadCount: 0 },
      { new: true }
    );
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get contacts by query status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    let query = {};
    if (status !== 'all') {
      query = { queryStatus: status };
    }
    const contacts = await Contact.find(query)
      .sort({ lastContacted: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get contacts with unread messages
router.get('/unread/all', async (req, res) => {
  try {
    const contacts = await Contact.find({ unreadCount: { $gt: 0 } })
      .sort({ lastContacted: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add tag to contact
router.post('/:id/tags', async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return res.status(400).json({ error: 'Tag is required' });
    }
    
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    if (!contact.tags) {
      contact.tags = [];
    }
    
    if (!contact.tags.includes(tag)) {
      contact.tags.push(tag);
      await contact.save();
    }
    
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove tag from contact
router.delete('/:id/tags/:tag', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    if (contact.tags) {
      contact.tags = contact.tags.filter(t => t !== req.params.tag);
      await contact.save();
    }
    
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all unique tags
router.get('/tags/all', async (req, res) => {
  try {
    const contacts = await Contact.find({ tags: { $exists: true, $ne: [] } });
    const allTags = new Set();
    contacts.forEach(contact => {
      if (contact.tags) {
        contact.tags.forEach(tag => allTags.add(tag));
      }
    });
    res.json(Array.from(allTags));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get contact insights
router.get('/:id/insights', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const Message = require('../models/Message');
    const messages = await Message.find({ contactId: req.params.id }).sort({ timestamp: 1 });
    
    // Calculate metrics
    const totalMessages = messages.length;
    const inboundCount = messages.filter(m => m.direction === 'inbound').length;
    const outboundCount = messages.filter(m => m.direction === 'outbound').length;
    
    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].direction === 'inbound' && messages[i + 1].direction === 'outbound') {
        const timeDiff = new Date(messages[i + 1].timestamp) - new Date(messages[i].timestamp);
        totalResponseTime += timeDiff;
        responseCount++;
      }
    }
    const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount / 60000) : 0;
    
    // Calculate sentiment distribution
    const sentiments = messages
      .filter(m => m.direction === 'inbound')
      .map(m => {
        const lowerMsg = m.message.toLowerCase();
        const negativeWords = ['bad', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'hate', 'problem', 'issue', 'error'];
        const positiveWords = ['thank', 'great', 'good', 'excellent', 'happy', 'satisfied', 'love', 'perfect'];
        const negCount = negativeWords.filter(w => lowerMsg.includes(w)).length;
        const posCount = positiveWords.filter(w => lowerMsg.includes(w)).length;
        if (negCount > posCount) return 'negative';
        if (posCount > negCount) return 'positive';
        return 'neutral';
      });
    
    const sentimentCounts = {
      positive: sentiments.filter(s => s === 'positive').length,
      neutral: sentiments.filter(s => s === 'neutral').length,
      negative: sentiments.filter(s => s === 'negative').length
    };
    
    res.json({
      contact,
      metrics: {
        totalMessages,
        inboundCount,
        outboundCount,
        avgResponseTime,
        sentimentCounts
      },
      lastContacted: contact.lastContacted,
      queryStatus: contact.queryStatus,
      unreadCount: contact.unreadCount || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

