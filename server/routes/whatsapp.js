const express = require('express');
const router = express.Router();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
let qrcode = null;
try {
  qrcode = require('qrcode');
} catch (e) {
  console.log('qrcode package not installed - server-side QR generation disabled');
}
const Message = require('../models/Message');
const Contact = require('../models/Contact');

// Helper function for sentiment analysis
function analyzeSentiment(message) {
  const lowerMsg = message.toLowerCase();
  
  const positiveWords = ['thank', 'thanks', 'great', 'good', 'excellent', 'happy', 'satisfied', 'love', 'perfect', 'awesome', 'amazing', 'wonderful', 'pleased'];
  const negativeWords = ['bad', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'hate', 'problem', 'issue', 'error', 'wrong', 'broken', 'refund', 'cancel', 'complaint'];
  
  const positiveCount = positiveWords.filter(word => lowerMsg.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerMsg.includes(word)).length;
  
  if (negativeCount > positiveCount) return { sentiment: 'negative', score: 0.7 };
  if (positiveCount > negativeCount) return { sentiment: 'positive', score: 0.7 };
  return { sentiment: 'neutral', score: 0.5 };
}

let whatsappClient = null;
let qrCodeData = null;
let isReady = false;
let isInitializing = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// Initialize WhatsApp client
function initWhatsApp(resetRetryCount = true) {
  // Prevent multiple simultaneous initializations
  if (whatsappClient || isInitializing) {
    return;
  }

  isInitializing = true;
  if (resetRetryCount) {
    retryCount = 0;
  }

  whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      timeout: 60000
    }
  });

  whatsappClient.on('qr', (qr) => {
    console.log('QR Code received - available in Settings page');
    console.log('QR Code length:', qr.length); // Debug: verify QR code is received
    qrCodeData = qr;
    // QR code is now displayed in the Settings page, not in terminal
    // Uncomment the line below if you want to see QR in terminal for debugging
    // qrcode.generate(qr, { small: true });
  });

  whatsappClient.on('ready', () => {
    console.log('WhatsApp client is ready!');
    isReady = true;
    qrCodeData = null;
    isInitializing = false;
    retryCount = 0;
  });

  whatsappClient.on('authenticated', () => {
    console.log('WhatsApp authenticated');
  });

  whatsappClient.on('auth_failure', (msg) => {
    console.error('WhatsApp authentication failure:', msg);
    isReady = false;
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log('WhatsApp disconnected:', reason);
    isReady = false;
    isInitializing = false;
    // Delay cleanup to avoid Windows file locking issues
    setTimeout(() => {
      whatsappClient = null;
    }, 2000);
  });

  // Handle client errors gracefully
  whatsappClient.on('error', (error) => {
    // Ignore EBUSY errors (Windows file locking issue)
    if (error.message && error.message.includes('EBUSY')) {
      console.warn('WhatsApp file locking warning (safe to ignore):', error.message);
      return;
    }
    // Handle ProtocolError - browser context destroyed
    if (error.message && (error.message.includes('Protocol error') || error.message.includes('Execution context was destroyed'))) {
      console.warn('WhatsApp ProtocolError detected - will retry initialization');
      isInitializing = false;
      retryWithBackoff();
      return;
    }
    console.error('WhatsApp client error:', error);
  });

  // Listen for incoming messages
  whatsappClient.on('message', async (msg) => {
    try {
      const phone = msg.from.replace('@c.us', '');
      
      // Find or create contact
      let contact = await Contact.findOne({ phone });
      
      if (!contact) {
        // Auto-create contact from incoming message
        // Try to get contact name from WhatsApp
        let contactName = 'Customer';
        try {
          const contactInfo = await whatsappClient.getContactById(msg.from);
          if (contactInfo && contactInfo.pushname) {
            contactName = contactInfo.pushname;
          } else if (contactInfo && contactInfo.name) {
            contactName = contactInfo.name;
          }
        } catch (e) {
          console.log('Could not fetch contact name, using default');
        }
        
        // Create new contact
        contact = await Contact.create({
          name: contactName,
          phone: phone,
          queryStatus: 'new',
          unreadCount: 1,
          lastContacted: new Date(msg.timestamp * 1000)
        });
        console.log(`Auto-created contact: ${contactName} (${phone})`);
      } else {
        // Update existing contact
        contact.unreadCount = (contact.unreadCount || 0) + 1;
        if (contact.queryStatus === 'resolved' || contact.queryStatus === 'closed') {
          contact.queryStatus = 'new'; // Reopen if customer messages again
        }
        contact.lastContacted = new Date(msg.timestamp * 1000);
        await contact.save();
      }
      
      // Analyze sentiment
      const sentiment = analyzeSentiment(msg.body);
      
      // Save incoming message with sentiment
      await Message.create({
        contactId: contact._id,
        phone: phone,
        direction: 'inbound',
        message: msg.body,
        timestamp: new Date(msg.timestamp * 1000),
        status: 'delivered',
        sentiment: sentiment.sentiment,
        sentimentScore: sentiment.score
      });
      
      console.log(`Incoming message from ${contact.name} (${phone}) [${sentiment.sentiment}]: ${msg.body.substring(0, 50)}...`);
    } catch (error) {
      console.error('Error saving incoming message:', error);
    }
  });

  // Retry function with exponential backoff
  const retryWithBackoff = () => {
    if (retryCount >= MAX_RETRIES) {
      console.error('WhatsApp initialization failed after maximum retries');
      isInitializing = false;
      whatsappClient = null;
      return;
    }

    retryCount++;
    const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Exponential backoff, max 10s
    
    console.log(`Retrying WhatsApp initialization (attempt ${retryCount}/${MAX_RETRIES}) in ${delay}ms...`);
    
    setTimeout(() => {
      // Clean up existing client if it exists
      if (whatsappClient) {
        try {
          whatsappClient.destroy().catch(() => {
            // Ignore destroy errors
          });
        } catch (e) {
          // Ignore destroy errors
        }
        whatsappClient = null;
      }
      
      // Recreate and reinitialize (don't reset retry count)
      isInitializing = false;
      initWhatsApp(false);
    }, delay);
  };

  try {
    whatsappClient.initialize().catch((error) => {
      isInitializing = false;
      
      // Handle initialization errors
      if (error.message && error.message.includes('EBUSY')) {
        console.warn('WhatsApp initialization warning (file locking):', error.message);
        retryWithBackoff();
      } else if (error.message && (error.message.includes('Protocol error') || error.message.includes('Execution context was destroyed'))) {
        console.warn('WhatsApp ProtocolError during initialization - retrying...');
        retryWithBackoff();
      } else {
        console.error('WhatsApp initialization error:', error.message || error);
        // Still retry for other errors
        retryWithBackoff();
      }
    });
  } catch (error) {
    isInitializing = false;
    // Handle synchronous errors
    if (error.message && error.message.includes('EBUSY')) {
      console.warn('WhatsApp initialization warning (file locking):', error.message);
      retryWithBackoff();
    } else if (error.message && (error.message.includes('Protocol error') || error.message.includes('Execution context was destroyed'))) {
      console.warn('WhatsApp ProtocolError during initialization - retrying...');
      retryWithBackoff();
    } else {
      console.error('WhatsApp initialization error:', error.message || error);
      retryWithBackoff();
    }
  }
}

// Initialize on module load
initWhatsApp();

// Get QR code
router.get('/qr', async (req, res) => {
  if (qrCodeData) {
    // Check if client wants image format and qrcode package is available
    if (req.query.format === 'image' && qrcode) {
      try {
        const qrImage = await qrcode.toDataURL(qrCodeData, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'M'
        });
        res.json({ qrImage: qrImage });
      } catch (error) {
        console.error('Error generating QR image:', error);
        res.json({ qr: qrCodeData }); // Fallback to raw QR string
      }
    } else {
      res.json({ qr: qrCodeData });
    }
  } else if (isReady) {
    res.json({ status: 'connected' });
  } else {
    res.json({ status: 'initializing' });
  }
});

// Get connection status
router.get('/status', (req, res) => {
  res.json({
    connected: isReady,
    hasQR: !!qrCodeData
  });
});
// ✅ ADD DISCONNECT ROUTE RIGHT HERE ⬇⬇⬇

// Disconnect / Logout WhatsApp
router.post('/disconnect', async (req, res) => {
  try {
    if (whatsappClient) {
      try {
        await whatsappClient.logout();
      } catch (e) {
        console.warn('Logout warning:', e.message);
      }

      try {
        await whatsappClient.destroy();
      } catch (e) {
        if (
          !e.message.includes('EBUSY') &&
          !e.message.includes('Protocol error')
        ) {
          console.error('Destroy error:', e.message);
        }
      }
    }

    whatsappClient = null;
    qrCodeData = null;
    isReady = false;
    isInitializing = false;
    retryCount = 0;

    setTimeout(() => {
      initWhatsApp();
    }, 1500);

    res.json({
      success: true,
      message: 'WhatsApp disconnected. Scan QR to login again.',
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect WhatsApp',
    });
  }
});


// Send message
router.post('/send', async (req, res) => {
  try {
    if (!isReady || !whatsappClient) {
      return res.status(400).json({ error: 'WhatsApp not connected. Please check your connection in Settings.' });
    }

    const { phone, message, contactId } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    // Validate and format phone number
    let cleanedPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    
    // Phone number validation
    if (!cleanedPhone || cleanedPhone.length === 0) {
      return res.status(400).json({ error: 'Phone number is required and cannot be empty.' });
    }
    
    // Phone number should be at least 10 digits and at most 15 digits (E.164 standard)
    if (cleanedPhone.length < 10) {
      return res.status(400).json({ 
        error: `Phone number is too short (${cleanedPhone.length} digits). Please include country code.\nExample: 1234567890 (US) or 911234567890 (India)` 
      });
    }
    
    if (cleanedPhone.length > 15) {
      return res.status(400).json({ 
        error: `Phone number is too long (${cleanedPhone.length} digits). Maximum is 15 digits with country code.` 
      });
    }
    
    // Log the phone number being used (for debugging)
    console.log(`Processing phone number: Original: ${phone}, Cleaned: ${cleanedPhone}`);

    // Format phone number for WhatsApp (must include country code)
    // WhatsApp format: [country code][number]@c.us
    let formattedPhone = cleanedPhone;
    if (!formattedPhone.includes('@')) {
      formattedPhone = formattedPhone + '@c.us';
    }
    
    console.log(`Formatted phone for WhatsApp: ${formattedPhone}`);

    // Validate message
    if (message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // Send message with better error handling
    let sentMessage;
    try {
      console.log(`Attempting to send message to: ${formattedPhone} (cleaned: ${cleanedPhone})`);
      sentMessage = await whatsappClient.sendMessage(formattedPhone, message.trim());
      console.log(`Message sent successfully to ${formattedPhone}`);
    } catch (sendError) {
      // Log full error for debugging
      console.error('WhatsApp send error details:', {
        error: sendError,
        message: sendError.message,
        stack: sendError.stack,
        phone: cleanedPhone,
        formattedPhone: formattedPhone
      });
      
      // Handle specific WhatsApp errors
      const errorMsg = (sendError.message || sendError.toString() || '').toLowerCase();
      const errorString = String(sendError);
      
      // Check for various error patterns
      if (errorMsg.includes('t: t') || 
          errorMsg.includes('not registered') || 
          errorMsg.includes('invalid number') ||
          errorMsg.includes('number not registered') ||
          errorString.includes('not registered')) {
        return res.status(400).json({ 
          error: `Phone number ${cleanedPhone} is not registered on WhatsApp or is invalid. Please verify:\n- The number includes country code (e.g., 1234567890 for US)\n- The number is correct\n- The contact has WhatsApp installed` 
        });
      }
      
      if (errorMsg.includes('protocol error') || 
          errorMsg.includes('execution context') ||
          errorMsg.includes('target closed') ||
          errorMsg.includes('session closed')) {
        return res.status(503).json({ 
          error: 'WhatsApp connection lost. Please go to Settings and reconnect your WhatsApp account.' 
        });
      }
      
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        return res.status(504).json({ 
          error: 'Request timed out. Please check your internet connection and try again.' 
        });
      }
      
      if (errorMsg.includes('rate limit') || errorMsg.includes('too many')) {
        return res.status(429).json({ 
          error: 'Too many messages sent. Please wait a few minutes before sending more messages.' 
        });
      }
      
      // Check if it's a connection issue
      if (!isReady || !whatsappClient) {
        return res.status(400).json({ 
          error: 'WhatsApp is not connected. Please go to Settings and connect your WhatsApp account first.' 
        });
      }
      
      // Generic error with more context
      const detailedError = sendError.message || sendError.toString() || 'Unknown error';
      return res.status(500).json({ 
        error: `Failed to send message: ${detailedError}. Please verify:\n- Phone number format is correct (include country code)\n- WhatsApp is connected\n- The number is registered on WhatsApp` 
      });
    }
    
    // Save to database
    let contact = null;
    if (contactId) {
      contact = await Contact.findById(contactId);
    } else {
      contact = await Contact.findOne({ phone: cleanedPhone });
    }

    // Save message even if contact doesn't exist yet
    const messageData = {
      phone: cleanedPhone,
      direction: 'outbound',
      message: message.trim(),
      timestamp: new Date(),
      status: 'sent'
    };

    if (contact) {
      messageData.contactId = contact._id;
      await Message.create(messageData);

      // Update contact - mark as in-progress if was new, update last contacted
      const updateData = {
        lastContacted: new Date()
      };
      
      // If query was new and we're responding, mark as in-progress
      if (contact.queryStatus === 'new') {
        updateData.queryStatus = 'in-progress';
      }
      
      await Contact.findByIdAndUpdate(contact._id, updateData);
    } else {
      // Create contact if doesn't exist
      contact = await Contact.create({
        name: `Customer ${cleanedPhone.substring(cleanedPhone.length - 4)}`,
        phone: cleanedPhone,
        queryStatus: 'new',
        unreadCount: 0
      });
      messageData.contactId = contact._id;
      await Message.create(messageData);
    }

    res.json({
      success: true,
      messageId: sentMessage.id._serialized,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'An unexpected error occurred while sending the message.';
    
    if (error.message) {
      if (error.message.includes('not connected')) {
        errorMessage = 'WhatsApp is not connected. Please check your connection in Settings.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else {
        errorMessage = error.message;
      }
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Reinitialize WhatsApp
router.post('/reconnect', async (req, res) => {
  try {
    isInitializing = false;
    retryCount = 0;
    
    if (whatsappClient) {
      try {
        await whatsappClient.destroy();
      } catch (destroyError) {
        // Ignore EBUSY errors on Windows (file locking issue)
        if (!destroyError.message.includes('EBUSY') && !destroyError.message.includes('Protocol error')) {
          console.error('Error destroying WhatsApp client:', destroyError.message);
        }
      }
      whatsappClient = null;
    }
    isReady = false;
    qrCodeData = null;
    
    // Longer delay before reinitializing to allow browser processes to fully terminate
    setTimeout(() => {
      initWhatsApp();
    }, 2000);
    
    res.json({ message: 'Reinitializing WhatsApp connection' });
  } catch (error) {
    console.error('Error reconnecting WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

